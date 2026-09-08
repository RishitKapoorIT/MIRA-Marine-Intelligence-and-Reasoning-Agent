import { useState, useEffect } from 'react';
import { Circle, Popup } from 'react-leaflet';
import { getPfzZones } from '../../../data/pfz.js';

/**
 * Renders Potential Fishing Zones (PFZ) as teal circles with interactive details.
 * Attribution adheres strictly to FR-C6 data-honesty guidelines.
 */
export default function PfzLayer({ userPos }) {
  const [zones, setZones] = useState([]);

  useEffect(() => {
    if (!userPos) return;
    getPfzZones(userPos[0], userPos[1]).then(setZones).catch(console.error);
  }, [userPos?.[0], userPos?.[1]]);

  return zones.map((zone) => (
    <Circle
      key={zone.id}
      center={[zone.lat, zone.lon]}
      radius={zone.radiusM || 15000}
      pathOptions={{
        color: '#10B981',
        fillColor: '#10B981',
        fillOpacity: 0.16,
        weight: 2,
      }}
    >
      <Popup>
        <div className="text-orca-bg text-sm min-w-[200px] p-1 space-y-1">
          <div className="font-bold text-emerald-700 text-base flex items-center gap-1.5">
            <span>🎣</span>
            <span>PFZ — {zone.label}</span>
          </div>
          <div className="text-gray-700 text-xs">
            {zone.distanceKm != null ? `${zone.distanceKm} km · ${zone.bearing || 'Bearing'} from origin` : 'Active Coastal PFZ Zone'}
          </div>
          {zone.species && (
            <div className="text-gray-600 text-xs">
              Target Pelagic: <strong>{zone.species}</strong>
            </div>
          )}
          <div className="mt-2 text-[10px] text-gray-500 bg-gray-50 border border-gray-200 rounded p-1.5 leading-snug">
            Predicted via ORCA XGBoost model over public oceanographic data (not an INCOIS-certified advisory).
          </div>
        </div>
      </Popup>
    </Circle>
  ));
}
