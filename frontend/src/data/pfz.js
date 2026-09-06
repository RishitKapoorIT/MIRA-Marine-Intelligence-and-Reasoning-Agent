/**
 * PFZ Data Adapter
 * Communicates with ORCA's self-hosted FastAPI XGBoost prediction service (services/pfz-api).
 * Returns real predicted fishing zones (BEST, GOOD, POOR) with confidence percentages,
 * synthesized oceanographic telemetry (MODIS SST, chlorophyll-a, salinity, currents),
 * and client-side species heuristics.
 */

const PFZ_API_BASE = import.meta.env.VITE_PFZ_API_BASE || 'http://localhost:8000';

/**
 * Species heuristic lookup based on sea surface temperature bucket.
 * Explicitly documented as a plain-language heuristic, not a direct ML prediction (FR-G1/FR-C6).
 */
export function getExpectedSpecies(temp) {
  if (temp >= 29.5) {
    return 'Indian Mackerel & Oil Sardine';
  } else if (temp >= 28.0) {
    return 'Yellowfin Tuna, Skipjack & Pelagics';
  } else if (temp >= 26.5) {
    return 'Seer Fish, Trevally & Anchovies';
  } else {
    return 'Squid, Ribbonfish & Reef Perch';
  }
}

/**
 * Calculates great-circle distance between two points in Nautical Miles (nm).
 */
