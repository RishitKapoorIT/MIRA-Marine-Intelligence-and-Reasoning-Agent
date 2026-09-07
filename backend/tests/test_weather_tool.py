import asyncio
from datetime import datetime, timezone
from unittest.mock import patch

from app.tools import weather_tool
from app.tools.base import DataKind

FAKE = {
    "hourly": {
        "time": [
            "2026-09-08T00:00", "2026-09-08T01:00", "2026-09-08T02:00",
            "2026-09-08T03:00", "2026-09-08T04:00",
        ],
        "wave_height":         [1.2, 1.8, 3.1, 1.5, 1.1],
        "swell_wave_height":   [0.8, 1.0, 2.4, 0.9, 0.7],
        "wave_period":         [6.0, 6.5, 8.0, 6.2, 6.0],
        "sea_surface_temperature": [28.1, 28.2, 28.0, 28.3, 28.4],
        "ocean_current_velocity":  [0.3, 0.4, 0.9, 0.3, 0.2],
    }
}

async def main():
    start = datetime(2026, 9, 8, 0, 0, tzinfo=timezone.utc)
    end   = datetime(2026, 9, 8, 4, 0, tzinfo=timezone.utc)

    # --- happy path
    async def ok(*a, **k): return FAKE, None
    with patch.object(weather_tool, "fetch_json", ok):
        env = await weather_tool.get_marine_conditions(12.87, 74.84, start, end)

    print("available:", env.available, "| kind:", env.kind.value)
    print("max_wave_height_m :", env.values["max_wave_height_m"])
    print("mean_wave_height_m:", env.values["mean_wave_height_m"])
    print("hours_covered     :", env.values["hours_covered"])
    print("valid_at          :", env.valid_at)
    print("attribution       :", env.attribution)

    # FR-E2 safety logic must see the 3.1 m spike, not the 1.74 m mean
    assert env.values["max_wave_height_m"] == 3.1
    assert env.values["mean_wave_height_m"] < 2.0
    assert env.kind == DataKind.FORECAST
    assert env.values["hours_covered"] == 5
    assert env.attribution and "Open-Meteo" in env.attribution
    print("-> max, not mean, drives the verdict: confirmed")

    # --- narrower window excludes the spike
    with patch.object(weather_tool, "fetch_json", ok):
        env2 = await weather_tool.get_marine_conditions(
            12.87, 74.84,
            datetime(2026, 9, 8, 3, 0, tzinfo=timezone.utc),
            datetime(2026, 9, 8, 4, 0, tzinfo=timezone.utc),
        )
    assert env2.values["max_wave_height_m"] == 1.5, env2.values
    assert env2.values["hours_covered"] == 2
    print("-> window slicing correct (spike excluded):", env2.values["max_wave_height_m"])

    # --- source down => unavailable envelope, NOT an exception
    async def down(*a, **k): return None, "Timed out after 15.0s"
    with patch.object(weather_tool, "fetch_json", down):
        env3 = await weather_tool.get_marine_conditions(12.87, 74.84, start, end)
    assert env3.available is False
    assert env3.values == {}
    assert env3.is_stale(__import__("datetime").timedelta(hours=1)) is True
    print("-> source down ->", repr(env3.unavailable_reason), "| available:", env3.available)

    # --- window outside forecast horizon => absence, not nearest-hour substitution
    with patch.object(weather_tool, "fetch_json", ok):
        env4 = await weather_tool.get_marine_conditions(
            12.87, 74.84,
            datetime(2026, 12, 1, 0, 0, tzinfo=timezone.utc),
            datetime(2026, 12, 1, 6, 0, tzinfo=timezone.utc),
        )
    assert env4.available is False
    assert "horizon" in env4.unavailable_reason
    print("-> out-of-horizon ->", repr(env4.unavailable_reason))
    print()
    print("WEATHER TOOL PASSED")

asyncio.run(main())