"""PFZ zone derivation: classified points -> zone polygons.

Pure functions. No network, no database, no scheduler — which is the point,
because FR-E1.7 (zone count is an output, never an input) and FR-E1.8 (an
empty result is stated plainly, never filled in) are the two claims most worth
testing directly, and RK-9 says the thresholds behind them will be retuned.

Nothing here accepts a target zone count. The pipeline thresholds, clusters
what qualifies, discards clusters below the configured minimum area, and
reports however many remain.
"""

from __future__ import annotations

import logging
import math
from dataclasses import dataclass, field

import numpy as np
from scipy import ndimage
from shapely.geometry import MultiPolygon, box
from shapely.ops import unary_union

from app.core.constants import EmptyReason
from app.core.thresholds import thresholds
from app.workers.pfz_client import Prediction

logger = logging.getLogger(__name__)

QUALIFYING_CLASSES = {"BEST", "GOOD"}
DEG_KM = 111.32  # length of one degree of latitude, km


@dataclass
class ZoneCandidate:
    polygon_wkt: str
    centroid_lat: float
    centroid_lon: float
    area_km2: float
    zone_class: str
    confidence: float | None
    point_count: int
    mean_sst_c: float | None = None
    mean_current_speed_ms: float | None = None


@dataclass
class DerivationResult:
    zones: list[ZoneCandidate] = field(default_factory=list)
    empty_reason: EmptyReason | None = None
    qualifying_points: int = 0
    clusters_found: int = 0
    clusters_discarded_small: int = 0

    @property
    def zone_count(self) -> int:
        return len(self.zones)


def cell_area_km2(latitude: float, spacing_deg: float) -> float:
    """Area of one grid cell. Longitude degrees shrink by cos(latitude)."""
    height = spacing_deg * DEG_KM
    width = spacing_deg * DEG_KM * math.cos(math.radians(latitude))
    return height * width


def derive_zones(
    predictions: list[Prediction],
    coverage_fraction: float,
    *,
    sst_by_point: dict[tuple[float, float], float] | None = None,
    current_by_point: dict[tuple[float, float], float] | None = None,
) -> DerivationResult:
    """Threshold, cluster, filter by area.

    coverage_fraction distinguishes the two empty cases required by FR-E1.9:
    below the configured minimum we could not see enough ocean
    (INSUFFICIENT_COVERAGE); above it, nothing qualified and that is a real
    finding (NO_QUALIFYING_CONDITIONS).
    """
    cfg = thresholds.pfz
    spacing = cfg.grid.spacing_deg
    min_coverage = getattr(cfg, "min_coverage_fraction", 0.3)

    if coverage_fraction < min_coverage:
        logger.warning(
            "Coverage %.1f%% below minimum %.1f%%", coverage_fraction * 100,
            min_coverage * 100,
        )
        return DerivationResult(empty_reason=EmptyReason.INSUFFICIENT_COVERAGE)

    qualifying = [p for p in predictions if p.zone_class.upper() in QUALIFYING_CLASSES]
    if not qualifying:
        return DerivationResult(empty_reason=EmptyReason.NO_QUALIFYING_CONDITIONS)

    # --- Rasterise onto the grid so connected-component labelling can run ---
    lats = sorted({round(p.latitude, 4) for p in predictions})
    lons = sorted({round(p.longitude, 4) for p in predictions})
    lat_index = {v: i for i, v in enumerate(lats)}
    lon_index = {v: i for i, v in enumerate(lons)}

    mask = np.zeros((len(lats), len(lons)), dtype=bool)
    by_cell: dict[tuple[int, int], Prediction] = {}
    for p in qualifying:
        i = lat_index[round(p.latitude, 4)]
        j = lon_index[round(p.longitude, 4)]
        mask[i, j] = True
        by_cell[(i, j)] = p

    # 4-connectivity: diagonal-only touching does not make one fishing ground.
    labels, count = ndimage.label(mask)

    zones: list[ZoneCandidate] = []
    discarded = 0

    for label_id in range(1, count + 1):
        cells = list(zip(*np.where(labels == label_id)))
        boxes = []
        area = 0.0
        classes: list[str] = []
        confidences: list[float] = []
        ssts: list[float] = []
        currents: list[float] = []

        for i, j in cells:
            lat, lon = lats[i], lons[j]
            half = spacing / 2
            boxes.append(box(lon - half, lat - half, lon + half, lat + half))
            area += cell_area_km2(lat, spacing)

            pred = by_cell[(i, j)]
            classes.append(pred.zone_class.upper())
            if pred.confidence is not None:
                confidences.append(pred.confidence)
            if sst_by_point and (key := (round(lat, 4), round(lon, 4))) in sst_by_point:
                ssts.append(sst_by_point[key])
            if current_by_point and (key := (round(lat, 4), round(lon, 4))) in current_by_point:
                currents.append(current_by_point[key])

        # FR-E1.7 — clusters below the floor are discarded, not merged or
        # padded to reach some desired number.
        if area < cfg.min_zone_area_km2:
            discarded += 1
            continue

        merged = unary_union(boxes)
        if merged.geom_type == "MultiPolygon":
            merged = max(merged.geoms, key=lambda g: g.area)
        centroid = merged.centroid

        zones.append(
            ZoneCandidate(
                polygon_wkt=merged.wkt,
                centroid_lat=round(centroid.y, 6),
                centroid_lon=round(centroid.x, 6),
                area_km2=round(area, 2),
                # BEST wins only if any cell in the cluster is BEST.
                zone_class="BEST" if "BEST" in classes else "GOOD",
                confidence=(
                    round(sum(confidences) / len(confidences), 4) if confidences else None
                ),
                point_count=len(cells),
                mean_sst_c=round(sum(ssts) / len(ssts), 2) if ssts else None,
                mean_current_speed_ms=(
                    round(sum(currents) / len(currents), 3) if currents else None
                ),
            )
        )

    zones.sort(key=lambda z: z.area_km2, reverse=True)

    result = DerivationResult(
        zones=zones,
        qualifying_points=len(qualifying),
        clusters_found=count,
        clusters_discarded_small=discarded,
    )

    # FR-E1.8 — every cluster fell below the floor. Still a real finding, and
    # still reported as zero rather than by relaxing the floor to produce one.
    if not zones:
        result.empty_reason = EmptyReason.NO_QUALIFYING_CONDITIONS

    logger.info(
        "PFZ derivation: %d qualifying points, %d clusters, %d discarded, %d zones",
        len(qualifying), count, discarded, len(zones),
    )
    return result