"""NDMA SACHET hazard alerts (EI-5).

Two halves, deliberately in one file:

  * fetch/parse - used by workers/sachet_poll.py on a schedule.
  * read_active_alerts - used in the request path by the agent layer.

Only the read half is ever called during a conversation turn. The parse half
does no LLM work: FR-C4.2 requires hazard alerts to be deterministically
retrieved and never inferred, so this is plain XML parsing.

PARSING IS NAMESPACE-AGNOSTIC. Matching on a hardcoded CAP 1.2 namespace
means a feed that emits CAP 1.1, or no namespace, silently yields nothing.
Element lookup here is by local tag name so any of those work.

CAP AREA FORMS. <area> may carry <polygon>, <circle>, <geocode>, or only an
<areaDesc> - polygon is OPTIONAL in the standard, and NDMA alerts are largely
district-based. All of polygon and circle are converted to geometry; geocode
is preserved in raw_cap but cannot be geolocated without a district boundary
layer (FR-C5, Iteration 2).

COORDINATE ORDER. CAP polygon and circle coordinates are "latitude,longitude".
WKT is longitude-first. The swap is load-bearing: getting it wrong relocates
every alert without raising anything.
"""

from __future__ import annotations

import math
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from typing import Any

from geoalchemy2 import WKTElement
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.constants import SRID, CapCertainty, CapSeverity, CapUrgency, SourceId
from app.db.models import Alert
from app.tools.base import DataKind, SourceEnvelope, fetch_text, parse_iso

ATTRIBUTION = "Hazard alerts from NDMA SACHET (IMD / INCOIS / CWC / GSI)"

# A CAP circle of radius 0 means a single point. The area_geom column is
# MULTIPOLYGON and a zero-area polygon is invalid, so such alerts are given a
# small footprint rather than being dropped. Recorded in raw_cap as expanded.
MIN_CIRCLE_RADIUS_KM = 1.0
CIRCLE_VERTICES = 48
EARTH_RADIUS_KM = 6371.0088


# --- Namespace-agnostic element access ---------------------------------------

def _local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def _children(element: ET.Element | None, name: str) -> list[ET.Element]:
    if element is None:
        return []
    return [c for c in element if _local(c.tag) == name]


def _child(element: ET.Element | None, name: str) -> ET.Element | None:
    found = _children(element, name)
    return found[0] if found else None


def _text(element: ET.Element | None, name: str) -> str | None:
    child = _child(element, name)
    return child.text.strip() if child is not None and child.text else None


# --- Geometry ----------------------------------------------------------------

def _cap_polygon_to_wkt(polygon_text: str) -> str | None:
    """CAP 'lat,lon lat,lon ...' -> WKT 'POLYGON((lon lat, ...))'."""
    coords: list[str] = []
    for pair in polygon_text.split():
        try:
            lat_str, lon_str = pair.split(",")
            lat, lon = float(lat_str), float(lon_str)
        except ValueError:
            return None
        if not (-90 <= lat <= 90 and -180 <= lon <= 180):
            return None
        coords.append(f"{lon} {lat}")

    if len(coords) < 4:
        return None
    if coords[0] != coords[-1]:
        coords.append(coords[0])  # CAP permits an unclosed ring; WKT does not
    return f"POLYGON(({', '.join(coords)}))"


