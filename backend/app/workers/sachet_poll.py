"""NDMA SACHET hazard-alert poller (EI-5).

Runs on a schedule, outside the request path (NFR-P6). Fetches the CAP index,
retrieves and parses each alert document, upserts by CAP identifier, purges
alerts past their retention window (FR-F5.9), and records feed health in
source_status.

That last part is what lifts the FR-E2.4 CAUTION cap: until this worker has
succeeded at least once, there is no source_status row for sachet_cap, the
verdict engine correctly treats the hazard feed as unreachable, and no answer
can ever be SAFE. That is deliberate — a hazard feed that has never been read
is not an all-clear — but it does mean this worker must run before any demo.

Idempotent by construction: re-polling the same feed upserts on
cap_identifier rather than inserting duplicates, so it is safe to run on a
short interval or to re-run after a partial failure.
"""

from __future__ import annotations

import argparse
import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from shapely import wkt as shapely_wkt
from shapely.geometry import MultiPolygon
from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import SourceId
from app.core.config import settings
from app.core.thresholds import thresholds
from app.db.models import Alert
from app.db.session import AsyncSessionLocal, dispose_engine
from app.tools import sachet_tool
from app.tools.base import (
    DataKind,
    SourceEnvelope,
    fetch_text,
    record_source_result,
)

logger = logging.getLogger(__name__)

MAX_CONCURRENT_FETCHES = 5
# Guards against a runaway or malformed index page.
MAX_DOCUMENTS_PER_POLL = 200


def normalise_geometry(area_wkt: str | None) -> str | None:
    """Return valid MULTIPOLYGON WKT, or None.

    CAP polygons are hand-drawn by agency operators and self-intersecting
    rings do occur in practice. PostGIS geography rejects those, so a bad
    ring would fail the whole insert. buffer(0) is the standard repair; if it
    cannot be repaired we return None and keep the alert with its area
    description only, because dropping a live cyclone warning over a
    malformed polygon is the worse outcome.
    """
    if not area_wkt:
        return None

    try:
        geom = shapely_wkt.loads(area_wkt)
    except Exception as exc:
        logger.warning("Unparseable alert geometry, storing without polygon: %s", exc)
        return None

    if not geom.is_valid:
        try:
            geom = geom.buffer(0)
        except Exception:
            return None

    if geom.is_empty:
        return None

    # buffer(0) can collapse a MultiPolygon to a Polygon; the column is
    # MULTIPOLYGON, so re-wrap.
    if geom.geom_type == "Polygon":
        geom = MultiPolygon([geom])
    elif geom.geom_type != "MultiPolygon":
        logger.warning("Alert geometry repaired to %s, discarding", geom.geom_type)
        return None

    return geom.wkt


def to_alert_values(parsed: dict[str, Any]) -> dict[str, Any]:
    """Parsed CAP fields -> Alert column values. Pure; no DB, no I/O.

    Keys prefixed with "_" are parser provenance rather than columns; they are
    folded into raw_cap so that a geocode-only alert records WHY it has no
    geometry, and a substituted circle radius is disclosed rather than hidden.
    """
    values = {
        k: v for k, v in parsed.items() if k != "area_wkt" and not k.startswith("_")
    }
    clean_wkt = normalise_geometry(parsed.get("area_wkt"))
    values["area_geom"] = f"SRID=4326;{clean_wkt}" if clean_wkt else None
    values["raw_cap"] = {
        "geometry_source": parsed.get("_geometry_source"),
        "geocodes": parsed.get("_geocodes") or [],
        "circle_radius_expanded": parsed.get("_circle_radius_expanded", False),
    }
    values["ingested_at"] = datetime.now(timezone.utc)
    return values


async def _fetch_and_parse(url: str, semaphore: asyncio.Semaphore) -> dict | None:
    async with semaphore:
        text, error = await fetch_text(url)
    if error or not text:
        logger.warning("CAP document fetch failed (%s): %s", url, error)
        return None

    parsed = sachet_tool.parse_cap_alert(text)
    if parsed is None:
        logger.warning("CAP document did not parse: %s", url)
    return parsed


