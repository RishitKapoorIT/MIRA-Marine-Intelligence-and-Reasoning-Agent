/**
 * PFZ Data Adapter
 * Communicates with ORCA's self-hosted FastAPI XGBoost prediction service (services/pfz-api).
 * Returns real predicted fishing zones (BEST, GOOD, POOR) with confidence percentages,
 * synthesized oceanographic telemetry (MODIS SST, chlorophyll-a, salinity, currents),
 * and numbered ocean sectors (1–20) per Part F.
 */

const PFZ_API_BASE = import.meta.env.VITE_PFZ_API_BASE || 'http://localhost:8000';

/**
 * Returns numbered ocean sector (1–20) for Indian coastal EEZ coordinates (Part F).
 */
export function getSectorForCoordinates(lat, lon) {
  if (lon < 75) {
    if (lat >= 21) return 'Sector 1'; // Gujarat North / Porbandar
    if (lat >= 20) return 'Sector 2'; // Saurashtra / Veraval
    if (lat >= 18) return 'Sector 3'; // North Konkan / Mumbai
    if (lat >= 16) return 'Sector 4'; // South Konkan / Ratnagiri
    if (lat >= 15) return 'Sector 5'; // Goa Shelf
    if (lat >= 14) return 'Sector 6'; // North Kanara / Karwar
    return 'Sector 7'; // South Kanara / Mangalore & Malpe
  } else if (lon < 78) {
    if (lat >= 11) return 'Sector 8'; // Malabar / Kannur & Kozhikode
    if (lat >= 9)  return 'Sector 9'; // Cochin & Quilon
    return 'Sector 10'; // Travancore & Kanyakumari
  } else if (lon < 81) {
    if (lat < 10) return 'Sector 11'; // Gulf of Mannar & Palk Bay
    if (lat < 12) return 'Sector 12'; // Coromandel South / Nagapattinam
    return 'Sector 13'; // Coromandel North / Chennai
  } else if (lon < 85) {
    if (lat < 16) return 'Sector 14'; // Andhra South / Machilipatnam
    return 'Sector 15'; // Andhra North / Visakhapatnam
  } else if (lon < 88) {
    if (lat < 20) return 'Sector 16'; // Kalinga Coast / Puri
    return 'Sector 17'; // Utkal Shelf / Paradip
  } else if (lon < 91) {
    if (lat <= 21.6) return 'Sector 18'; // Bengal Shelf / Digha
    return 'Sector 19'; // Sundarbans Estuarine Delta
  } else {
    return 'Sector 20'; // Andaman & Nicobar Waters
  }
}

/**
 * Determines state code prefix based on coordinates.
 */
function getRegionCodeForCoord(lat, lon) {
  if (lon < 75) {
    if (lat >= 20) return 'GJ';
    if (lat >= 16) return 'MH';
    if (lat >= 15) return 'GA';
    return 'KA';
  } else if (lon < 78) {
    return 'KL';
  } else if (lon < 81) {
    return 'TN';
  } else if (lon < 85) {
    return 'AP';
  } else if (lon < 88) {
    return 'OD';
  } else if (lon < 91) {
    return 'WB';
  }
  return 'AN';
}

/**
 * Species heuristic lookup based on sea surface temperature bucket.
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
 * Ensures the candidate coordinates project seaward:
 * West/Southwest for the West Coast of India, East/Southeast for the East Coast.
 */
export function generateCandidateCoordinates(centerLat, centerLon, count = 16) {
  const coords = [];
  const distanceBands = [0.15, 0.28, 0.45, 0.65]; // roughly 9 to 40 nm offshore

  // Dynamic seaward projection:
  // East Coast (Lon > 78.5) projects East into Bay of Bengal (angles 20° to 170°)
  // West Coast (Lon <= 78.5) projects West into Arabian Sea (angles 190° to 335°)
  const isEastCoast = centerLon > 78.5;
  const angles = isEastCoast
    ? [20, 45, 70, 90, 110, 135, 160, 180]
    : [190, 215, 240, 260, 275, 290, 310, 330];

  let idCounter = 1;
  for (const dist of distanceBands) {
    for (const deg of angles) {
      if (coords.length >= count) break;
      const rad = (deg * Math.PI) / 180;
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
 */
export async function getPfzLayer(centerLat = 12.914, centerLon = 74.856, options = {}) {
  const count = options.count || 16;
  const regionCode = options.regionCode || getRegionCodeForCoord(centerLat, centerLon);
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
      const sector = getSectorForCoordinates(p.latitude, p.longitude);

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
        sector: sector,
        isLive: true,
        hasHazardOverlap: distNm > 35,
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
      const sector = getSectorForCoordinates(c.latitude, c.longitude);

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
        sector: sector,
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
 * Returns formatted zone array for Leaflet Map layers (PfzLayer.jsx compatibility).
 */
export async function getPfzZones(centerLat, centerLon) {
  const res = await getPfzLayer(centerLat, centerLon, { count: 8 });
  return (res.zones || []).map(z => ({
    id: z.id,
    label: `${z.id} · ${z.sector || 'Sector'} (${z.expectedSpecies})`,
    lat: z.lat,
    lon: z.lon,
    radiusM: 8000,
    distanceKm: z.distanceKm,
    bearing: z.bearing,
    isMock: !res.isLive,
  }));
}

/**
 * Sorts zones client-side by criteria.
 */
export function sortZones(zones, criteria = 'yield') {
  const list = [...zones];
  if (criteria === 'yield') {
    const rankMap = { BEST: 3, GOOD: 2, POOR: 1 };
    return list.sort((a, b) => {
      const rDiff = rankMap[b.predictedZone] - rankMap[a.predictedZone];
      if (rDiff !== 0) return rDiff;
      return b.confidence - a.confidence;
    });
  } else if (criteria === 'nearest') {
    return list.sort((a, b) => a.distanceNm - b.distanceNm);
  } else if (criteria === 'safest') {
    return list.sort((a, b) => {
      if (a.hasHazardOverlap && !b.hasHazardOverlap) return 1;
      if (!a.hasHazardOverlap && b.hasHazardOverlap) return -1;
      return a.distanceNm - b.distanceNm;
    });
  }
  return list;
}
