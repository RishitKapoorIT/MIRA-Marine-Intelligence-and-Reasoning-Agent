"""FR-E1 / FR-G5 — reads only from the batch-computed, atomically-published
PFZ cache. Never derives zones live (FR-E1.2); the derivation pipeline
(workers/pfz_features.py -> pfz_client.py -> pfz_derive.py -> pfz_batch.py)
is Step 4/5.
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from geoalchemy2 import WKTElement
from geoalchemy2.shape import to_shape
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import SRID, GenerationStatus
from app.core.security import get_current_user
from app.core.thresholds import thresholds
from app.db.models import PfzGeneration, PfzZone, User
from app.db.session import get_session

router = APIRouter()

# FR-I2.1 / FR-I2.2 — carried on every PFZ answer, not just the methodology page.
PFZ_DISCLOSURES = [
    "This zone is ORCA's own model derived from public satellite data "
    "(NASA Ocean Color SST + chlorophyll-a), not an INCOIS-certified advisory.",
    "Formal accuracy validation against independent reference data has not "
    "been performed for this build.",
]


@router.get("/methodology")
async def get_methodology(db: AsyncSession = Depends(get_session)) -> dict:
    """FR-G5.1 — reachable from any PFZ answer."""
    stmt = select(PfzGeneration).where(PfzGeneration.status == GenerationStatus.PUBLISHED)
    generation = (await db.execute(stmt)).scalar_one_or_none()

    return {
        "approach": (
            "Sea surface temperature and chlorophyll-a are retrieved for a "
            "fixed coastal grid, classified by a trained XGBoost model into "
            "BEST / GOOD / POOR, then clustered into zone polygons. Zone "
            "count is an output of this process, never a target."
        ),
        "inputs": [
            "sea_surface_temperature",
            "chlorophyll_a",
            "ocean_currents",
            "salinity (climatology constant)",
        ],
        "min_zone_area_km2": thresholds.pfz.min_zone_area_km2,
        "composite_window_days": thresholds.pfz.composite_days,
        "refresh_cadence": (
            "Daily granule-availability check; recomputed only when inputs change."
        ),
        "current_generation": (
            {
                "observation_date": generation.observation_date,
                "computed_at": generation.computed_at,
            }
            if generation
            else None
        ),
        "disclosures": PFZ_DISCLOSURES,
    }


@router.get("/zones")
async def get_zones(
    lat: float | None = Query(None, ge=-90, le=90),
    lon: float | None = Query(None, ge=-180, le=180),
    limit: int = Query(10, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> dict:
    if lat is None or lon is None:
        if current_user.base_location is None:
            raise HTTPException(
                status_code=400,
                detail="No lat/lon given and no base location on file.",
            )
        point = to_shape(current_user.base_location)
        lat, lon = point.y, point.x

    gen_stmt = select(PfzGeneration).where(PfzGeneration.status == GenerationStatus.PUBLISHED)
    generation = (await db.execute(gen_stmt)).scalar_one_or_none()

    if generation is None:
        # FR-E1.15 — no known-good generation exists yet (the batch hasn't run).
        return {
            "status": "unavailable",
            "message": "No PFZ product is available yet.",
            "zones": [],
            "disclosures": PFZ_DISCLOSURES,
        }

    is_stale = (
        datetime.now(timezone.utc) - generation.computed_at
    ).total_seconds() > thresholds.pfz.max_staleness_hours * 3600

    if generation.zone_count == 0:
        # FR-E1.8 / FR-E1.9 — plainly stated, and the two causes distinguished.
        return {
            "status": "empty",
            "empty_reason": generation.empty_reason,
            "observation_date": generation.observation_date,
            "is_stale": is_stale,
            "zones": [],
            "disclosures": PFZ_DISCLOSURES,
        }

    center = WKTElement(f"POINT({lon} {lat})", srid=SRID)
    distance_m = func.ST_Distance(PfzZone.centroid, center).label("distance_m")
    bearing_rad = func.ST_Azimuth(center, PfzZone.centroid).label("bearing_rad")

    zones_stmt = (
        select(PfzZone, distance_m, bearing_rad)
        .where(PfzZone.generation_id == generation.id)
        .order_by(distance_m)
        .limit(limit)
    )
    rows = (await db.execute(zones_stmt)).all()

    def _out(zone: PfzZone, dist_m: float, bearing_rad_val: float) -> dict:
        return {
            "id": zone.id,
            "zone_class": zone.zone_class,
            "confidence": zone.confidence,
            "area_km2": zone.area_km2,
            "distance_km": round(dist_m / 1000, 2),
            "bearing_deg": round((bearing_rad_val * 180 / 3.141592653589793) % 360, 1),
            "geometry": to_shape(zone.geom).__geo_interface__,
            "evidence": {
                "sea_surface_temperature_c": zone.mean_sst_c,
                "chlorophyll_mg_m3": zone.mean_chlorophyll_mg_m3,
                "sst_gradient": zone.sst_gradient,
                "salinity_psu": zone.salinity_psu,
                "feature_provenance": zone.feature_provenance,
                "observation_date": zone.observation_date,
            },
            "mpa_or_restricted": {
                "intersects_mpa": zone.intersects_mpa,
                "intersects_restricted": zone.intersects_restricted,
                "distance_to_boundary_m": zone.distance_to_boundary_m,
            },
        }

    return {
        "status": "ok",
        "is_stale": is_stale,
        "observation_date": generation.observation_date,
        "zones": [_out(z, d, b) for z, d, b in rows],
        "disclosures": PFZ_DISCLOSURES
        + [
            "This raw list is sorted by distance only. Ranking that also "
            "weighs sea-state en route and hazard exposure happens in the "
            "conversational query path (FR-E1.16)."
        ],
        "methodology_url": "/api/v1/pfz/methodology",
    }