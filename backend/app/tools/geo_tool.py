"""Location and timeframe resolution (FR-D1, FR-D3).

FR-D1.2 fixes the precedence order and FR-D1.3 requires the answer to state
which route was used, so resolve_location always returns the route alongside
the point — the two are never separable.

FR-D1.4: when no route yields a location, this returns None. It does not
fall back to a regional centroid or a "default" port. A marine safety answer
computed for the wrong stretch of coast is worse than a request to clarify.

Distance and bearing here are pure-Python (haversine + great-circle initial
bearing), used for point-to-point maths where no stored geometry is involved.
Anything touching a database geometry column uses PostGIS instead — see
pfz_tool.get_nearest_zones. Both agree to well within the precision this
application needs.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from geoalchemy2.shape import to_shape

from app.core.constants import ResolutionRoute
from app.db.models import User

IST = ZoneInfo("Asia/Kolkata")
EARTH_RADIUS_KM = 6371.0088

# Karnataka coastal reference points for named-place queries.
#
# APPROXIMATE port-town centroids, entered by hand. They are good enough to
# resolve "weather near Malpe" to the right stretch of coast, and NOT good
# enough to navigate by. Verify against an authoritative source before the
# demo, and treat this as seed data for a real gazetteer rather than as a
# finished one. FR-D2 named-fishing-ground lookup is a separate concern and
# is not covered here.
COASTAL_GAZETTEER: dict[str, tuple[float, float]] = {
    "mangaluru": (12.87, 74.84),
    "mangalore": (12.87, 74.84),
    "panambur": (12.93, 74.80),
    "udupi": (13.34, 74.75),
    "malpe": (13.35, 74.70),
    "gangolli": (13.65, 74.67),
    "bhatkal": (13.97, 74.55),
    "murudeshwara": (14.09, 74.48),
    "honnavar": (14.28, 74.45),
    "kumta": (14.43, 74.42),
    "karwar": (14.81, 74.13),
}


@dataclass
class ResolvedLocation:
    latitude: float
    longitude: float
    route: ResolutionRoute
    label: str | None = None


@dataclass
class ResolvedWindow:
    start: datetime
    end: datetime
    assumed: bool  # FR-A4.2 — a defaulted window must be stated in the answer
    description: str


def resolve_location(
    user: User,
    *,
    explicit_coords: tuple[float, float] | None = None,
    named_place: str | None = None,
    shared_position: tuple[float, float] | None = None,
    live_gps: tuple[float, float] | None = None,
) -> ResolvedLocation | None:
    """FR-D1.2 precedence, highest first.

    Explicit coordinates and a named place sit above the implicit routes: if
    the user named where they mean, that beats anything inferred about where
    they are.
    """
    if explicit_coords is not None:
        lat, lon = explicit_coords
        return ResolvedLocation(lat, lon, ResolutionRoute.EXPLICIT_COORDS)

    if named_place:
        hit = COASTAL_GAZETTEER.get(named_place.strip().lower())
        if hit is not None:
            return ResolvedLocation(
                hit[0], hit[1], ResolutionRoute.NAMED_PLACE, label=named_place
            )
        # Unknown place name deliberately falls through rather than guessing.

    if shared_position is not None:
        lat, lon = shared_position
        return ResolvedLocation(lat, lon, ResolutionRoute.SHARED_POSITION)

    if live_gps is not None:
        lat, lon = live_gps
        return ResolvedLocation(lat, lon, ResolutionRoute.LIVE_GPS)

    if user.base_location is not None:
        point = to_shape(user.base_location)
        return ResolvedLocation(
            point.y,
            point.x,
            ResolutionRoute.BASE_LOCATION,
            label=user.base_location_label,
        )

    return None  # FR-D1.4 — caller must ask, not assume


def resolve_window(
    reference: datetime | None = None,
    *,
    relative: str | None = None,
    default_hours: int = 12,
) -> ResolvedWindow:
    """FR-D3.1 — relative expressions resolved against IST, since that is the
    clock the user is speaking in regardless of server timezone."""
    now = (reference or datetime.now(timezone.utc)).astimezone(IST)
    token = (relative or "").strip().lower()

    if token in {"today", "aaj", "ivattu"}:
        start = now
        end = datetime.combine(now.date(), time(23, 59), tzinfo=IST)
        return ResolvedWindow(
            start.astimezone(timezone.utc), end.astimezone(timezone.utc),
            assumed=False, description="today (IST)",
        )

    if token in {"tomorrow", "kal", "naale"}:
        day = now.date() + timedelta(days=1)
        start = datetime.combine(day, time(0, 0), tzinfo=IST)
        end = datetime.combine(day, time(23, 59), tzinfo=IST)
        return ResolvedWindow(
            start.astimezone(timezone.utc), end.astimezone(timezone.utc),
            assumed=False, description="tomorrow (IST)",
        )

    if token in {"tonight", "night"}:
        start = datetime.combine(now.date(), time(18, 0), tzinfo=IST)
        end = datetime.combine(now.date() + timedelta(days=1), time(6, 0), tzinfo=IST)
        return ResolvedWindow(
            start.astimezone(timezone.utc), end.astimezone(timezone.utc),
            assumed=False, description="tonight (IST)",
        )

    # FR-A4.2: nothing said about time, so we assume — and flag it.
    start_utc = now.astimezone(timezone.utc)
    return ResolvedWindow(
        start_utc,
        start_utc + timedelta(hours=default_hours),
        assumed=True,
        description=f"next {default_hours} hours (assumed)",
    )


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lon2 - lon1)
    a = (
        math.sin(d_phi / 2) ** 2
        + math.cos(p1) * math.cos(p2) * math.sin(d_lambda / 2) ** 2
    )
    return round(2 * EARTH_RADIUS_KM * math.asin(math.sqrt(a)), 3)


def bearing_deg(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Initial great-circle bearing, degrees clockwise from true north."""
    p1, p2 = math.radians(lat1), math.radians(lat2)
    d_lambda = math.radians(lon2 - lon1)
    x = math.sin(d_lambda) * math.cos(p2)
    y = math.cos(p1) * math.sin(p2) - math.sin(p1) * math.cos(p2) * math.cos(d_lambda)
    return round((math.degrees(math.atan2(x, y)) + 360) % 360, 1)


COMPASS_POINTS = [
    "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
    "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
]


def compass_direction(bearing: float) -> str:
    """NFR-U2 — 'north-east' is usable at sea in a way that '43.7°' is not."""
    return COMPASS_POINTS[int((bearing + 11.25) % 360 / 22.5)]