export function calculateDistanceNm(lat1, lon1, lat2, lon2) {
  const R = 3440.065; // Earth radius in nautical miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

/**
 * Calculates initial compass bearing in degrees and cardinal direction.
 */
export function calculateBearing(lat1, lon1, lat2, lon2) {
  const y = Math.sin(((lon2 - lon1) * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180);
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.cos(((lon2 - lon1) * Math.PI) / 180);
  let brng = (Math.atan2(y, x) * 180) / Math.PI;
  brng = (brng + 360) % 360;

  const cardinals = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const idx = Math.round(brng / 22.5) % 16;
  return {
    degrees: Math.round(brng),
    cardinal: cardinals[idx],
    formatted: `${Math.round(brng)}° ${cardinals[idx]}`,
  };
}

/**
 * Generates an exploratory ring of coordinates offshore from the user's reference point.
 * Ensures the candidate coordinates project seaward (West/Southwest for the West Coast of India).
 */
export function generateCandidateCoordinates(centerLat, centerLon, count = 16) {
  const coords = [];
  const distanceBands = [0.15, 0.28, 0.45, 0.65]; // roughly 9 to 40 nm offshore
  const angles = [190, 215, 240, 260, 275, 290, 310, 330];

  let idCounter = 1;
  for (const dist of distanceBands) {
    for (const deg of angles) {
      if (coords.length >= count) break;
      const rad = (deg * Math.PI) / 180;
      // Adjust longitude scale by latitude cosine
      const dLat = dist * Math.cos(rad);
      const dLon = (dist * Math.sin(rad)) / Math.cos((centerLat * Math.PI) / 180);
      coords.push({
        id: idCounter++,
        latitude: parseFloat((centerLat + dLat).toFixed(4)),
        longitude: parseFloat((centerLon + dLon).toFixed(4)),
      });
    }
    if (coords.length >= count) break;
  }
  return coords;
}

/**
 * Main function to fetch PFZ predictions from the FastAPI service.
 * @param {number} centerLat 
 * @param {number} centerLon 
 * @param {object} options { count: 16, year: 2024, month: 6, regionCode: 'KA' }
 * @returns {Promise<{ zones: Array, isLive: boolean, totalInputs: number, zoneSummary: object }>}
 */
export async function getPfzLayer(centerLat = 12.914, centerLon = 74.856, options = {}) {
  const count = options.count || 16;
  const regionCode = options.regionCode || 'KA';
  const candidates = generateCandidateCoordinates(centerLat, centerLon, count);

  try {
    const payload = {
      coordinates: candidates.map(c => ({ latitude: c.latitude, longitude: c.longitude })),
      year: options.year || 2024,
      month: options.month || 6,
    };

    const response = await fetch(`${PFZ_API_BASE}/api/v1/predict/batch_coords`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(6000),
    });

    if (!response.ok) {
      throw new Error(`PFZ API responded with HTTP ${response.status}`);
    }

    const data = await response.json();
    const predictions = data.predictions || [];

    const zones = predictions.map((p, idx) => {
      const distNm = calculateDistanceNm(centerLat, centerLon, p.latitude, p.longitude);
      const bearing = calculateBearing(centerLat, centerLon, p.latitude, p.longitude);
      const temp = p.features_generated?.temperature ?? 28.5;
      const chl = p.features_generated?.chlorophyll ?? 0.35;
      const currentSpeed = p.features_generated?.current_speed ?? 0.15;
      const salinity = p.features_generated?.salinity ?? 35.0;

      return {
        id: `PFZ-${regionCode}-${String(idx + 1).padStart(2, '0')}`,
        index: idx + 1,
        lat: p.latitude,
        lon: p.longitude,
        predictedZone: p.predicted_zone, // 'BEST', 'GOOD', 'POOR'
        confidence: p.confidence_percent,
        classProbabilities: p.class_probabilities,
        distanceNm: distNm,
        distanceKm: Math.round(distNm * 1.852 * 10) / 10,
        bearing: bearing.formatted,
        bearingDegrees: bearing.degrees,
        bearingCardinal: bearing.cardinal,
        expectedSpecies: getExpectedSpecies(temp),
        temperature: temp,
        chlorophyll: chl,
        salinity: salinity,
        currentSpeed: currentSpeed,
        isLive: true,
        hasHazardOverlap: distNm > 35, // outer band simulated hazard proximity for filtering
        attribution: "ORCA's own PFZ model over public satellite data (not INCOIS certified)",
      };
    });

    return {
      zones,
      isLive: true,
      totalInputs: data.total_inputs,
      zoneSummary: data.zone_summary,
    };
  } catch (err) {
    console.warn('PFZ Backend unavailable, falling back to simulated empirical zones (FR-C6):', err.message);
    
    // Robust graceful fallback
    const fallbackZones = candidates.map((c, idx) => {
      const distNm = calculateDistanceNm(centerLat, centerLon, c.latitude, c.longitude);
      const bearing = calculateBearing(centerLat, centerLon, c.latitude, c.longitude);
      const temp = Number((28.2 + ((idx * 0.3) % 2.2)).toFixed(1));
      const chl = Number((0.25 + ((idx * 0.08) % 0.45)).toFixed(2));
      const zoneGrade = idx % 3 === 0 ? 'BEST' : idx % 3 === 1 ? 'GOOD' : 'POOR';
      const conf = Number((82 + ((idx * 3.7) % 15)).toFixed(1));

      return {
        id: `PFZ-${regionCode}-${String(idx + 1).padStart(2, '0')}`,
        index: idx + 1,
        lat: c.latitude,
        lon: c.longitude,
        predictedZone: zoneGrade,
        confidence: conf,
        classProbabilities: { BEST: 0.72, GOOD: 0.21, POOR: 0.07 },
        distanceNm: distNm,
        distanceKm: Math.round(distNm * 1.852 * 10) / 10,
        bearing: bearing.formatted,
        bearingDegrees: bearing.degrees,
        bearingCardinal: bearing.cardinal,
        expectedSpecies: getExpectedSpecies(temp),
        temperature: temp,
        chlorophyll: chl,
        salinity: 35.1,
        currentSpeed: 0.18,
        isLive: false,
        hasHazardOverlap: distNm > 35,
        attribution: "ORCA's sample PFZ layer (model service offline)",
      };
    });

    return {
      zones: fallbackZones,
      isLive: false,
      totalInputs: fallbackZones.length,
      zoneSummary: { BEST: 5, GOOD: 6, POOR: 5 },
    };
  }
}

/**
 * Helper to sort zones client-side per Frame 06 specifications.
 * @param {Array} zones 
 * @param {'nearest' | 'yield' | 'safest'} filterType 
 */
export function sortZones(zones, filterType = 'nearest') {
  const cloned = [...zones];
  if (filterType === 'nearest') {
    return cloned.sort((a, b) => a.distanceNm - b.distanceNm);
  } else if (filterType === 'yield') {
    const rankWeight = { BEST: 3, GOOD: 2, POOR: 1 };
    return cloned.sort((a, b) => {
      const weightDiff = (rankWeight[b.predictedZone] || 0) - (rankWeight[a.predictedZone] || 0);
      if (weightDiff !== 0) return weightDiff;
      return b.confidence - a.confidence;
    });
  } else if (filterType === 'safest') {
    return cloned.sort((a, b) => {
      if (a.hasHazardOverlap !== b.hasHazardOverlap) {
        return a.hasHazardOverlap ? 1 : -1;
      }
      return b.confidence - a.confidence;
    });
  }
}

/**
 * Backward-compatible adapter for Frame 02's PfzLayer.jsx.
 */
export async function getPfzZones(lat, lon) {
  const res = await getPfzLayer(lat, lon, { count: 8 });
  return res.zones.map(z => ({
    ...z,
    label: `${z.id} (${z.predictedZone} Grade - ${z.confidence}% Conf)`,
    radiusM: z.predictedZone === 'BEST' ? 35000 : 25000,
    isMock: !res.isLive,
  }));
}
