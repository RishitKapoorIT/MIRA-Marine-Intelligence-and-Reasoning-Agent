"""Typed loader for thresholds.yaml.

Tunable numeric parameters live here, not in .env — RK-9 expects the PFZ
bands and grid to be retuned during the Iteration 1 build, and that should
never require a code change (the same NFR-I1 spirit applied to numbers, not
just user-facing strings).

Fields carry safe defaults so a thresholds.yaml that predates a given key
still loads. `max_staleness_hours` and the `alerts` section are new as of
this step; adding them explicitly to thresholds.yaml is recommended so they
sit alongside the rest of the tuning knobs, but nothing breaks if they're
left out for now.
"""

from functools import lru_cache
from pathlib import Path

import yaml
from pydantic import BaseModel

THRESHOLDS_PATH = Path(__file__).parent / "thresholds.yaml"


class GridConfig(BaseModel):
    bbox: dict[str, float]
    spacing_deg: float


class PfzThresholds(BaseModel):
    grid: GridConfig
    min_zone_area_km2: float
    composite_days: int
    generations_retained: int
    salinity_constant_psu: float
    # FR-C6.2 — how old a published generation may be before an answer must
    # disclose staleness.
    max_staleness_hours: float = 120.0
    # FR-E1.9 — below this, an empty result means we could not see enough
    # ocean (INSUFFICIENT_COVERAGE) rather than that nothing qualified.
    # The configured bbox includes land, which permanently depresses coverage,
    # so this is set low; tighten max_lon toward the coast to raise it.
    min_coverage_fraction: float = 0.3


class AlertThresholds(BaseModel):
    # FR-F5.3 default alerts-view radius.
    default_radius_km: float = 25.0
    # FR-F5.6 / FR-F5.9 — expired alerts stay browsable, then get purged.
    expired_retention_days: int = 7


class SafetyThresholds(BaseModel):
    """FR-E2.2 go/no-go cutoffs.

    THESE NUMBERS ARE PLACEHOLDERS AND HAVE NOT BEEN VALIDATED BY ANY MARINE
    AUTHORITY OR DOMAIN EXPERT. They are ordered plausibly for a small
    open-boat fishing craft so the logic can be built and tested, but the
    actual values must be reviewed against IMD small-craft advisory criteria
    and local vessel classes before any real user sees a verdict. RK-9
    anticipates retuning; this is the file where it happens.
    """

    wave_height_caution_m: float = 2.0
    wave_height_unsafe_m: float = 3.0
    wind_speed_caution_ms: float = 10.0
    wind_speed_unsafe_ms: float = 15.0
    wind_gust_caution_ms: float = 14.0
    wind_gust_unsafe_ms: float = 20.0
    current_caution_ms: float = 1.0
    visibility_caution_m: float = 2000.0
    # FR-C6.2 — forecast data older than this cannot support a "safe" verdict.
    max_forecast_age_hours: float = 6.0


class Thresholds(BaseModel):
    pfz: PfzThresholds
    alerts: AlertThresholds = AlertThresholds()
    safety: SafetyThresholds = SafetyThresholds()


@lru_cache
def get_thresholds() -> Thresholds:
    raw = yaml.safe_load(THRESHOLDS_PATH.read_text())
    return Thresholds(**raw)


thresholds = get_thresholds()