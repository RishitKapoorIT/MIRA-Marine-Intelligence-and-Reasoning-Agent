"""PFZ diagnostics.

    python -m scripts.diagnose_pfz --labels   # what classes does the model emit?
    python -m scripts.diagnose_pfz            # class distribution over real points

Run --labels FIRST. If the model emits numeric classes, they must be mapped in
thresholds.yaml under pfz.class_labels, or every prediction silently fails the
BEST/GOOD test in pfz_derive and the batch reports zero zones forever.
"""

import asyncio
import sys
from collections import Counter

from app.core.config import settings
from app.core.thresholds import thresholds
from app.tools.base import fetch_json
from app.workers.pfz_client import UnmappedLabelError, _post_json, map_label, to_payload
from app.workers.pfz_features import FeaturePoint, build_features


async def show_labels() -> None:
    """Probe the microservice with a handful of points and report raw labels."""
    print("Configured pfz.class_labels:", thresholds.pfz.class_labels or "(none)")
    print()

    health, error = await fetch_json(f"{settings.pfz_api_base_url.rstrip('/')}/health")
    if health:
        print("pfz-api /health:")
        for key in ("classes", "class_names", "labels", "features", "feature_names"):
            if key in health:
                print(f"  {key}: {health[key]}")
    elif error:
        print(f"/health unavailable: {error}")
    print()

    # Spread of conditions, to coax out more than one class.
    probes = [
        FeaturePoint(13.0, 74.3, sst, 0.2, 0.1, 34.5, chl)
        for sst in (26.0, 28.0, 30.0)
        for chl in (None, 0.2, 1.0, 5.0)
    ]
    url = f"{settings.pfz_api_base_url.rstrip('/')}/api/v1/predict/batch_custom"
    payload, error = await _post_json(url, {"items": [to_payload(p) for p in probes]})
    if error or not payload:
        print(f"Probe failed: {error}")
        return

    rows = payload.get("predictions", [])
    raw = Counter(str(r.get("predicted_zone")) for r in rows)
    print(f"Raw labels across {len(rows)} probe points: {dict(raw)}")
    print()
    print("Add the mapping to thresholds.yaml, for example:")
    print("  pfz:")
    print("    class_labels:")
    for label in sorted(raw):
        print(f'      "{label}": POOR   # <- confirm which of BEST/GOOD/POOR this is')
    print()
    print("Confirm the true order from the trained model itself:")
    print("  python -c \"import joblib; m=joblib.load('<model>.pkl'); print(m.classes_)\"")
    print("and cross-check against the label column in the training CSV.")


async def show_distribution() -> None:
    batch = await build_features()
    if not batch.points:
        print("No feature points retrieved.")
        return

    sample = batch.points[:: max(1, len(batch.points) // 200)][:200]
    print(f"Sampling {len(sample)} of {len(batch.points)} points\n")

    url = f"{settings.pfz_api_base_url.rstrip('/')}/api/v1/predict/batch_custom"

    async def distribution(points, label):
        payload, error = await _post_json(
            url, {"items": [to_payload(p) for p in points]}
        )
        if error or not payload:
            print(f"{label}: failed ({error})")
            return
        rows = payload.get("predictions", [])
        raw = Counter(str(r.get("predicted_zone")) for r in rows)
        try:
            mapped = Counter(map_label(r.get("predicted_zone")) for r in rows)
            print(f"{label}: raw={dict(raw)}  mapped={dict(mapped)}")
        except UnmappedLabelError:
            print(f"{label}: raw={dict(raw)}  mapped=UNMAPPED -> run --labels first")

    await distribution(sample, "chlorophyll = NaN (current pipeline)")

    # Diagnostic only. Shipping a substituted chlorophyll would be the exact
    # FR-C6.3 violation removed from generator.py.
    for probe in (0.3, 1.0, 3.0):
        seeded = [
            FeaturePoint(p.latitude, p.longitude, p.temperature, p.eastward_current,
                         p.northward_current, p.salinity, probe, p.observation_time)
            for p in sample
        ]
        await distribution(seeded, f"chlorophyll = {probe} mg/m3 (diagnostic only)")

    print(f"\nmin_zone_area_km2 = {thresholds.pfz.min_zone_area_km2}")


if __name__ == "__main__":
    asyncio.run(show_labels() if "--labels" in sys.argv else show_distribution())