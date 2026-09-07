"""PFZ cache reader (FR-E1.2).

Strictly PostGIS reads against the atomically-published generation. This
module contains no HTTP client and imports nothing from workers — the
derivation pipeline runs on a schedule and this only ever reads what it
published.

These are the canonical PFZ queries. api/v1/pfz.py currently carries its own
near-identical copy from Step 3; Step 5 rewiring should collapse it onto
these functions so the request path and the agent path cannot drift apart.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from geoalchemy2 import WKTElement
from geoalchemy2.shape import to_shape
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import SRID, GenerationStatus
from app.core.thresholds import thresholds
from app.db.models import PfzGeneration, PfzZone


@dataclass
class ZoneHit:
    zone: PfzZone
    distance_km: float
    bearing_deg: float


@dataclass
class PfzReadResult:
    """FR-E1.8 / FR-E1.9 — 'no product exists', 'nothing qualified' and
    'we could not see enough ocean' are three different answers, and the
    caller must be able to tell them apart. A bare empty list cannot."""

    status: str  # "ok" | "empty" | "unavailable"
    zones: list[ZoneHit]
    generation: PfzGeneration | None = None
    empty_reason: str | None = None
    is_stale: bool = False
    message: str | None = None


async def get_published_generation(db: AsyncSession) -> PfzGeneration | None:
    """At most one row can satisfy this — enforced by uq_pfz_one_published."""
    stmt = select(PfzGeneration).where(
        PfzGeneration.status == GenerationStatus.PUBLISHED
    )
    return (await db.execute(stmt)).scalar_one_or_none()


def _is_stale(generation: PfzGeneration) -> bool:
    max_age = timedelta(hours=thresholds.pfz.max_staleness_hours)
    return datetime.now(timezone.utc) - generation.computed_at > max_age


async def get_nearest_zones(
    db: AsyncSession, lat: float, lon: float, limit: int = 10
) -> PfzReadResult:
    """FR-E1.1 — nearest zones with distance and bearing.

    ST_Azimuth returns radians clockwise from north; converted to degrees here
    so nothing downstream has to remember the unit.
    """
    generation = await get_published_generation(db)

    if generation is None:
        return PfzReadResult(
            status="unavailable",
            zones=[],
            message="No PFZ product has been published yet.",
        )

    if generation.zone_count == 0:
        return PfzReadResult(
            status="empty",
            zones=[],
            generation=generation,
            empty_reason=(
                generation.empty_reason.value if generation.empty_reason else None
            ),
            is_stale=_is_stale(generation),
        )

    center = WKTElement(f"POINT({lon} {lat})", srid=SRID)
    distance_m = func.ST_Distance(PfzZone.centroid, center).label("distance_m")
    bearing_rad = func.ST_Azimuth(center, PfzZone.centroid).label("bearing_rad")

    stmt = (
        select(PfzZone, distance_m, bearing_rad)
        .where(PfzZone.generation_id == generation.id)
        .order_by(distance_m)
        .limit(limit)
    )
    rows = (await db.execute(stmt)).all()

    hits = [
        ZoneHit(
            zone=zone,
            distance_km=round(dist_m / 1000, 2),
            bearing_deg=round(math.degrees(bearing) % 360, 1)
            if bearing is not None
            else 0.0,
        )
        for zone, dist_m, bearing in rows
    ]

    return PfzReadResult(
        status="ok",
        zones=hits,
        generation=generation,
        is_stale=_is_stale(generation),
    )


def zone_evidence(hit: ZoneHit) -> dict:
    """FR-E1.4 / FR-G1.1 — the values behind a zone, with their provenance.

    feature_provenance is passed through verbatim rather than summarised: it
    is what lets the evidence panel show the salinity climatology constant as
    a constant instead of as an observation.
    """
    zone = hit.zone
    return {
        "zone_class": zone.zone_class.value,
        "confidence": zone.confidence,
        "area_km2": zone.area_km2,
        "distance_km": hit.distance_km,
        "bearing_deg": hit.bearing_deg,
        "centroid": {
            "latitude": to_shape(zone.centroid).y,
            "longitude": to_shape(zone.centroid).x,
        },
        "sea_surface_temperature_c": zone.mean_sst_c,
        "chlorophyll_mg_m3": zone.mean_chlorophyll_mg_m3,
        "sst_gradient": zone.sst_gradient,
        "salinity_psu": zone.salinity_psu,
        "feature_provenance": zone.feature_provenance,
        "observation_date": zone.observation_date,
    }