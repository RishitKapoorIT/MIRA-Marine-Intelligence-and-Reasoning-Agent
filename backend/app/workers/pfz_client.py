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
from app.core.thresholds import thresholds
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


VALID_ZONE_CLASSES = {"BEST", "GOOD", "POOR"}


class UnmappedLabelError(RuntimeError):
    """The model emitted a label ORCA has no mapping for.

    Raised rather than defaulted, because the failure mode it replaces is
    invisible: an unmapped label silently fails the BEST/GOOD test in
    pfz_derive, so the batch publishes zero zones and reports
    NO_QUALIFYING_CONDITIONS - indistinguishable from a real finding that the
    sea is unproductive. A configuration error must not be able to masquerade
    as an oceanographic result.
    """


@dataclass
class Prediction:
    latitude: float
    longitude: float
    zone_class: str
    confidence: float | None


def map_label(raw: object) -> str:
    """Model label -> ORCA zone vocabulary."""
    text = str(raw).strip()

    # Already in our vocabulary (a model trained with string labels).
    if text.upper() in VALID_ZONE_CLASSES:
        return text.upper()

    mapped = thresholds.pfz.class_labels.get(text)
    if mapped is None:
        raise UnmappedLabelError(
            f"Model returned label {text!r}, which is not in ORCA's zone "
            f"vocabulary and has no entry in thresholds.yaml pfz.class_labels. "
            f"Configured mappings: {thresholds.pfz.class_labels or '(none)'}. "
            f"Determine the model's class order with "
            f"`python -m scripts.diagnose_pfz --labels` and configure it."
        )

    if mapped.upper() not in VALID_ZONE_CLASSES:
        raise UnmappedLabelError(
            f"pfz.class_labels maps {text!r} to {mapped!r}, which is not one "
            f"of {sorted(VALID_ZONE_CLASSES)}."
        )
    return mapped.upper()


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
            # Deliberately not caught: an unmapped label fails the whole batch
            # so the generation is marked FAILED and the previous published
            # one stays in place (FR-E1.15).
            predictions.append(
                Prediction(
                    latitude=point.latitude,
                    longitude=point.longitude,
                    zone_class=map_label(row.get("predicted_zone")),
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