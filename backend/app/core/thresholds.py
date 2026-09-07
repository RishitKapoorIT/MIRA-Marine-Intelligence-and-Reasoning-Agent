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


class AlertThresholds(BaseModel):
    # FR-F5.3 default alerts-view radius.
    default_radius_km: float = 25.0
    # FR-F5.6 / FR-F5.9 — expired alerts stay browsable, then get purged.
    expired_retention_days: int = 7


class Thresholds(BaseModel):
    pfz: PfzThresholds
    alerts: AlertThresholds = AlertThresholds()


@lru_cache
def get_thresholds() -> Thresholds:
    raw = yaml.safe_load(THRESHOLDS_PATH.read_text())
    return Thresholds(**raw)


thresholds = get_thresholds()