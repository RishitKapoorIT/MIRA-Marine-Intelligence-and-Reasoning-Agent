import { OPEN_METEO_MARINE_URL, OPEN_METEO_FORECAST_URL } from '../config/map.js';

/**
 * Fetches live weather and wave data from Open-Meteo (free, keyless).
 * @param {number} lat
 * @param {number} lon
 * @returns {Promise<{waveHeight: number, windSpeed: number, windDirection: number, fetchedAt: string}>}
 */
export async function getWeatherData(lat, lon) {
  const [marineRes, forecastRes] = await Promise.all([
    fetch(
      `${OPEN_METEO_MARINE_URL}?latitude=${lat}&longitude=${lon}&current=wave_height,swell_wave_height&timezone=auto`
    ),
    fetch(
      `${OPEN_METEO_FORECAST_URL}?latitude=${lat}&longitude=${lon}&current=wind_speed_10m,wind_direction_10m,weather_code&timezone=auto`
    ),
  ]);

  if (!marineRes.ok || !forecastRes.ok) {
    throw new Error('Open-Meteo API returned an error');
  }

  const [marine, forecast] = await Promise.all([marineRes.json(), forecastRes.json()]);

  return {
    waveHeight:    marine.current?.wave_height   ?? 0,
    swellHeight:   marine.current?.swell_wave_height ?? 0,
    windSpeed:     forecast.current?.wind_speed_10m   ?? 0,
    windDirection: forecast.current?.wind_direction_10m ?? 0,
    weatherCode:   forecast.current?.weather_code ?? 0,
    fetchedAt:     new Date().toISOString(),
  };
}

/** Maps WMO weather codes to a human-readable label */
export function weatherCodeLabel(code) {
  if (code === 0) return 'Clear sky';
  if (code <= 3)  return 'Partly cloudy';
  if (code <= 49) return 'Foggy';
  if (code <= 69) return 'Drizzle / Rain';
  if (code <= 79) return 'Snow';
  if (code <= 82) return 'Rain showers';
  if (code <= 84) return 'Snow showers';
  if (code <= 99) return 'Thunderstorm';
  return 'Unknown';
}

/** Converts a wind direction in degrees to a compass label */
export function windDirectionLabel(deg) {
  const dirs = ['N','NE','E','SE','S','SW','W','NW'];
  return dirs[Math.round(deg / 45) % 8];
}