def _cap_circle_to_wkt(circle_text: str) -> tuple[str | None, bool]:
    """CAP '<lat>,<lon> <radius_km>' -> an approximating polygon.

    Returns (wkt, was_expanded). was_expanded is True when a zero radius was
    replaced by MIN_CIRCLE_RADIUS_KM, so the substitution can be disclosed
    rather than passed off as the agency's own footprint.
    """
    parts = circle_text.split()
    if len(parts) != 2:
        return None, False

    try:
        lat_str, lon_str = parts[0].split(",")
        lat, lon = float(lat_str), float(lon_str)
        radius_km = float(parts[1])
    except ValueError:
        return None, False

    if not (-90 <= lat <= 90 and -180 <= lon <= 180) or radius_km < 0:
        return None, False

    expanded = False
    if radius_km < MIN_CIRCLE_RADIUS_KM:
        radius_km = MIN_CIRCLE_RADIUS_KM
        expanded = True

    # Equirectangular offset. Adequate at alert scale; longitude degrees are
    # scaled by cos(lat) so the circle is not stretched away from the equator.
    d_lat = math.degrees(radius_km / EARTH_RADIUS_KM)
    cos_lat = math.cos(math.radians(lat))
    d_lon = d_lat / cos_lat if abs(cos_lat) > 1e-6 else d_lat

    coords: list[str] = []
    for i in range(CIRCLE_VERTICES):
        theta = 2 * math.pi * i / CIRCLE_VERTICES
        p_lat = max(-90.0, min(90.0, lat + d_lat * math.sin(theta)))
        p_lon = lon + d_lon * math.cos(theta)
        coords.append(f"{p_lon:.6f} {p_lat:.6f}")
    coords.append(coords[0])

    return f"POLYGON(({', '.join(coords)}))", expanded


def _enum_or_unknown(enum_cls, raw: str | None):
    if raw is None:
        return enum_cls.UNKNOWN
    try:
        return enum_cls(raw.strip().capitalize())
    except ValueError:
        return enum_cls.UNKNOWN


def _select_info(root: ET.Element) -> ET.Element | None:
    """CAP alerts often carry one <info> per language. Prefer English; fall
    back to the first block so a non-English-only alert is never dropped."""
    infos = _children(root, "info")
    if not infos:
        return None
    for info in infos:
        lang = (_text(info, "language") or "").lower()
        if lang.startswith("en"):
            return info
    return infos[0]


def parse_cap_alert(xml_text: str) -> dict[str, Any] | None:
    """Parse one CAP document into Alert-shaped fields.

    Returns None only when the document is unusable. A missing or
    unconvertible geometry is NOT unusable - the alert is recorded with
    area_wkt=None so it can still be listed by area description. Dropping a
    live cyclone warning because its polygon failed to parse is the worse
    failure.
    """
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError:
        return None

    identifier = _text(root, "identifier")
    if not identifier:
        return None

    info = _select_info(root)
    if info is None:
        return None

    # Every <area> in the chosen <info>, not just the first.
    areas = _children(info, "area")
    rings: list[str] = []
    geocodes: list[dict[str, str | None]] = []
    descriptions: list[str] = []
    circle_expanded = False

    for area in areas:
        desc = _text(area, "areaDesc")
        if desc:
            descriptions.append(desc)

        for poly in _children(area, "polygon"):
            if poly.text:
                wkt = _cap_polygon_to_wkt(poly.text.strip())
                if wkt:
                    rings.append(wkt.replace("POLYGON", "").strip())

        for circle in _children(area, "circle"):
            if circle.text:
                wkt, expanded = _cap_circle_to_wkt(circle.text.strip())
                if wkt:
                    rings.append(wkt.replace("POLYGON", "").strip())
                    circle_expanded = circle_expanded or expanded

        for geocode in _children(area, "geocode"):
            geocodes.append(
                {
                    "valueName": _text(geocode, "valueName"),
                    "value": _text(geocode, "value"),
                }
            )

    area_wkt = f"MULTIPOLYGON({', '.join(rings)})" if rings else None

    return {
        "cap_identifier": identifier,
        "cap_sent_at": parse_iso(_text(root, "sent")),
        "hazard_type": _text(info, "event") or "Unknown",
        "severity": _enum_or_unknown(CapSeverity, _text(info, "severity")),
        "urgency": _enum_or_unknown(CapUrgency, _text(info, "urgency")),
        "certainty": _enum_or_unknown(CapCertainty, _text(info, "certainty")),
        # FR-F5.7 - original agency wording, stored verbatim, never
        # overwritten by a translation.
        "headline": _text(info, "headline"),
        "description": _text(info, "description"),
        "instruction": _text(info, "instruction"),
        "original_language": (_text(info, "language") or "en").split("-")[0],
        "originating_agency": _text(info, "senderName") or _text(root, "sender"),
        "area_description": "; ".join(descriptions) if descriptions else None,
        "area_wkt": area_wkt,
        "onset_at": parse_iso(_text(info, "onset")),
        "effective_at": parse_iso(_text(info, "effective")),
        "expires_at": parse_iso(_text(info, "expires")),
        # Provenance for anything we could not turn into geometry, plus a note
        # when a circle radius was substituted.
        "_geocodes": geocodes,
        "_geometry_source": (
            "polygon_or_circle" if rings else ("geocode_only" if geocodes else "none")
        ),
        "_circle_radius_expanded": circle_expanded,
    }


