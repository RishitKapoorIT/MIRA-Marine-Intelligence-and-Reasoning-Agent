"""PFZ batch job.

Sequences: grid -> real features -> pfz-api classification -> clustering ->
atomic publish. Runs on a schedule, entirely outside the request path
(NFR-P6, FR-E1.2).

ATOMIC PUBLISH (FR-E1.14): the new generation is built with status='building',
which no reader queries. Only once every zone is written does a single
transaction demote the previous published row to 'superseded' and promote the
new one. The uq_pfz_one_published partial index makes a double-publish
impossible at the database level rather than by convention.

FAILURE (FR-E1.15): a failed run marks its own generation 'failed' and leaves
the previously published one untouched. Yesterday's zones with an honest
observation date beat no zones at all.

    python -m app.workers.pfz_batch
    python -m app.workers.pfz_batch --dry-run   # no writes
"""

from __future__ import annotations

import argparse
import asyncio
import logging
from datetime import datetime, timezone

from geoalchemy2 import WKTElement
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import SRID, GenerationStatus
from app.core.thresholds import thresholds
from app.db.models import PfzGeneration, PfzZone
from app.db.session import AsyncSessionLocal, dispose_engine
from app.workers import pfz_client, pfz_derive, pfz_features

logger = logging.getLogger(__name__)


async def _prune_generations(db: AsyncSession) -> int:
    """Keep current + one known-good, per the agreed retention."""
    keep = thresholds.pfz.generations_retained
    stmt = (
        select(PfzGeneration)
        .where(PfzGeneration.status != GenerationStatus.PUBLISHED)
        .order_by(PfzGeneration.computed_at.desc())
    )
    rows = list((await db.execute(stmt)).scalars().all())
    removed = 0
    for generation in rows[max(0, keep - 1) :]:
        await db.delete(generation)  # zones cascade
        removed += 1
    return removed


async def run_batch(db: AsyncSession, dry_run: bool = False) -> dict:
    started = datetime.now(timezone.utc)

    generation = PfzGeneration(
        status=GenerationStatus.BUILDING,
        composite_days=thresholds.pfz.composite_days,
        grid_bbox=thresholds.pfz.grid.bbox,
        grid_spacing_deg=thresholds.pfz.grid.spacing_deg,
        thresholds_snapshot={
            "min_zone_area_km2": thresholds.pfz.min_zone_area_km2,
            "salinity_constant_psu": thresholds.pfz.salinity_constant_psu,
        },
    )
    if not dry_run:
        db.add(generation)
        await db.flush()

    try:
        # --- 1. Real features -------------------------------------------
        batch = await pfz_features.build_features()
        generation.points_evaluated = batch.points_requested
        generation.coverage_fraction = round(batch.coverage_fraction, 4)
        generation.observation_date = batch.observation_date
        # WHERE we got data, not just how much (see models.PfzGeneration).
        generation.covered_cells = batch.covered_cells()

        if not batch.points:
            raise RuntimeError(
                f"No grid point returned data ({len(batch.errors)} chunk errors)"
            )

        # --- 2. Classify via services/pfz-api ---------------------------
        predictions, errors = await pfz_client.classify(batch.points)
        if not predictions:
            raise RuntimeError(f"Classification returned nothing: {errors}")

        # --- 3. Cluster --------------------------------------------------
        sst_by_point = {
            (round(p.latitude, 4), round(p.longitude, 4)): p.temperature
            for p in batch.points
        }
        current_by_point = {
            (round(p.latitude, 4), round(p.longitude, 4)): (
                p.eastward_current**2 + p.northward_current**2
            )
            ** 0.5
            for p in batch.points
        }

        derived = pfz_derive.derive_zones(
            predictions,
            batch.coverage_fraction,
            sst_by_point=sst_by_point,
            current_by_point=current_by_point,
        )

        generation.zone_count = derived.zone_count
        generation.empty_reason = derived.empty_reason

        summary = {
            "points_requested": batch.points_requested,
            "points_with_data": batch.points_with_data,
            "coverage_fraction": round(batch.coverage_fraction, 4),
            "covered_cells": len(batch.covered_cells()),
            "predictions": len(predictions),
            "qualifying_points": derived.qualifying_points,
            "clusters_found": derived.clusters_found,
            "clusters_discarded_small": derived.clusters_discarded_small,
            "zone_count": derived.zone_count,
            "empty_reason": (
                derived.empty_reason.value if derived.empty_reason else None
            ),
            "observation_date": (
                batch.observation_date.isoformat() if batch.observation_date else None
            ),
            "feature_errors": batch.errors,
            "classification_errors": errors,
        }

        if dry_run:
            logger.info("Dry run complete: %s", summary)
            return {"status": "dry_run", **summary}

        # --- 4. Write zones into the unpublished generation --------------
        provenance = batch.provenance()
        for zone in derived.zones:
            db.add(
                PfzZone(
                    generation_id=generation.id,
                    geom=WKTElement(zone.polygon_wkt, srid=SRID),
                    centroid=WKTElement(
                        f"POINT({zone.centroid_lon} {zone.centroid_lat})", srid=SRID
                    ),
                    area_km2=zone.area_km2,
                    point_count=zone.point_count,
                    zone_class=zone.zone_class,
                    confidence=zone.confidence,
                    mean_sst_c=zone.mean_sst_c,
                    mean_chlorophyll_mg_m3=None,  # unavailable, not estimated
                    mean_current_speed_ms=zone.mean_current_speed_ms,
                    salinity_psu=thresholds.pfz.salinity_constant_psu,
                    feature_provenance=provenance,
                    observation_date=batch.observation_date,
                )
            )
        await db.flush()

        # --- 5. Atomic swap ----------------------------------------------
        previous = (
            await db.execute(
                select(PfzGeneration).where(
                    PfzGeneration.status == GenerationStatus.PUBLISHED
                )
            )
        ).scalar_one_or_none()
        if previous is not None:
            previous.status = GenerationStatus.SUPERSEDED

        generation.status = GenerationStatus.PUBLISHED
        generation.published_at = datetime.now(timezone.utc)

        pruned = await _prune_generations(db)
        await db.commit()

        elapsed = (datetime.now(timezone.utc) - started).total_seconds()
        logger.info("PFZ batch published in %.1fs: %s", elapsed, summary)
        return {
            "status": "published",
            "generation_id": str(generation.id),
            "pruned": pruned,
            "elapsed_seconds": round(elapsed, 1),
            **summary,
        }

    except Exception as exc:
        logger.exception("PFZ batch failed")
        if not dry_run:
            # FR-E1.15 — the previously published generation is untouched.
            generation.status = GenerationStatus.FAILED
            generation.failure_detail = str(exc)[:1000]
            await db.commit()
        return {"status": "failed", "error": str(exc)}


async def run_once(dry_run: bool = False) -> dict:
    async with AsyncSessionLocal() as db:
        try:
            return await run_batch(db, dry_run=dry_run)
        except Exception:
            await db.rollback()
            raise


async def _main() -> None:
    parser = argparse.ArgumentParser(description="Compute and publish PFZ zones")
    parser.add_argument("--dry-run", action="store_true", help="Compute without writing")
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s"
    )
    try:
        print(await run_once(dry_run=args.dry_run))
    finally:
        await dispose_engine()


if __name__ == "__main__":
    asyncio.run(_main())