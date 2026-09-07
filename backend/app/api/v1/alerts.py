"""FR-F5 browsable alerts view.

Deterministic query path only. FR-F5.8 forbids invoking the agent layer
here, so this file imports nothing from app.agents — that import graph is
the evidence for the Design Review this requirement calls for.
"""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from geoalchemy2 import WKTElement
from geoalchemy2.shape import to_shape
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import SRID, SourceId
from app.core.security import get_current_user
from app.core.thresholds import thresholds
from app.db.models import Alert, SourceStatus, User
from app.db.session import get_session

router = APIRouter()

ATTRIBUTION = (
    "Hazard alerts sourced from NDMA SACHET. Each alert credits its "
    "originating agency (IMD / CWC / INCOIS / GSI)."
)


@router.get("")
async def get_alerts(
    lat: float | None = Query(None, ge=-90, le=90),
    lon: float | None = Query(None, ge=-180, le=180),
    radius_km: float | None = Query(None, gt=0),
    include_expired: bool = Query(False),
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

    radius_km = radius_km or thresholds.alerts.default_radius_km
    center = WKTElement(f"POINT({lon} {lat})", srid=SRID)

    # --- FR-F5.4 / §7.8: feed status is reported explicitly, never implied
    # by an empty list, which would read as a false all-clear. ---
    status_row = await db.get(SourceStatus, SourceId.SACHET_CAP.value)
    feed_ok = status_row is not None and status_row.is_available
    warning = None
    if status_row is None:
        warning = "Hazard alert feed has not yet been polled."
    elif not feed_ok:
        warning = (
            "Live hazard alert feed is currently unreachable. "
            "The list below may not reflect current conditions."
        )

    now = datetime.now(timezone.utc)
    within_radius = func.ST_DWithin(Alert.area_geom, center, radius_km * 1000)

    active_stmt = (
        select(Alert)
        .where(within_radius)
        .where(or_(Alert.expires_at.is_(None), Alert.expires_at > now))
        .order_by(Alert.severity, Alert.effective_at.desc())
    )
    active_alerts = (await db.execute(active_stmt)).scalars().all()

    expired_alerts = []
    if include_expired:
        cutoff = now - timedelta(days=thresholds.alerts.expired_retention_days)
        expired_stmt = (
            select(Alert)
            .where(within_radius)
            .where(Alert.expires_at.is_not(None))
            .where(Alert.expires_at <= now)
            .where(Alert.expires_at >= cutoff)
            .order_by(Alert.expires_at.desc())
        )
        expired_alerts = (await db.execute(expired_stmt)).scalars().all()

    def _out(a: Alert, is_expired: bool) -> dict:
        return {
            "id": a.id,
            "hazard_type": a.hazard_type,
            "severity": a.severity,
            "urgency": a.urgency,
            "certainty": a.certainty,
            "headline": a.headline,  # FR-F5.7 — original text, always shown
            "description": a.description,
            "instruction": a.instruction,
            "original_language": a.original_language,
            "originating_agency": a.originating_agency,
            "area_description": a.area_description,
            "onset_at": a.onset_at,
            "effective_at": a.effective_at,
            "expires_at": a.expires_at,
            "is_expired": is_expired,
        }

    return {
        "feed_status": "ok" if feed_ok else "unavailable",
        "feed_warning": warning,
        "last_successful_update_at": status_row.last_success_at if status_row else None,
        "region": {"latitude": lat, "longitude": lon, "radius_km": radius_km},
        "active_alerts": [_out(a, False) for a in active_alerts],
        "expired_alerts": [_out(a, True) for a in expired_alerts],
        "attribution": ATTRIBUTION,
    }