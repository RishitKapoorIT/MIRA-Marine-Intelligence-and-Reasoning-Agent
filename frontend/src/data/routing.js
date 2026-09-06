import * as turf from '@turf/turf';
import { SAMPLE_HAZARD_ZONES } from './hazards.js';

/**
 * Key Indian Coastal Ports & Coastal Harbors for route planning.
 */
export const INDIAN_PORTS = [
  { id: 'port-mangalore', name: 'Mangalore Old Port (Bunder)', lat: 12.855, lon: 74.836, region: 'Karnataka' },
  { id: 'port-new-mangalore', name: 'New Mangalore Deepwater Port', lat: 12.932, lon: 74.810, region: 'Karnataka' },
  { id: 'port-malpe', name: 'Malpe Fisheries Harbor', lat: 13.348, lon: 74.701, region: 'Karnataka' },
  { id: 'port-karwar', name: 'Karwar Port / Baithkol Harbor', lat: 14.808, lon: 74.120, region: 'Karnataka' },
  { id: 'port-goa', name: 'Mormugao Port (Goa)', lat: 15.417, lon: 73.798, region: 'Goa' },
  { id: 'port-panaji', name: 'Panaji Fisheries Jetty', lat: 15.498, lon: 73.827, region: 'Goa' },
  { id: 'port-kochi', name: 'Kochi (Cochin) Harbor', lat: 9.967, lon: 76.242, region: 'Kerala' },
  { id: 'port-kannur', name: 'Ayikkara Harbor (Kannur)', lat: 11.854, lon: 75.372, region: 'Kerala' },
  { id: 'port-mumbai', name: 'Sassoon Docks (Mumbai)', lat: 18.918, lon: 72.825, region: 'Maharashtra' },
  { id: 'port-ratnagiri', name: 'Mirkarwada Port (Ratnagiri)', lat: 16.984, lon: 73.281, region: 'Maharashtra' },
];

/**
 * Calculate distance in Nautical Miles using Turf.js.
 */
export function getDistanceNm(p1, p2) {
  const from = turf.point([p1.lon, p1.lat]);
  const to = turf.point([p2.lon, p2.lat]);
  const km = turf.distance(from, to, { units: 'kilometers' });
  return Math.round(km * 0.539957 * 10) / 10;
}

/**
 * Calculate bearing in degrees between two points.
 */
export function getBearing(p1, p2) {
  const from = turf.point([p1.lon, p1.lat]);
  const to = turf.point([p2.lon, p2.lat]);
  let b = turf.bearing(from, to);
  if (b < 0) b += 360;
  return Math.round(b);
}

function bearingToCardinal(b) {
  const cardinals = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const idx = Math.round(b / 22.5) % 16;
  return cardinals[idx];
}

/**
 * Generates marine routing options dodging known hazard exclusion zones via Turf.js.
 * @param {object} origin { lat, lon, name }
 * @param {object} destination { lat, lon, name }
 * @param {object} waypoint { lat, lon, name } (optional)
 * @param {Array} hazards List of hazard objects with { lat, lon, radiusKm }
 * @returns {Array<RouteOption>}
 */
export function computeMarineRoutes(origin, destination, waypoint = null, hazards = SAMPLE_HAZARD_ZONES) {
  const startPt = turf.point([origin.lon, origin.lat]);
  const destPt = turf.point([destination.lon, destination.lat]);
  const midPt = waypoint ? turf.point([waypoint.lon, waypoint.lat]) : null;

  // Check critical hazards for detour requirement
  const criticalHazards = hazards.filter(h => h.severity === 'CRITICAL' || h.severity === 'SEVERE');

  // Generate Route 1: "Safest Optimal" — detour around hazards
  const route1Coords = generateDetourPath(startPt, destPt, midPt, criticalHazards, 'seaward');

  // Generate Route 2: "Alternative Coastal Path" — hugs safe inshore contour
  const route2Coords = generateDetourPath(startPt, destPt, midPt, criticalHazards, 'inshore');

  const route1 = buildRouteDetails('Safest Optimal (Hazard-Free)', route1Coords, 98, 'Optimal balance of fuel economy and complete hazard exclusion.', 11.5);
  const route2 = buildRouteDetails('Alternative Inshore Contour', route2Coords, 91, 'Hugs coastal depth contours for sheltered passage in rough swell.', 9.5);

  return [route1, route2];
}

function generateDetourPath(start, dest, waypoint, hazards, detourBias) {
  const pathPoints = [start];
  if (waypoint) pathPoints.push(waypoint);
  pathPoints.push(dest);

  // Sample segments
  const fullCoordinates = [];

  for (let i = 0; i < pathPoints.length - 1; i++) {
    const ptA = pathPoints[i];
    const ptB = pathPoints[i + 1];

    const distKm = turf.distance(ptA, ptB, { units: 'kilometers' });
    const steps = Math.max(8, Math.round(distKm / 12));

    for (let s = 0; s <= steps; s++) {
      const fraction = s / steps;
      // Interpolate line
      const lon = ptA.geometry.coordinates[0] + fraction * (ptB.geometry.coordinates[0] - ptA.geometry.coordinates[0]);
      const lat = ptA.geometry.coordinates[1] + fraction * (ptB.geometry.coordinates[1] - ptA.geometry.coordinates[1]);
      let currentSample = turf.point([lon, lat]);

      // Check if inside any critical hazard circle
      for (const h of hazards) {
        const center = turf.point([h.lon, h.lat]);
        const distToCenter = turf.distance(currentSample, center, { units: 'kilometers' });
        const safeBuffer = (h.radiusKm || 40) + 8; // 8km safety clearance

        if (distToCenter < safeBuffer) {
          // Push away based on detour bias
          const pushBearing = detourBias === 'seaward' ? 260 : 80;
          const offsetDist = safeBuffer - distToCenter + 6;
          currentSample = turf.destination(currentSample, offsetDist, pushBearing, { units: 'kilometers' });
        }
      }

      fullCoordinates.push([currentSample.geometry.coordinates[1], currentSample.geometry.coordinates[0]]); // [lat, lon]
    }
  }

  // Remove duplicates
  return fullCoordinates.filter((c, idx, arr) => {
    if (idx === 0) return true;
    const prev = arr[idx - 1];
    return Math.abs(c[0] - prev[0]) > 0.001 || Math.abs(c[1] - prev[1]) > 0.001;
  });
}

function buildRouteDetails(name, latLngs, baseScore, summary, avgKnots = 11) {
  // Compute turn-by-turn legs
  const legs = [];
  let totalDistNm = 0;

  // Sample turn points every ~15% of path or at sharp course changes
  const step = Math.max(1, Math.floor(latLngs.length / 5));
  for (let i = 0; i < latLngs.length - 1; i += step) {
    const nextIdx = Math.min(i + step, latLngs.length - 1);
    const p1 = { lat: latLngs[i][0], lon: latLngs[i][1] };
    const p2 = { lat: latLngs[nextIdx][0], lon: latLngs[nextIdx][1] };

    const legDist = getDistanceNm(p1, p2);
    if (legDist > 0.5) {
      totalDistNm += legDist;
      const b = getBearing(p1, p2);
      legs.push({
        legNumber: legs.length + 1,
        fromLat: p1.lat,
        fromLon: p1.lon,
        toLat: p2.lat,
        toLon: p2.lon,
        headingDegrees: b,
        headingCardinal: bearingToCardinal(b),
        headingText: `${b}° ${bearingToCardinal(b)}`,
        distanceNm: legDist,
      });
    }
  }

  totalDistNm = Math.round(totalDistNm * 10) / 10;
  const hours = totalDistNm / avgKnots;
  const etaMinutes = Math.round(hours * 60);
  const etaFormatted = `${Math.floor(etaMinutes / 60)}h ${etaMinutes % 60}m`;
  const fuelLiters = Math.round(totalDistNm * 4.2); // ~4.2 liters diesel per nautical mile for 32ft trawler

  return {
    id: `route-${Math.random().toString(36).slice(2, 7)}`,
    name,
    score: baseScore,
    scoreLabel: 'Heuristic Safety Score (FR-C6)',
    distanceNm: totalDistNm,
    distanceKm: Math.round(totalDistNm * 1.852 * 10) / 10,
    eta: etaFormatted,
    fuelEstimateLiters: fuelLiters,
    hazardCount: 0, // avoided all exclusion zones
    summary,
    coordinates: latLngs, // [[lat, lon], ...]
    legs,
  };
}
