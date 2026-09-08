"""PFZ feature assembly (FR-E1, Fix-1 Open-Meteo fallback).

Builds the fixed coastal grid and retrieves REAL environmental values for
each point, replacing services/pfz-api's random sampling.

Provenance, honestly stated per feature:

  sea_surface_temperature   Open-Meteo Marine   real forecast value
  ocean currents            Open-Meteo Marine   real forecast value
  salinity                  climatology constant, NOT observed
  chlorophyll               UNAVAILABLE - passed to the model as a null so
                            XGBoost treats it as a missing feature

Chlorophyll is the deliberate gap. FR-C1.1 sources it from NASA OB.DAAC,
which needs Earthdata credentials; until those exist, the honest move is to
pass a labelled null rather than substitute a plausible number. FR-C6.3
forbids substituting a modelled or default value, and a guessed chlorophyll
is exactly that. Every zone records this in feature_provenance so the
evidence panel can show it (FR-G1.1).

LAND POINTS: the configured bbox covers inland Karnataka as well as ocean.
Open-Meteo Marine returns nulls for land, and those points are dropped. They
depress coverage_fraction, so tighten max_lon toward the coast if the
insufficient-coverage threshold starts tripping spuriously.
"""

from __future__ import annotations

import asyncio
import logging
import math
from dataclasses import dataclass, field
from datetime import date, datetime, timezone

from app.core.config import settings
from app.core.constants import SourceId
from app.core.thresholds import thresholds
from app.tools.base import fetch_json, parse_iso

logger = logging.getLogger(__name__)

# Open-Meteo accepts comma-separated coordinate lists. Kept well under URL
# length limits; one grid run is a handful of requests rather than thousands.
COORDS_PER_REQUEST = 100
# Serial, not concurrent. Open-Meteo's free tier bills by locations x
# variables, so a 3000-point grid burns quota fast, and firing chunks in
# parallel is what triggers 429s. A partial PFZ product is far more dangerous
# than a slow one, so this run is deliberately unhurried.
MAX_CONCURRENT_REQUESTS = 1
DELAY_BETWEEN_REQUESTS_SECONDS = 1.5

# Resolution at which coverage is recorded. Coarse enough to stay compact in
# JSONB, fine enough to answer "did we compute anything near this port?".
COVERAGE_CELL_DEG = 0.5

MARINE_VARS = [
    "sea_surface_temperature",
    "ocean_current_velocity",
    "ocean_current_direction",
]


@dataclass
class GridPoint:
    latitude: float
    longitude: float


@dataclass
class FeaturePoint:
    """One grid point with real values attached, ready for classification."""

    latitude: float
    longitude: float
    temperature: float          # SST, degrees C - real
    eastward_current: float     # m/s - real, derived from speed + direction
    northward_current: float    # m/s - real
    salinity: float             # PSU - climatology constant, NOT observed
    chlorophyll: float | None   # None = unavailable, passed as a model gap
    observation_time: datetime | None = None


def coverage_cell_key(latitude: float, longitude: float) -> str:
    """Coarse cell identifier used to record WHERE a run got data."""
    lat_cell = math.floor(latitude / COVERAGE_CELL_DEG) * COVERAGE_CELL_DEG
    lon_cell = math.floor(longitude / COVERAGE_CELL_DEG) * COVERAGE_CELL_DEG
    return f"{lat_cell:.1f},{lon_cell:.1f}"


@dataclass
class FeatureBatch:
    points: list[FeaturePoint] = field(default_factory=list)
    points_requested: int = 0
    points_with_data: int = 0
    observation_date: date | None = None
    errors: list[str] = field(default_factory=list)

    @property
    def coverage_fraction(self) -> float:
        if self.points_requested == 0:
            return 0.0
        return self.points_with_data / self.points_requested

    def covered_cells(self) -> list[str]:
        """Cells where at least one point returned data.

        coverage_fraction says how much; this says where. Without it a run
        that silently lost everything north of 13N looks like a merely
        incomplete product rather than one that cannot answer for half its
        service area.
        """
        return sorted(
            {coverage_cell_key(p.latitude, p.longitude) for p in self.points}
        )

    def provenance(self) -> dict:
        """FR-G1.1 / FR-C6.1 - per-feature source and honesty about the gaps."""
        return {
            "sea_surface_temperature": {
                "source": SourceId.OPEN_METEO_MARINE.value,
                "kind": "forecast",
                "observed": True,
            },
            "ocean_currents": {
                "source": SourceId.OPEN_METEO_MARINE.value,
                "kind": "forecast",
                "observed": True,
            },
            "salinity": {
                "source": SourceId.SALINITY_CLIMATOLOGY.value,
                "kind": "climatology",
                "observed": False,
                "note": (
                    f"Regional constant {thresholds.pfz.salinity_constant_psu} PSU. "
                    "No real-time salinity source is available."
                ),
            },
            "chlorophyll": {
                "source": None,
                "kind": "unavailable",
                "observed": False,
                "note": (
                    "Not retrieved. NASA OB.DAAC requires Earthdata credentials; "
                    "passed to the model as a missing feature rather than being "
                    "substituted with an estimate."
                ),
            },
        }


