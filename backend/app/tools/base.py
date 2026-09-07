"""Shared plumbing for every deterministic tool.

Two rules are enforced here rather than left to each tool's discipline:

1. FR-C6.1 — nothing leaves a tool as a bare value. Every result is a
   SourceEnvelope carrying its source, its kind, and the time it actually
   describes. A caller physically cannot render a number without having its
   provenance in hand.

2. FR-C6.3 / §7.8 — a source being down is data, not an exception. Tools
   return `SourceEnvelope.unavailable(...)`; they do not raise. The answer
   layer then states the absence rather than substituting a modelled or
   default value. Programming errors still raise normally — only *source*
   failure is modelled as data.

The `kind` field exists because "timestamp" means different things for
different data. A satellite SST reading was observed at a moment in the
past. A wave forecast for tomorrow afternoon was never observed at all.
Collapsing both into one "timestamp" field is how a forecast ends up
presented as a measurement, so DataKind keeps them distinct all the way to
the evidence panel.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Any

import httpx
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import SourceStatus

DEFAULT_TIMEOUT_SECONDS = 15.0
MAX_ATTEMPTS = 3
BACKOFF_BASE_SECONDS = 0.5


class DataKind(str, Enum):
    OBSERVATION = "observation"   # measured at a past moment
    FORECAST = "forecast"         # model output for a future moment
    DERIVED = "derived"           # computed by us from other inputs
    CLIMATOLOGY = "climatology"   # long-term average, not current
    STATIC = "static"             # reference geometry, effectively timeless


class SourceEnvelope(BaseModel):
    """One retrieval from one source."""

    source_id: str
    kind: DataKind
    available: bool = True

    values: dict[str, Any] = Field(default_factory=dict)

    # The moment the data DESCRIBES. Observation time for a measurement,
    # valid time for a forecast. This is what the user is shown.
    valid_at: datetime | None = None
    # When the producer issued it (satellite pass, model run). Often unknown
    # for keyless APIs; None is honest, a guess is not.
    issued_at: datetime | None = None
    # When we fetched it. Never a substitute for valid_at (FR-C6.1).
    fetched_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    unavailable_reason: str | None = None
    attribution: str | None = None

    @classmethod
    def unavailable(
        cls, source_id: str, kind: DataKind, reason: str
    ) -> SourceEnvelope:
        return cls(
            source_id=source_id, kind=kind, available=False, unavailable_reason=reason
        )

    def is_stale(self, max_age: timedelta) -> bool:
        """FR-C6.2. Unknown valid_at counts as stale — we cannot show freshness
        we do not have."""
        if not self.available:
            return True
        if self.valid_at is None:
            return True
        return datetime.now(timezone.utc) - self.valid_at > max_age

    def age_hours(self) -> float | None:
        if self.valid_at is None:
            return None
        return (datetime.now(timezone.utc) - self.valid_at).total_seconds() / 3600


async def fetch_json(
    url: str,
    params: dict[str, Any] | None = None,
    *,
    timeout: float = DEFAULT_TIMEOUT_SECONDS,
    max_attempts: int = MAX_ATTEMPTS,
) -> tuple[dict | None, str | None]:
    """Bounded-retry JSON GET. Returns (payload, error).

    NFR-R3: retries are bounded and the whole thing is time-boxed, so a slow
    upstream degrades this request instead of hanging the worker. Retries only
    on transport errors and 5xx — a 4xx is our bug and retrying it just wastes
    the latency budget.
    """
    last_error: str | None = None

    for attempt in range(max_attempts):
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.get(url, params=params)

            if response.status_code >= 500:
                last_error = f"HTTP {response.status_code} from upstream"
            elif response.status_code >= 400:
                return None, f"HTTP {response.status_code}: {response.text[:200]}"
            else:
                return response.json(), None

        except httpx.TimeoutException:
            last_error = f"Timed out after {timeout}s"
        except httpx.HTTPError as exc:
            last_error = f"Transport error: {exc}"
        except ValueError as exc:
            return None, f"Malformed JSON from upstream: {exc}"

        if attempt < max_attempts - 1:
            await asyncio.sleep(BACKOFF_BASE_SECONDS * (2**attempt))

    return None, last_error


async def fetch_text(
    url: str,
    *,
    timeout: float = DEFAULT_TIMEOUT_SECONDS,
    max_attempts: int = MAX_ATTEMPTS,
) -> tuple[str | None, str | None]:
    """As fetch_json, for XML/RSS endpoints."""
    last_error: str | None = None

    for attempt in range(max_attempts):
        try:
            async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
                response = await client.get(url)

            if response.status_code >= 500:
                last_error = f"HTTP {response.status_code} from upstream"
            elif response.status_code >= 400:
                return None, f"HTTP {response.status_code}"
            else:
                return response.text, None

        except httpx.TimeoutException:
            last_error = f"Timed out after {timeout}s"
        except httpx.HTTPError as exc:
            last_error = f"Transport error: {exc}"

        if attempt < max_attempts - 1:
            await asyncio.sleep(BACKOFF_BASE_SECONDS * (2**attempt))

    return None, last_error


async def record_source_result(db: AsyncSession, envelope: SourceEnvelope) -> None:
    """Feeds the §7.8 degradation matrix and FR-F5.4's feed-status display.

    Deliberately separate from the fetch functions: tools stay DB-free and
    reusable from workers, and the caller decides whether a given fetch is
    worth recording as source health.
    """
    row = await db.get(SourceStatus, envelope.source_id)
    if row is None:
        row = SourceStatus(source_id=envelope.source_id)
        db.add(row)

    row.last_attempt_at = envelope.fetched_at
    row.is_available = envelope.available

    if envelope.available:
        row.last_success_at = envelope.fetched_at
        row.consecutive_failures = 0
        row.detail = None
        if envelope.valid_at is not None:
            row.last_observation_at = envelope.valid_at
    else:
        row.consecutive_failures = (row.consecutive_failures or 0) + 1
        row.detail = envelope.unavailable_reason


def parse_iso(value: str | None) -> datetime | None:
    """Open-Meteo and CAP both emit ISO-8601. Naive values from Open-Meteo are
    UTC by our explicit timezone=UTC request parameter."""
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed