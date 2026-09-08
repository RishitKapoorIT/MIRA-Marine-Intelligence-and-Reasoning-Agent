"""Why did the batch produce zero zones?

86% coverage with zero qualifying points across the whole Karnataka coast is
unlikely to be a real oceanographic finding. Far more likely the classifier is
collapsing to a single class - chlorophyll-a is a primary-productivity proxy
and is usually the strongest signal for fishing zones, so passing it as NaN
may have removed the feature the model actually relied on.

This calls the microservice directly and reports the class distribution.

    python -m scripts.diagnose_pfz
"""

import asyncio
from collections import Counter

from app.core.thresholds import thresholds
from app.workers.pfz_client import classify
from app.workers.pfz_features import FeaturePoint, build_features


async def main() -> None:
    batch = await build_features()
    if not batch.points:
        print("No feature points retrieved; nothing to diagnose.")
        return

    sample = batch.points[:: max(1, len(batch.points) // 200)][:200]
    print(f"Sampling {len(sample)} of {len(batch.points)} points\n")

    # --- 1. As the batch runs it: chlorophyll = None -> NaN
    preds, errors = await classify(sample)
    dist = Counter(p.zone_class for p in preds)
    print("chlorophyll = NaN (current pipeline)")
    print(f"  {dict(dist)}")
    if errors:
        print(f"  errors: {errors[:2]}")

    # --- 2. Same points with a plausible chlorophyll value supplied.
    # NOT a proposal to ship this - FR-C6.3 forbids substituting a modelled
    # value. This is purely to establish whether the NaN is what is collapsing
    # the classifier.
    for probe in (0.3, 1.0, 3.0):
        seeded = [
            FeaturePoint(
                p.latitude, p.longitude, p.temperature,
                p.eastward_current, p.northward_current,
                p.salinity, probe, p.observation_time,
            )
            for p in sample
        ]
        preds2, _ = await classify(seeded)
        print(f"chlorophyll = {probe} mg/m3 (diagnostic only)")
        print(f"  {dict(Counter(p.zone_class for p in preds2))}")

    print()
    print(f"min_zone_area_km2 = {thresholds.pfz.min_zone_area_km2}")
    print("If NaN gives all-POOR but a supplied value gives BEST/GOOD, the")
    print("model depends on chlorophyll and the Earthdata source is required")
    print("for PFZ to mean anything.")


if __name__ == "__main__":
    asyncio.run(main())