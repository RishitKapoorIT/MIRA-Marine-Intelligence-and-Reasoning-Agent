"""FR-G1.1 evidence panel item."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel

from app.tools.base import DataKind, SourceEnvelope


class EvidenceItem(BaseModel):
    source_id: str
    kind: DataKind
    available: bool
    values: dict[str, Any] = {}
    valid_at: datetime | None = None
    fetched_at: datetime | None = None
    age_hours: float | None = None
    is_stale: bool = False
    unavailable_reason: str | None = None
    attribution: str | None = None

    @classmethod
    def from_envelope(cls, env: SourceEnvelope, *, stale: bool = False) -> "EvidenceItem":
        return cls(
            source_id=env.source_id,
            kind=env.kind,
            available=env.available,
            values=env.values,
            valid_at=env.valid_at,
            fetched_at=env.fetched_at,
            age_hours=env.age_hours(),
            is_stale=stale,
            unavailable_reason=env.unavailable_reason,
            attribution=env.attribution,
        )