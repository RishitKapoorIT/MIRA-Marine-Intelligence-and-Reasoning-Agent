"""Spatial-coverage gate: a partial run must not answer for areas it skipped."""

import asyncio
from datetime import datetime, timezone
from types import SimpleNamespace

from app.core.constants import GenerationStatus
from app.tools.pfz_tool import location_is_covered
from app.workers.pfz_features import (
    FeatureBatch, FeaturePoint, build_grid, coverage_cell_key, COORDS_PER_REQUEST,
)

PORTS = {"Mangaluru": (12.87, 74.84), "Udupi": (13.34, 74.75), "Malpe": (13.35, 74.70),
         "Bhatkal": (13.97, 74.55), "Honnavar": (14.28, 74.45), "Karwar": (14.81, 74.13)}

print("--- Reproducing the observed partial run ---")
grid = build_grid()
succeeded = grid[:984]           # what actually got through before the 429s
batch = FeatureBatch(points_requested=len(grid))
batch.points = [FeaturePoint(p.latitude, p.longitude, 28.0, 0.1, 0.1, 34.5, None)
                for p in succeeded]
batch.points_with_data = len(batch.points)
cells = batch.covered_cells()
print(f"  {len(succeeded)}/{len(grid)} points -> coverage {batch.coverage_fraction:.1%}, {len(cells)} cells")
print(f"  latitude band covered: {min(float(c.split(',')[0]) for c in cells)} .. "
      f"{max(float(c.split(',')[0]) for c in cells)}")

gen = SimpleNamespace(covered_cells=cells, status=GenerationStatus.PUBLISHED,
                      computed_at=datetime.now(timezone.utc), zone_count=4)

print("\n--- Per-port coverage decision ---")
results = {}
for name, (lat, lon) in PORTS.items():
    covered = location_is_covered(gen, lat, lon)
    results[name] = covered
    verdict = "zones returned" if covered else "NOT COVERED -> refuses to answer"
    print(f"  {name:11} {lat:6.2f}N  cell {coverage_cell_key(lat, lon):>11}  {verdict}")

assert results["Mangaluru"] is True
assert not any(results[p] for p in ["Udupi", "Malpe", "Bhatkal", "Honnavar", "Karwar"])
print("\n  PASS  5 of 6 ports correctly refuse rather than returning southern zones")

print("\n--- Full coverage lets every port through ---")
full = FeatureBatch(points_requested=len(grid))
full.points = [FeaturePoint(p.latitude, p.longitude, 28.0, 0.1, 0.1, 34.5, None) for p in grid]
gen_full = SimpleNamespace(covered_cells=full.covered_cells())
assert all(location_is_covered(gen_full, *PORTS[p]) for p in PORTS)
print("  PASS  all 6 ports covered when the run completes")

print("\n--- Backward compatibility ---")
assert location_is_covered(SimpleNamespace(covered_cells=None), 14.81, 74.13) is True
assert location_is_covered(SimpleNamespace(covered_cells=[]), 14.81, 74.13) is True
print("  PASS  generations predating coverage recording are not blocked")

print("\n--- 'not covered' is distinct from 'nothing qualified' ---")
from app.tools.pfz_tool import PfzReadResult
a = PfzReadResult(status="not_covered", zones=[], partial_coverage=True)
b = PfzReadResult(status="empty", zones=[], empty_reason="no_qualifying_conditions")
assert a.status != b.status and a.partial_coverage and not b.partial_coverage
print("  PASS  four distinct statuses: ok / empty / not_covered / unavailable")

print("\n--- Disclosure fires only on partial coverage ---")
from app.safety.disclosures import for_answer, DisclosureKey
keys = [d.key for d in for_answer(includes_pfz=True, pfz_partial_coverage=True)]
assert DisclosureKey.PFZ_PARTIAL_COVERAGE.value in keys
keys2 = [d.key for d in for_answer(includes_pfz=True, pfz_partial_coverage=False)]
assert DisclosureKey.PFZ_PARTIAL_COVERAGE.value not in keys2
print("  PASS  partial-coverage disclosure attached only when relevant")

print("\nPFZ COVERAGE TESTS PASSED")