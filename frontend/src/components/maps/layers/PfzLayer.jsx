import { useState, useEffect } from 'react';
import { Circle, Popup } from 'react-leaflet';
import { getPfzZones } from '../../../data/pfz.js';

/**
 * Renders PFZ zones as teal circles with a popup.
 * Data is mock — clearly labeled as demo data in the UI.
 * FR-C1: function signature ready for real NASA/MOSDAC data.
 */
export default function PfzLayer({ userPos }) {
  const [zones, setZones] = useState([]);

  useEffect(() => {
    if (!userPos) return;
    getPfzZones(userPos[0], userPos[1]).then(setZones).catch(console.error);
  }, [userPos]);

  return zones.map((zone) => (
    <Circle
      key={zone.id}
      center={[zone.lat, zone.lon]}
      radius={zone.radiusM}
      pathOptions={{
        color: '#30E8B8',
        fillColor: '#30E8B8',
        fillOpacity: 0.12,
        weight: 2,
      }}
    >
      <Popup>
        <div className="text-orca-bg text-sm min-w-[180px]">
          <div className="font-bold text-orca-teal mb-1">🎣 PFZ — {zone.label}</div>
          <div className="text-gray-700">
            {zone.distanceKm} km · {zone.bearing} of your location
          </div>
          {zone.isMock && (
            <div className="mt-2 text-xs text-orange-600 bg-orange-50 rounded px-2 py-1">
              ⚠ Sample / demo data — live satellite feed in a later iteration
            </div>
          )}
        </div>
      </Popup>
    </Circle>
  ));
}
