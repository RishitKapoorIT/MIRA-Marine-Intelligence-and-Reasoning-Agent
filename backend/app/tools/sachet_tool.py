"""NDMA SACHET hazard alerts (EI-5).

Two halves, deliberately in one file:

  * fetch/parse — used by workers/sachet_poll.py on a schedule.
  * read_active_alerts — used in the request path by the agent layer.

Only the read half is ever called during a conversation turn. The parse half
does no LLM work of any kind: FR-C4.2 requires hazard alerts to be
deterministically retrieved and never inferred, so this is plain XML parsing
with no model in the loop.

CAP COORDINATE ORDER: CAP 1.2 <polygon> is a space-separated list of
"latitude,longitude" pairs. WKT and GeoJSON are longitude-first. The swap in
_cap_polygon_to_wkt is therefore load-bearing — getting it wrong silently
relocates every alert into the wrong hemisphere rather than raising anything.
"""

from __future__ import annotations

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

CAP_NS = {"cap": "urn:oasis:names:tc:emergency:cap:1.2"}
ATTRIBUTION = "Hazard alerts from NDMA SACHET (IMD / INCOIS / CWC / GSI)"


def _text(element: ET.Element | None, path: str) -> str | None:
    if element is None:
        return None
    found = element.find(path, CAP_NS)
    return found.text.strip() if found is not None and found.text else None


def _cap_polygon_to_wkt(polygon_text: str) -> str | None:
    """CAP 'lat,lon lat,lon ...' -> WKT 'POLYGON((lon lat, ...))'."""
    pairs = polygon_text.split()
    coords: list[str] = []
    for pair in pairs:
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


def _enum_or_unknown(enum_cls, raw: str | None):
    if raw is None:
        return enum_cls.UNKNOWN
    try:
        return enum_cls(raw.strip().capitalize())
    except ValueError:
        return enum_cls.UNKNOWN


def parse_cap_alert(xml_text: str) -> dict[str, Any] | None:
    """Parse one CAP 1.2 document into Alert-shaped fields.

    Returns None only when the document is unusable. A missing polygon is not
    unusable — the alert is still recorded with area_wkt=None so it can be
    listed by area description, because dropping a live cyclone warning
    because its geometry failed to parse is the worse failure.
    """
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError:
        return None

    identifier = _text(root, "cap:identifier")
    if not identifier:
        return None

    info = root.find("cap:info", CAP_NS)
    if info is None:
        return None

    area = info.find("cap:area", CAP_NS)
    polygons: list[str] = []
    if area is not None:
        for poly in area.findall("cap:polygon", CAP_NS):
            if poly.text:
                wkt = _cap_polygon_to_wkt(poly.text)
                if wkt:
                    polygons.append(wkt.replace("POLYGON", "").strip())

    area_wkt = f"MULTIPOLYGON({', '.join(polygons)})" if polygons else None

    return {
        "cap_identifier": identifier,
        "cap_sent_at": parse_iso(_text(root, "cap:sent")),
        "hazard_type": _text(info, "cap:event") or "Unknown",
        "severity": _enum_or_unknown(CapSeverity, _text(info, "cap:severity")),
        "urgency": _enum_or_unknown(CapUrgency, _text(info, "cap:urgency")),
        "certainty": _enum_or_unknown(CapCertainty, _text(info, "cap:certainty")),
        # FR-F5.7 — original agency wording, stored verbatim and never
        # overwritten by a translation.
        "headline": _text(info, "cap:headline"),
        "description": _text(info, "cap:description"),
        "instruction": _text(info, "cap:instruction"),
        "original_language": (_text(info, "cap:language") or "en").split("-")[0],
        "originating_agency": _text(info, "cap:senderName") or _text(root, "cap:sender"),
        "area_description": _text(area, "cap:areaDesc") if area is not None else None,
        "area_wkt": area_wkt,
        "onset_at": parse_iso(_text(info, "cap:onset")),
        "effective_at": parse_iso(_text(info, "cap:effective")),
        "expires_at": parse_iso(_text(info, "cap:expires")),
    }


def extract_feed_links(rss_text: str) -> list[str]:
    """Pull CAP document URLs out of the SACHET RSS index."""
    try:
        root = ET.fromstring(rss_text)
    except ET.ParseError:
        return []

    links: list[str] = []
    for item in root.iter("item"):
        link = item.find("link")
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
    """Request-path read. Pure PostGIS query — no HTTP, no model."""
    center = WKTElement(f"POINT({lon} {lat})", srid=SRID)
    now = datetime.now(timezone.utc)
    within = func.ST_DWithin(Alert.area_geom, center, radius_km * 1000)

    stmt = select(Alert).where(within)

    if include_expired:
        cutoff = now - timedelta(days=expired_retention_days)
        stmt = stmt.where(or_(Alert.expires_at.is_(None), Alert.expires_at >= cutoff))
    else:
        stmt = stmt.where(or_(Alert.expires_at.is_(None), Alert.expires_at > now))

    stmt = stmt.order_by(Alert.severity, Alert.effective_at.desc())
    return list((await db.execute(stmt)).scalars().all())