async def upsert_alerts(db: AsyncSession, rows: list[dict[str, Any]]) -> int:
    """Upsert on cap_identifier.

    Agencies reissue alerts under the same identifier as conditions evolve, so
    an existing row is updated rather than skipped — a stale expiry time on a
    live warning would be worse than a duplicate.
    """
    if not rows:
        return 0

    stmt = pg_insert(Alert).values(rows)
    update_cols = {
        c.name: stmt.excluded[c.name]
        for c in Alert.__table__.columns
        if c.name not in ("id", "cap_identifier")
    }
    stmt = stmt.on_conflict_do_update(
        index_elements=["cap_identifier"], set_=update_cols
    )
    await db.execute(stmt)
    return len(rows)


async def purge_expired(db: AsyncSession) -> int:
    """FR-F5.9 — expired alerts stay browsable for the retention window, then go."""
    cutoff = datetime.now(timezone.utc) - timedelta(
        days=thresholds.alerts.expired_retention_days
    )
    result = await db.execute(
        delete(Alert).where(Alert.expires_at.is_not(None), Alert.expires_at < cutoff)
    )
    return result.rowcount or 0


async def poll_once(db: AsyncSession) -> dict[str, Any]:
    """One full poll cycle. Returns a summary for logging and tests."""
    envelope = await sachet_tool.fetch_alert_feed()

    if not envelope.available:
        # §7.8 — record the failure so the verdict engine and the alerts view
        # both report the feed as unreachable rather than showing an empty list.
        await record_source_result(db, envelope)
        logger.error("SACHET feed unavailable: %s", envelope.unavailable_reason)
        return {
            "feed_available": False,
            "reason": envelope.unavailable_reason,
            "fetched": 0,
            "upserted": 0,
            "purged": 0,
        }

    links = envelope.values.get("links", [])[:MAX_DOCUMENTS_PER_POLL]
    semaphore = asyncio.Semaphore(MAX_CONCURRENT_FETCHES)
    parsed_docs = await asyncio.gather(
        *(_fetch_and_parse(url, semaphore) for url in links)
    )

    rows: list[dict[str, Any]] = []
    seen: set[str] = set()
    for parsed in parsed_docs:
        if parsed is None:
            continue
        # A feed can list the same identifier twice; a single INSERT statement
        # cannot touch the same conflict target row twice, so dedupe here.
        if parsed["cap_identifier"] in seen:
            continue
        seen.add(parsed["cap_identifier"])
        rows.append(to_alert_values(parsed))

    upserted = await upsert_alerts(db, rows)
    purged = await purge_expired(db)

    # Only recorded as a success once the documents are actually stored.
    await record_source_result(db, envelope)
    await db.commit()

    logger.info(
        "SACHET poll: %d links, %d parsed, %d upserted, %d purged",
        len(links),
        len(rows),
        upserted,
        purged,
    )
    return {
        "feed_available": True,
        "links": len(links),
        "fetched": len(links),
        "parsed": len(rows),
        "upserted": upserted,
        "purged": purged,
    }


async def run_once() -> dict[str, Any]:
    async with AsyncSessionLocal() as db:
        try:
            return await poll_once(db)
        except Exception:
            await db.rollback()
            raise


async def run_loop(interval_minutes: int) -> None:
    """Minimal scheduler. A single failing cycle must not kill the loop."""
    while True:
        try:
            summary = await run_once()
            logger.info("Poll complete: %s", summary)
        except Exception:
            logger.exception("Poll cycle failed; continuing")
        await asyncio.sleep(interval_minutes * 60)


async def _main() -> None:
    parser = argparse.ArgumentParser(description="Poll the NDMA SACHET CAP feed")
    parser.add_argument("--loop", action="store_true", help="Poll continuously")
    parser.add_argument(
        "--interval",
        type=int,
        default=settings.sachet_poll_interval_minutes,
        help="Minutes between polls in --loop mode",
    )
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s"
    )

    try:
        if args.loop:
            await run_loop(args.interval)
        else:
            summary = await run_once()
            print(summary)
    finally:
        await dispose_engine()


if __name__ == "__main__":
    asyncio.run(_main())