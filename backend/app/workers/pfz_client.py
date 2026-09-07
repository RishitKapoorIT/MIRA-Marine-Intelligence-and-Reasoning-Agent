"""HTTP client for services/pfz-api.

Lives in workers/, never in tools/: FR-E1.2 requires PFZ zones to be served
from the batch-computed cache rather than derived during a conversation turn,
so this is only ever called on a schedule.

REQUIRES a batch_custom endpoint on services/pfz-api that accepts
caller-supplied features. The existing /predict/batch_coords generates its
own random features, which is exactly what Fix-1 set out to replace. The
endpoint to add is given in the Step 5b notes.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

from app.core.config import settings
from app.workers.pfz_features import FeaturePoint

logger = logging.getLogger(__name__)

# Feature names sent to the model. VERIFY THIS AGAINST YOUR TRAINED MODEL -
# XGBoost is positional, and a silently mismatched order produces confident
# nonsense rather than an error. `curl localhost:8001/health` should report
# the expected feature names.
FEATURE_KEYS = [
    "latitude",
    "longitude",
    "temperature",
    "salinity",
    "eastward_current",
    "northward_current",
    "chlorophyll",
]


@dataclass
class Prediction:
    latitude: float
    longitude: float
    zone_class: str
    confidence: float | None


def to_payload(point: FeaturePoint) -> dict:
    return {
        "latitude": point.latitude,
        "longitude": point.longitude,
        "temperature": point.temperature,
        "salinity": point.salinity,
        "eastward_current": point.eastward_current,
        "northward_current": point.northward_current,
        # null, not a substituted number. The endpoint must map this to NaN so
        # XGBoost treats it as a missing feature.
        "chlorophyll": point.chlorophyll,
    }


async def classify(points: list[FeaturePoint]) -> tuple[list[Prediction], list[str]]:
    """Classify grid points in chunks. Returns (predictions, errors).

    A failed chunk is recorded and skipped rather than aborting the run: a
    partial generation with honest coverage beats no generation at all.
    """
    predictions: list[Prediction] = []
    errors: list[str] = []
    size = settings.pfz_api_batch_size

    for start in range(0, len(points), size):
        chunk = points[start : start + size]
        url = f"{settings.pfz_api_base_url.rstrip('/')}/api/v1/predict/batch_custom"

        payload, error = await _post_json(
            url, {"items": [to_payload(p) for p in chunk]}
        )

        if error or payload is None:
            errors.append(f"chunk at offset {start} failed: {error}")
            continue

        rows = payload.get("predictions", [])
        if len(rows) != len(chunk):
            errors.append(
                f"chunk at offset {start}: expected {len(chunk)} predictions, got {len(rows)}"
            )
            continue

        for point, row in zip(chunk, rows):
            predictions.append(
                Prediction(
                    latitude=point.latitude,
                    longitude=point.longitude,
                    zone_class=str(row.get("predicted_zone", "POOR")).upper(),
                    confidence=row.get("confidence"),
                )
            )

    logger.info(
        "PFZ classification: %d predictions, %d chunk errors",
        len(predictions),
        len(errors),
    )
    return predictions, errors


async def _post_json(url: str, body: dict) -> tuple[dict | None, str | None]:
    """POST with the same bounded-retry contract as tools.base.fetch_json."""
    import asyncio

    import httpx

    from app.tools.base import BACKOFF_BASE_SECONDS, MAX_ATTEMPTS

    last_error: str | None = None
    for attempt in range(MAX_ATTEMPTS):
        try:
            async with httpx.AsyncClient(
                timeout=float(settings.pfz_api_timeout_seconds)
            ) as client:
                response = await client.post(url, json=body)

            if response.status_code >= 500:
                last_error = f"HTTP {response.status_code} from pfz-api"
            elif response.status_code >= 400:
                return None, f"HTTP {response.status_code}: {response.text[:200]}"
            else:
                return response.json(), None
        except httpx.TimeoutException:
            last_error = "pfz-api timed out"
        except httpx.HTTPError as exc:
            last_error = f"pfz-api transport error: {exc}"
        except ValueError as exc:
            return None, f"pfz-api returned malformed JSON: {exc}"

        if attempt < MAX_ATTEMPTS - 1:
            await asyncio.sleep(BACKOFF_BASE_SECONDS * (2**attempt))

    return None, last_error