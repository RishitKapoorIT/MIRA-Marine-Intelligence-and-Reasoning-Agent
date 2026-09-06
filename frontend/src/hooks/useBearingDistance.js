import { useMemo } from 'react';

const R = 6371; // Earth radius in km

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

/**
 * Computes the haversine distance (km) and compass bearing between two lat/lon points.
 * Pure client-side math — no API call, no async.
 *
 * @param {[number,number]} from  [lat, lon]
 * @param {[number,number]} to    [lat, lon]
 * @returns {{ km: string, bearing: string }}
 */
export function useBearingDistance(from, to) {
  return useMemo(() => {
    if (!from || !to) return { km: '--', bearing: '--' };

    const [lat1, lon1] = from;
    const [lat2, lon2] = to;

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

    const distKm = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    const y = Math.sin(toRad(lon2 - lon1)) * Math.cos(toRad(lat2));
    const x =
      Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
      Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lon2 - lon1));
    const bearingDeg = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;

    const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const bearing = dirs[Math.round(bearingDeg / 45) % 8];

    return { km: distKm.toFixed(1), bearing };
  }, [from, to]);
}
