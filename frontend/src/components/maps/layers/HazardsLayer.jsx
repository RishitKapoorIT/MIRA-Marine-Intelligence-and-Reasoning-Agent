import { useState, useEffect } from 'react';
import { Circle, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { getHazardAlerts } from '../../../data/hazards.js';

const SEVERITY_COLOR = {
  Extreme:  '#dc2626',
  Severe:   '#ef4444',
  Moderate: '#f97316',
  Minor:    '#eab308',
  Unknown:  '#6b7280',
};

function hazardIcon(severity) {
  const color = SEVERITY_COLOR[severity] ?? SEVERITY_COLOR.Unknown;
  return L.divIcon({
    html: `<div style="
      background:${color};border:2px solid white;border-radius:50%;
      width:32px;height:32px;display:flex;align-items:center;justify-content:center;
      font-size:14px;box-shadow:0 0 16px ${color}88;">⚠</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    className: '',
  });
}

/**
 * Fetches NDMA SACHET hazard alerts (or uses static fallback — FR-C6).
 * Calls onHazardCount(n) so the parent can update the bottom bar alert banner.
 */
export default function HazardsLayer({ onHazardCount }) {
  const [alerts, setAlerts] = useState([]);
  const [isLive, setIsLive] = useState(true);

  useEffect(() => {
    getHazardAlerts()
      .then(({ alerts: a, isLive: live }) => {
        setAlerts(a);
        setIsLive(live);
        onHazardCount?.(a.length);
      })
      .catch(() => {
        onHazardCount?.(0);
      });
  }, []);

  return (
    <>
      {/* FR-C6: show cached-data banner if not live */}
      {!isLive && alerts.length > 0 && (
        <Marker
          position={[20, 78]}
          icon={L.divIcon({
            html: `<div style="
              background:#7c2d12;border:1px solid #f97316;color:#fed7aa;
              padding:6px 12px;border-radius:8px;font-size:11px;font-weight:600;
              white-space:nowrap;font-family:Inter,sans-serif;">
              ⚠ Using cached / sample hazard data
            </div>`,
            className: '',
            iconAnchor: [100, 10],
          })}
        />
      )}

      {alerts.map((alert) => {
        const lat = alert.lat ?? 15.5;
        const lon = alert.lon ?? 85.0;
        const color = SEVERITY_COLOR[alert.severity] ?? SEVERITY_COLOR.Unknown;

        return (
          <Circle
            key={alert.id}
            center={[lat, lon]}
            radius={200000}
            pathOptions={{
              color,
              fillColor: color,
              fillOpacity: 0.15,
              weight: 2,
              dashArray: '6 4',
            }}
          >
            <Popup>
              <div className="text-sm min-w-[220px]">
                <div className="font-bold text-red-700 mb-1">⚠ {alert.title}</div>
                <div className="text-gray-700 space-y-0.5">
                  <div>Severity: <strong>{alert.severity}</strong></div>
                  <div>Area: {alert.area}</div>
                  {alert.onset && (
                    <div className="text-xs text-gray-500 mt-1">
                      From: {new Date(alert.onset).toLocaleDateString()}
                    </div>
                  )}
                  {alert.isMock && (
                    <div className="mt-2 text-xs text-orange-600 bg-orange-50 rounded px-2 py-1">
                      Sample data — real SACHET feed unavailable
                    </div>
                  )}
                </div>
              </div>
            </Popup>
          </Circle>
        );
      })}
    </>
  );
}