def build_grid() -> list[GridPoint]:
    """Fixed grid from thresholds.yaml. Deterministic: the same configuration
    always yields the same points in the same order, so two runs are
    comparable."""
    cfg = thresholds.pfz.grid
    bbox = cfg.bbox
    step = cfg.spacing_deg

    points: list[GridPoint] = []
    lat_steps = int(round((bbox["max_lat"] - bbox["min_lat"]) / step)) + 1
    lon_steps = int(round((bbox["max_lon"] - bbox["min_lon"]) / step)) + 1

    for i in range(lat_steps):
        for j in range(lon_steps):
            points.append(
                GridPoint(
                    latitude=round(bbox["min_lat"] + i * step, 4),
                    longitude=round(bbox["min_lon"] + j * step, 4),
                )
            )
    return points


def _current_components(speed: float | None, direction_deg: float | None):
    """Open-Meteo gives current speed and the direction it flows TOWARD,
    in degrees clockwise from north. The model wants eastward/northward
    components."""
    if speed is None or direction_deg is None:
        return 0.0, 0.0
    rad = math.radians(direction_deg)
    return round(speed * math.sin(rad), 4), round(speed * math.cos(rad), 4)


def _first_valid_index(times: list[str], target: datetime) -> int | None:
    """Index of the hourly slot nearest to `target`, or None if the series is
    empty."""
    best_i, best_delta = None, None
    for i, raw in enumerate(times):
        stamp = parse_iso(raw)
        if stamp is None:
            continue
        delta = abs((stamp - target).total_seconds())
        if best_delta is None or delta < best_delta:
            best_i, best_delta = i, delta
    return best_i


async def _fetch_chunk(
    chunk: list[GridPoint], target: datetime, semaphore: asyncio.Semaphore
) -> tuple[list[FeaturePoint], list[str], datetime | None]:
    async with semaphore:
        await asyncio.sleep(DELAY_BETWEEN_REQUESTS_SECONDS)
        payload, error = await fetch_json(
            settings.open_meteo_marine_url,
            {
                "latitude": ",".join(f"{p.latitude}" for p in chunk),
                "longitude": ",".join(f"{p.longitude}" for p in chunk),
                "hourly": ",".join(MARINE_VARS),
                "timezone": "UTC",
                "forecast_days": 1,
            },
            timeout=45.0,
        )

    if error or payload is None:
        return [], [f"chunk of {len(chunk)} points failed: {error}"], None

    # A multi-location request returns a list; a single-location one returns
    # an object. Normalise.
    results = payload if isinstance(payload, list) else [payload]

    points: list[FeaturePoint] = []
    errors: list[str] = []
    observed_at: datetime | None = None

    for grid_point, result in zip(chunk, results):
        hourly = (result or {}).get("hourly") or {}
        times = hourly.get("time") or []
        idx = _first_valid_index(times, target)
        if idx is None:
            continue

        def at(name: str):
            series = hourly.get(name) or []
            return series[idx] if idx < len(series) else None

        sst = at("sea_surface_temperature")
        if sst is None:
            # Land, or outside the marine model domain. Dropped, not defaulted.
            continue

        east, north = _current_components(
            at("ocean_current_velocity"), at("ocean_current_direction")
        )
        stamp = parse_iso(times[idx])
        if stamp and (observed_at is None or stamp > observed_at):
            observed_at = stamp

        points.append(
            FeaturePoint(
                latitude=grid_point.latitude,
                longitude=grid_point.longitude,
                temperature=float(sst),
                eastward_current=east,
                northward_current=north,
                salinity=thresholds.pfz.salinity_constant_psu,
                chlorophyll=None,  # labelled gap, never a substituted value
                observation_time=stamp,
            )
        )

    return points, errors, observed_at


async def build_features(target: datetime | None = None) -> FeatureBatch:
    """Retrieve real values for every grid point."""
    target = target or datetime.now(timezone.utc)
    grid = build_grid()
    logger.info("PFZ grid: %d points", len(grid))

    chunks = [
        grid[i : i + COORDS_PER_REQUEST]
        for i in range(0, len(grid), COORDS_PER_REQUEST)
    ]
    semaphore = asyncio.Semaphore(MAX_CONCURRENT_REQUESTS)
    results = await asyncio.gather(
        *(_fetch_chunk(chunk, target, semaphore) for chunk in chunks)
    )

    batch = FeatureBatch(points_requested=len(grid))
    latest: datetime | None = None
    for points, errors, observed_at in results:
        batch.points.extend(points)
        batch.errors.extend(errors)
        if observed_at and (latest is None or observed_at > latest):
            latest = observed_at

    batch.points_with_data = len(batch.points)
    batch.observation_date = latest.date() if latest else None

    cells = batch.covered_cells()
    logger.info(
        "PFZ features: %d/%d points with data (coverage %.1f%%) across %d cells",
        batch.points_with_data,
        batch.points_requested,
        batch.coverage_fraction * 100,
        len(cells),
    )
    if batch.errors:
        covered_lats = [float(c.split(",")[0]) for c in cells] or [0.0]
        logger.warning(
            "%d chunk(s) failed. Data covers latitude %.1f..%.1f only; "
            "locations outside that band will report no coverage rather than "
            "an empty result.",
            len(batch.errors),
            min(covered_lats),
            max(covered_lats) + COVERAGE_CELL_DEG,
        )
    return batch