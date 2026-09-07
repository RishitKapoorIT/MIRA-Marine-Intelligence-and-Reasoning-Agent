"""FR-E1.7 / FR-E1.8 / FR-E1.9 — the claims worth testing directly."""

from app.core.constants import EmptyReason
from app.workers.pfz_derive import cell_area_km2, derive_zones
from app.workers.pfz_client import Prediction

SPACING = 0.05


def grid_block(lat0, lon0, n_lat, n_lon, cls="GOOD", conf=0.8):
    return [Prediction(round(lat0 + i * SPACING, 4), round(lon0 + j * SPACING, 4), cls, conf)
            for i in range(n_lat) for j in range(n_lon)]


def filler(lat0, lon0, n_lat, n_lon):
    return [Prediction(round(lat0 + i * SPACING, 4), round(lon0 + j * SPACING, 4), "POOR", 0.9)
            for i in range(n_lat) for j in range(n_lon)]


print("--- Cell area sanity ---")
a = cell_area_km2(13.0, SPACING)
print(f"  one 0.05deg cell at 13N = {a:.2f} km2")
assert 25 < a < 32, a
cells_needed = 100 / a
print(f"  -> {cells_needed:.1f} cells needed to clear the 100 km2 floor")

print("\n--- FR-E1.9: coverage decides which empty case ---")
r = derive_zones(grid_block(12.0, 74.0, 4, 4), coverage_fraction=0.1)
assert r.empty_reason == EmptyReason.INSUFFICIENT_COVERAGE and r.zone_count == 0
print("  PASS  coverage 10% -> INSUFFICIENT_COVERAGE (not 'nothing qualified')")

r = derive_zones(filler(12.0, 74.0, 10, 10), coverage_fraction=0.9)
assert r.empty_reason == EmptyReason.NO_QUALIFYING_CONDITIONS and r.zone_count == 0
print("  PASS  coverage 90%, all POOR -> NO_QUALIFYING_CONDITIONS (a real finding)")

print("\n--- FR-E1.7: zone count is an output ---")
preds = filler(12.0, 74.0, 20, 20) + grid_block(12.1, 74.1, 3, 3)
r = derive_zones(preds, coverage_fraction=0.9)
print(f"  one 3x3 patch -> {r.zone_count} zone(s), area {r.zones[0].area_km2 if r.zones else 0} km2")
assert r.zone_count == 1

preds = (filler(12.0, 74.0, 30, 30)
         + grid_block(12.1, 74.1, 3, 3)
         + grid_block(12.8, 74.8, 4, 4))
r = derive_zones(preds, coverage_fraction=0.9)
print(f"  two separated patches -> {r.zone_count} zones")
assert r.zone_count == 2, r.zone_count

preds = filler(12.0, 74.0, 30, 30) + grid_block(12.1, 74.1, 6, 6)
r = derive_zones(preds, coverage_fraction=0.9)
print(f"  one 6x6 patch -> {r.zone_count} zone (count follows the data, not a target)")
assert r.zone_count == 1

print("\n--- FR-E1.7: sub-minimum clusters discarded, never padded ---")
preds = filler(12.0, 74.0, 20, 20) + grid_block(12.1, 74.1, 1, 1)
r = derive_zones(preds, coverage_fraction=0.9)
assert r.zone_count == 0 and r.clusters_discarded_small == 1
assert r.empty_reason == EmptyReason.NO_QUALIFYING_CONDITIONS
print(f"  PASS  single cell ({cell_area_km2(12.1, SPACING):.1f} km2) discarded -> 0 zones, not 1 tiny one")

print("\n--- Connectivity: diagonal touch is not one ground ---")
diag = [Prediction(12.0, 74.0, "GOOD", 0.8), Prediction(12.05, 74.05, "GOOD", 0.8)]
preds = filler(12.0, 74.0, 10, 10) + diag
r = derive_zones(preds, coverage_fraction=0.9)
assert r.clusters_found == 2, r.clusters_found
print(f"  PASS  4-connectivity -> {r.clusters_found} separate clusters")

print("\n--- BEST wins within a cluster; means attach ---")
preds = filler(12.0, 74.0, 20, 20) + grid_block(12.1, 74.1, 3, 3, cls="GOOD")
preds.append(Prediction(12.1, 74.1, "BEST", 0.95))
sst = {(round(12.1 + i*SPACING,4), round(74.1 + j*SPACING,4)): 28.5 for i in range(3) for j in range(3)}
r = derive_zones(preds, coverage_fraction=0.9, sst_by_point=sst)
z = r.zones[0]
assert z.zone_class == "BEST", z.zone_class
assert z.mean_sst_c == 28.5
print(f"  PASS  class={z.zone_class}, mean_sst={z.mean_sst_c}C, points={z.point_count}")

print("\n--- Determinism ---")
preds = filler(12.0, 74.0, 20, 20) + grid_block(12.1, 74.1, 4, 4)
a1 = derive_zones(preds, 0.9)
a2 = derive_zones(list(reversed(preds)), 0.9)
assert a1.zone_count == a2.zone_count
assert a1.zones[0].polygon_wkt == a2.zones[0].polygon_wkt
print("  PASS  input order does not change output")

print("\nPFZ DERIVE TESTS PASSED")