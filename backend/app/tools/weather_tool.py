"""Open-Meteo Forecast (EI-3) and Marine (EI-4) clients.

Both are keyless and CC BY 4.0 — FR-I5.1 requires the attribution to reach
the UI, so it rides on the envelope rather than living in a doc somewhere.

Window aggregates are MAXIMA, not means. A four-hour trip whose third hour
carries 3.1 m swell is not a 1.8 m-average trip, and averaging is how a
dangerous window gets reported as a calm one. FR-E2.2 thresholds are applied
to these maxima in app/safety/verdict.py (Step 4b).
"""

from __future__ import annotations

from datetime import datetime, timezone

from app.core.config import settings
from app.core.constants import SourceId
from app.tools.base import DataKind, SourceEnvelope, fetch_json, parse_iso

ATTRIBUTION = "Weather and marine data by Open-Meteo.com (CC BY 4.0)"

FORECAST_HOURLY = [
    "temperature_2m",
    "precipitation",
    "wind_speed_10m",
    "wind_gusts_10m",
    "wind_direction_10m",
    "visibility",
]

MARINE_HOURLY = [
    "wave_height",
    "wave_period",
    "wave_direction",
    "swell_wave_height",
    "swell_wave_period",
    "sea_surface_temperature",
    "ocean_current_velocity",
    "ocean_current_direction",
]


def _slice_window(
    times: list[str],
    series: dict[str, list],
    start: datetime,
    end: datetime,
) -> tuple[list[int], list[datetime]]:
    """Indices of hourly slots falling inside [start, end]."""
    indices: list[int] = []
    stamps: list[datetime] = []
    for i, raw in enumerate(times):
        stamp = parse_iso(raw)
        if stamp is None:
            continue
        if start <= stamp <= end:
            indices.append(i)
            stamps.append(stamp)
    return indices, stamps


def _window_max(series: list | None, indices: list[int]) -> float | None:
    if not series:
        return None
    values = [series[i] for i in indices if i < len(series) and series[i] is not None]
    return max(values) if values else None


def _window_mean(series: list | None, indices: list[int]) -> float | None:
    if not series:
        return None
    values = [series[i] for i in indices if i < len(series) and series[i] is not None]
    return round(sum(values) / len(values), 3) if values else None


def _window_min(series: list | None, indices: list[int]) -> float | None:
    if not series:
        return None
    values = [series[i] for i in indices if i < len(series) and series[i] is not None]
    return min(values) if values else None


def _window_sum(series: list | None, indices: list[int]) -> float | None:
    if not series:
        return None
    values = [series[i] for i in indices if i < len(series) and series[i] is not None]
    return round(sum(values), 2) if values else None


async def get_marine_conditions(
    lat: float, lon: float, start: datetime, end: datetime
) -> SourceEnvelope:
    """EI-4. Wave height, period, SST and currents over the requested window."""
    payload, error = await fetch_json(
        settings.open_meteo_marine_url,
        {
            "latitude": lat,
            "longitude": lon,
            "hourly": ",".join(MARINE_HOURLY),
            "timezone": "UTC",
            "forecast_days": 3,
        },
    )

    if error or not payload:
        return SourceEnvelope.unavailable(
            SourceId.OPEN_METEO_MARINE.value,
            DataKind.FORECAST,
            error or "Empty response from marine API",
        )

    hourly = payload.get("hourly") or {}
    times = hourly.get("time") or []
    indices, stamps = _slice_window(times, hourly, start, end)

    if not indices:
        # FR-C6.3: the request fell outside the model's horizon. That is an
        # absence of data, not a reason to reach for the nearest available hour.
        return SourceEnvelope.unavailable(
            SourceId.OPEN_METEO_MARINE.value,
            DataKind.FORECAST,
            "Requested window is outside the marine forecast horizon",
        )

    return SourceEnvelope(
        source_id=SourceId.OPEN_METEO_MARINE.value,
        kind=DataKind.FORECAST,
        valid_at=max(stamps),
        values={
            # Maxima drive the safety verdict.
            "max_wave_height_m": _window_max(hourly.get("wave_height"), indices),
            "max_swell_height_m": _window_max(hourly.get("swell_wave_height"), indices),
            "max_current_velocity_ms": _window_max(
                hourly.get("ocean_current_velocity"), indices
            ),
            # Means are descriptive context only.
            "mean_wave_height_m": _window_mean(hourly.get("wave_height"), indices),
            "mean_wave_period_s": _window_mean(hourly.get("wave_period"), indices),
            "mean_sst_c": _window_mean(hourly.get("sea_surface_temperature"), indices),
            "window_start": min(stamps).isoformat(),
            "window_end": max(stamps).isoformat(),
            "hours_covered": len(indices),
        },
        attribution=ATTRIBUTION,
    )


async def get_weather_forecast(
    lat: float, lon: float, start: datetime, end: datetime
) -> SourceEnvelope:
    """EI-3. Wind, gusts, precipitation and visibility over the window."""
    payload, error = await fetch_json(
        settings.open_meteo_forecast_url,
        {
            "latitude": lat,
            "longitude": lon,
            "hourly": ",".join(FORECAST_HOURLY),
            "timezone": "UTC",
            "forecast_days": 7,
        },
    )

    if error or not payload:
        return SourceEnvelope.unavailable(
            SourceId.OPEN_METEO_FORECAST.value,
            DataKind.FORECAST,
            error or "Empty response from forecast API",
        )

    hourly = payload.get("hourly") or {}
    times = hourly.get("time") or []
    indices, stamps = _slice_window(times, hourly, start, end)

    if not indices:
        return SourceEnvelope.unavailable(
            SourceId.OPEN_METEO_FORECAST.value,
            DataKind.FORECAST,
            "Requested window is outside the weather forecast horizon",
        )

    return SourceEnvelope(
        source_id=SourceId.OPEN_METEO_FORECAST.value,
        kind=DataKind.FORECAST,
        valid_at=max(stamps),
        values={
            "max_wind_speed_ms": _window_max(hourly.get("wind_speed_10m"), indices),
            "max_wind_gust_ms": _window_max(hourly.get("wind_gusts_10m"), indices),
            "total_precipitation_mm": _window_sum(hourly.get("precipitation"), indices),
            "min_visibility_m": _window_min(hourly.get("visibility"), indices),
            "mean_temperature_c": _window_mean(hourly.get("temperature_2m"), indices),
            "window_start": min(stamps).isoformat(),
            "window_end": max(stamps).isoformat(),
            "hours_covered": len(indices),
        },
        attribution=ATTRIBUTION,
    )