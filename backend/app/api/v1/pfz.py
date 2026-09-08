"""FR-E1 / FR-G5 PFZ endpoints.

Reads only from the batch-computed, atomically-published cache; never derives
zones live (FR-E1.2). The derivation pipeline is app/workers/pfz_*.

STEP 5C: every query here now delegates to app/tools/pfz_tool. This module
previously carried its own copy of the nearest-zones query, which meant the
request path and the agent path could answer the same question differently -
and after the coverage gate was added to pfz_tool, they would have.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from geoalchemy2.shape import to_shape
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user
from app.core.thresholds import thresholds
from app.db.models import User
from app.db.session import get_session
from app.safety.disclosures import for_answer
from app.tools import pfz_tool

router = APIRouter()


def _disclosures(partial_coverage: bool = False) -> list[dict]:
    """FR-I2 — sourced from the single registry, not restated here."""
    return [
        d.__dict__
        for d in for_answer(includes_pfz=True, pfz_partial_coverage=partial_coverage)
    ]


def _resolve_point(
    lat: float | None, lon: float | None, current_user: User
) -> tuple[float, float]:
    if lat is not None and lon is not None:
        return lat, lon
    if current_user.base_location is None:
        raise HTTPException(
            status_code=400, detail="No lat/lon given and no base location on file."
        )
    point = to_shape(current_user.base_location)
    return point.y, point.x


@router.get("/methodology")
async def get_methodology(db: AsyncSession = Depends(get_session)) -> dict:
    """FR-G5.1 — reachable from any PFZ answer."""
    generation = await pfz_tool.get_published_generation(db)

    return {
        "approach": (
            "Sea surface temperature and ocean currents are retrieved for a "
            "fixed coastal grid, classified by a trained XGBoost model into "
            "BEST / GOOD / POOR, then clustered into zone polygons. Zone "
            "count is an output of this process, never a target."
        ),
        "inputs": {
            "sea_surface_temperature": "Open-Meteo Marine forecast",
            "ocean_currents": "Open-Meteo Marine forecast",
            "salinity": "regional climatology constant, not observed",
            "chlorophyll": "not currently retrieved; passed to the model as a "
            "missing feature rather than estimated",
        },
        "min_zone_area_km2": thresholds.pfz.min_zone_area_km2,
        "min_coverage_fraction": thresholds.pfz.min_coverage_fraction,
        "grid_spacing_deg": thresholds.pfz.grid.spacing_deg,
        "refresh_cadence": "Daily batch; recomputed only when inputs change.",
        "current_generation": (
            {
                "observation_date": generation.observation_date,
                "computed_at": generation.computed_at,
                "coverage_fraction": generation.coverage_fraction,
                "zone_count": generation.zone_count,
            }
            if generation
            else None
        ),
        "disclosures": _disclosures(),
    }


@router.get("/zones")
async def get_zones(
    lat: float | None = Query(None, ge=-90, le=90),
    lon: float | None = Query(None, ge=-180, le=180),
    limit: int = Query(10, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> dict:
    lat, lon = _resolve_point(lat, lon, current_user)
    result = await pfz_tool.get_nearest_zones(db, lat, lon, limit=limit)

    base = {
        "status": result.status,
        "is_stale": result.is_stale,
        "query_point": {"latitude": lat, "longitude": lon},
        "methodology_url": "/api/v1/pfz/methodology",
        "disclosures": _disclosures(result.partial_coverage),
    }

    if result.generation is not None:
        base["observation_date"] = result.generation.observation_date
        base["coverage_fraction"] = result.generation.coverage_fraction

    # FR-E1.15 — no generation has ever published.
    if result.status == "unavailable":
        return {**base, "message": result.message, "zones": []}

    # The run never reached this location. Distinct from "nothing qualified".
    if result.status == "not_covered":
        return {**base, "message": result.message, "zones": []}

    # FR-E1.8 / FR-E1.9 — nothing qualified, and which of the two causes.
    if result.status == "empty":
        return {**base, "empty_reason": result.empty_reason, "zones": []}

    return {
        **base,
        "zones": [pfz_tool.zone_evidence(hit) for hit in result.zones],
        "ranking_note": (
            "Sorted by distance only. Ranking that also weighs sea-state en "
            "route and hazard exposure happens in the conversational query "
            "path (FR-E1.16)."
        ),
    }