def extract_feed_links(rss_text: str) -> list[str]:
    """Pull CAP document URLs out of the SACHET RSS index."""
    try:
        root = ET.fromstring(rss_text)
    except ET.ParseError:
        return []

    links: list[str] = []
    for item in root.iter():
        if _local(item.tag) != "item":
            continue
        link = _child(item, "link")
        if link is not None and link.text:
            links.append(link.text.strip())
    return links


async def fetch_alert_feed() -> SourceEnvelope:
    """Called by workers/sachet_poll.py, never from the request path."""
    text, error = await fetch_text(settings.sachet_feed_url)

    if error or not text:
        return SourceEnvelope.unavailable(
            SourceId.SACHET_CAP.value,
            DataKind.OBSERVATION,
            error or "Empty response from SACHET feed",
        )

    return SourceEnvelope(
        source_id=SourceId.SACHET_CAP.value,
        kind=DataKind.OBSERVATION,
        valid_at=datetime.now(timezone.utc),
        values={"links": extract_feed_links(text), "raw_length": len(text)},
        attribution=ATTRIBUTION,
    )


async def read_active_alerts(
    db: AsyncSession,
    lat: float,
    lon: float,
    radius_km: float,
    include_expired: bool = False,
    expired_retention_days: int = 7,
) -> list[Alert]:
    """Request-path read within a radius. Pure PostGIS - no HTTP, no model.

    Alerts with no geometry are excluded here by definition: an alert that
    cannot be placed cannot be matched to a radius. Use read_ungeolocated_alerts
    for those, and surface them separately rather than losing them.
    """
    center = WKTElement(f"POINT({lon} {lat})", srid=SRID)
    now = datetime.now(timezone.utc)

    stmt = select(Alert).where(
        Alert.area_geom.is_not(None),
        func.ST_DWithin(Alert.area_geom, center, radius_km * 1000),
    )

    if include_expired:
        cutoff = now - timedelta(days=expired_retention_days)
        stmt = stmt.where(or_(Alert.expires_at.is_(None), Alert.expires_at >= cutoff))
    else:
        stmt = stmt.where(or_(Alert.expires_at.is_(None), Alert.expires_at > now))

    stmt = stmt.order_by(Alert.severity, Alert.effective_at.desc())
    return list((await db.execute(stmt)).scalars().all())


async def read_ungeolocated_alerts(db: AsyncSession, limit: int = 50) -> list[Alert]:
    """Active alerts that carry no usable geometry - typically geocode-only
    district alerts.

    These cannot be radius-matched, so without this they would be stored and
    never shown. Presenting them separately, labelled as not location-filtered,
    is more honest than an empty list that reads as an all-clear.
    """
    now = datetime.now(timezone.utc)
    stmt = (
        select(Alert)
        .where(Alert.area_geom.is_(None))
        .where(or_(Alert.expires_at.is_(None), Alert.expires_at > now))
        .order_by(Alert.severity, Alert.effective_at.desc())
        .limit(limit)
    )
    return list((await db.execute(stmt)).scalars().all())