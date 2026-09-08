/**
 * Hazard alerts (FR-F5).
 *
 * Deterministic read path. FR-F5.8 forbids the alerts view invoking the agent
 * layer, so this hits /alerts directly and never /chat.
 *
 * THREE LISTS, NOT ONE. The response separates active, expired and
 * ungeolocated alerts. That last one exists because NDMA alerts are often
 * district-based with no polygon, so they cannot be radius-matched — and
 * dropping them would show an empty list for a coast that has warnings in
 * force. An empty list reads as an all-clear (FR-F5.4), so a UI that renders
 * only `active` recreates the bug the backend fixed.
 */

import { get } from './http.js';

export const FEED_STATUS = { OK: 'ok', UNAVAILABLE: 'unavailable' };

export async function getAlerts({ lat, lon, radiusKm, includeExpired = false, signal } = {}) {
  const params = new URLSearchParams();
  if (lat != null) params.set('lat', String(lat));
  if (lon != null) params.set('lon', String(lon));
  if (radiusKm != null) params.set('radius_km', String(radiusKm));
  if (includeExpired) params.set('include_expired', 'true');

  const query = params.toString();
  const raw = await get(`/alerts${query ? `?${query}` : ''}`, { signal });

  return {
    feedStatus: raw.feed_status,
    // Non-null when the feed is unreachable or has never been polled. Render
    // it; do not let an empty list stand in for "no warnings".
    feedWarning: raw.feed_warning,
    lastSuccessfulUpdateAt: raw.last_successful_update_at,
    region: raw.region,
    active: (raw.active_alerts || []).map(toUiAlert),
    expired: (raw.expired_alerts || []).map(toUiAlert),
    ungeolocated: (raw.ungeolocated_alerts || []).map(toUiAlert),
    ungeolocatedNote: raw.ungeolocated_note,
    attribution: raw.attribution,
  };
}

function toUiAlert(a) {
  return {
    id: a.id,
    hazardType: a.hazard_type,
    severity: a.severity,
    urgency: a.urgency,
    certainty: a.certainty,
    // FR-F5.7 — original agency wording. Show this verbatim. A translation may
    // sit beside it, marked machine-translated, but must never replace it.
    headline: a.headline,
    description: a.description,
    instruction: a.instruction,
    originalLanguage: a.original_language,
    originatingAgency: a.originating_agency,
    areaDescription: a.area_description,
    onsetAt: a.onset_at,
    effectiveAt: a.effective_at,
    expiresAt: a.expires_at,
    isExpired: a.is_expired,
  };
}