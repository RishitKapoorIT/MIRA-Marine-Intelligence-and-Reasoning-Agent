import { useState, useEffect } from 'react';
import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { getWeatherData, weatherCodeLabel, windDirectionLabel } from '../../../data/weather.js';

// Custom blue marker icon for the weather popup
const weatherIcon = L.divIcon({
  html: `<div style="
    background:#1d4ed8;border:2px solid #3b82f6;border-radius:50%;
    width:32px;height:32px;display:flex;align-items:center;justify-content:center;
    font-size:16px;box-shadow:0 0 12px rgba(59,130,246,0.5);">🌦</div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  className: '',
});

/**
 * Fetches live Open-Meteo weather data when mounted and shows it as a popup marker.
 * This makes a REAL network call — visible in DevTools under marine-api.open-meteo.com
 */
export default function WeatherLayer({ mapCenter }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setError(false);
    const [lat, lon] = mapCenter;

    getWeatherData(lat, lon)
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, [mapCenter[0], mapCenter[1]]);

  return (
    <Marker position={mapCenter} icon={weatherIcon}>
      <Popup>
        <div className="text-sm min-w-[200px]">
          <div className="font-bold text-blue-700 mb-2">🌦 Weather / Waves</div>

          {loading && <div className="text-gray-500">Fetching live data…</div>}

          {error && (
            <div className="text-orange-600 bg-orange-50 rounded px-2 py-1 text-xs">
              ⚠ Weather data unavailable — please check your connection
            </div>
          )}

          {data && !loading && (
            <div className="space-y-1 text-gray-700">
              <div>🌊 Wave height: <strong>{data.waveHeight} m</strong></div>
              <div>💨 Wind: <strong>{data.windSpeed} km/h {windDirectionLabel(data.windDirection)}</strong></div>
              <div>☁ Conditions: <strong>{weatherCodeLabel(data.weatherCode)}</strong></div>
              <div className="text-xs text-gray-400 mt-2 border-t pt-1">
                Source: Open-Meteo · Updated: {new Date(data.fetchedAt).toLocaleTimeString()}
              </div>
            </div>
          )}
        </div>
      </Popup>
    </Marker>
  );
}
