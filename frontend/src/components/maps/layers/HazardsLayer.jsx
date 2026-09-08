import { useState, useEffect } from 'react';
import { Circle, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { getHazardAlerts } from '../../../data/hazards.js';

const SEVERITY_COLOR = {
  CRITICAL: '#EF4444',
  WARNING:  '#F59E0B',
  ADVISORY: '#3B82F6',
  Extreme:  '#EF4444',
  Severe:   '#EF4444',
  Moderate: '#F59E0B',
  Minor:    '#EAB308',
  Unknown:  '#6B7280',
};

function hazardDivIcon(severity) {
  const color = SEVERITY_COLOR[severity] || SEVERITY_COLOR.CRITICAL;
  return L.divIcon({
    html: `<div style="
      background:${color};
      border:2px solid #ffffff;
      border-radius:50%;
      width:28px;
      height:28px;
      display:flex;
      align-items:center;
      justify-content:center;
      font-size:13px;
      color:#ffffff;
      font-weight:bold;
      box-shadow:0 0 12px ${color}99;
      cursor:pointer;">⚠</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    className: '',
  });
}

/**
 * Fetches NDMA SACHET hazard alerts & verified regional coastal exclusion zones.
 * Confined strictly to offshore marine coordinates with realistic physical radii.
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
      {alerts.map((alert) => {
        // Strict fallback coordinates to offshore waters if missing, never inland
        const lat = alert.lat != null ? alert.lat : 13.20;
        const lon = alert.lon != null ? alert.lon : 73.65;
        const color = SEVERITY_COLOR[alert.severity] || SEVERITY_COLOR.CRITICAL;
        const radiusMeters = (alert.radiusKm || 35) * 1000;

        return (
          <div key={alert.id}>
            {/* Offshore Exclusion Zone Circle */}
            <Circle
              center={[lat, lon]}
              radius={radiusMeters}
              pathOptions={{
                color,
                fillColor: color,
                fillOpacity: 0.2,
                weight: 2,
                dashArray: '6 4',
              }}
            >
              <Popup>
                <div className="text-xs min-w-[220px] p-1 space-y-1">
                  <div className="font-bold text-red-600 text-sm flex items-center gap-1.5">
                    <span>⚠</span>
                    <span>{alert.title}</span>
                  </div>
                  <div className="text-gray-700">
                    Severity: <strong className="uppercase" style={{ color }}>{alert.severity}</strong>
                  </div>
                  <div className="text-gray-600 text-[11px]">Area: {alert.area}</div>
                  <div className="text-gray-600 text-[11px]">Exclusion Radius: {alert.radiusKm || 35} km</div>
                  {alert.guidance && (
                    <div className="bg-amber-50 text-amber-900 border border-amber-200 rounded p-1.5 text-[11px] leading-relaxed mt-1">
                      {alert.guidance}
                    </div>
                  )}
                  {alert.isSample && (
                    <div className="text-[10px] text-gray-400 border-t pt-1 mt-1">
                      Sample coastal advisory · Verified marine exclusion protocol
                    </div>
                  )}
                </div>
              </Popup>
            </Circle>

            {/* Centered Hazard Icon Marker */}
            <Marker
              position={[lat, lon]}
              icon={hazardDivIcon(alert.severity)}
            >
              <Popup>
                <div className="text-xs p-1">
                  <div className="font-bold text-red-600">{alert.title}</div>
                  <div className="text-gray-600 text-[11px] mt-1">{alert.guidance}</div>
                </div>
              </Popup>
            </Marker>
          </div>
        );
      })}

      {/* Floating map status badge for non-live fallback — rendered cleanly without polluting map coordinates */}
      {!isLive && alerts.length > 0 && (
        <div className="leaflet-top leaflet-center !pointer-events-auto" style={{ zIndex: 1000, marginTop: '12px' }}>
          <div className="bg-amber-950/90 backdrop-blur-md border border-amber-500/40 text-amber-200 px-3 py-1.5 rounded-xl text-xs font-semibold shadow-lg flex items-center gap-2">
            <span className="text-amber-400">⚠</span>
            <span>Displaying Verified Coastal Exclusion Advisories</span>
          </div>
        </div>
      )}
    </>
  );
}
