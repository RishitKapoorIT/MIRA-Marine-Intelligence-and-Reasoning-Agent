/**
 * Potential Fishing Zones (FR-E1, FR-G5).
 *
 * FOUR STATUSES, FOUR DIFFERENT SCREENS. Collapsing any of these into "no
 * zones found" throws away the distinction the backend works hardest to keep:
 *
 *   ok            zones were computed and are listed
 *   empty         the area WAS analysed and nothing qualified — a real finding
 *   not_covered   the analysis never reached this area; we did not look
 *   unavailable   no generation has ever published
 *
 * `empty` and `not_covered` look identical if you only check zones.length, and
 * conflating them tells a fisherman at Karwar "no fish here" when the truth is
 * "we have no idea about here". That is the exact failure the 0.5-degree
 * coverage cells were added to prevent.
 */

import { get } from './http.js';

export const PFZ_STATUS = {
  OK: 'ok',
  EMPTY: 'empty',
  NOT_COVERED: 'not_covered',
  UNAVAILABLE: 'unavailable',
};

export const PFZ_EMPTY_REASON = {
  NO_QUALIFYING_CONDITIONS: 'no_qualifying_conditions',
  INSUFFICIENT_COVERAGE: 'insufficient_coverage',
};

export async function getZones({ lat, lon, limit = 10, signal } = {}) {
  const params = new URLSearchParams();
  if (lat != null) params.set('lat', String(lat));
  if (lon != null) params.set('lon', String(lon));
  if (limit != null) params.set('limit', String(limit));

  const raw = await get(`/pfz/zones?${params.toString()}`, { signal });

  return {
    status: raw.status,
    message: raw.message || null,
    emptyReason: raw.empty_reason || null,
    isStale: Boolean(raw.is_stale),
    observationDate: raw.observation_date || null,
    coverageFraction: raw.coverage_fraction ?? null,
    queryPoint: raw.query_point,
    zones: (raw.zones || []).map(toUiZone),
    disclosures: raw.disclosures || [],
    rankingNote: raw.ranking_note || null,
    methodologyUrl: raw.methodology_url,
  };
}

function toUiZone(z) {
  return {
    id: z.id,
    zoneClass: z.zone_class,
    confidence: z.confidence,
    areaKm2: z.area_km2,
    distanceKm: z.distance_km,
    bearingDeg: z.bearing_deg,
    centroid: z.centroid,
    geometry: z.geometry,   // GeoJSON, ready for Leaflet
    evidence: {
      seaSurfaceTemperatureC: z.evidence?.sea_surface_temperature_c ?? null,
      // null with provenance kind 'unavailable'. Render it as unavailable —
      // never blank, never zero, never a plausible-looking placeholder.
      chlorophyllMgM3: z.evidence?.chlorophyll_mg_m3 ?? null,
      sstGradient: z.evidence?.sst_gradient ?? null,
      salinityPsu: z.evidence?.salinity_psu ?? null,
      featureProvenance: z.evidence?.feature_provenance ?? null,
      observationDate: z.evidence?.observation_date ?? null,
    },
    mpa: z.mpa_or_restricted,
  };
}

/** FR-G5.1 — must be reachable from any PFZ answer. */
export function getMethodology({ signal } = {}) {
  return get('/pfz/methodology', { signal });
}