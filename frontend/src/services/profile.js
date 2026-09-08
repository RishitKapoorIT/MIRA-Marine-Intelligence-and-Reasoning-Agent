/**
 * Profile and base location (FR-H3, FR-H5).
 *
 * FIELD NAMES ARE THE BACKEND'S. The old frontend used name / phone /
 * safe_house / aadhaar; the backend has display_name / phone_number /
 * base_location and deliberately has no Aadhaar column. Mapping is done here,
 * once, rather than in every component.
 *
 * There is no aadhaar field and no place to put one.
 */

import { del, get, put } from './http.js';

/** Backend shape -> UI shape. */
export function toUiProfile(raw) {
  if (!raw) return null;
  return {
    id: raw.user_id,
    phone: raw.phone_number,
    name: raw.display_name || '',
    preferredLanguage: raw.preferred_language || 'en',
    onboardingCompleted: Boolean(raw.onboarding_completed),
    baseLocation: raw.base_location
      ? {
          lat: raw.base_location.latitude,
          lon: raw.base_location.longitude,
          label: raw.base_location.label,
          consentedAt: raw.base_location.consented_at,
        }
      : null,
  };
}

export async function getProfile() {
  return toUiProfile(await get('/profile'));
}

/**
 * PUT /profile returns {"status": "updated"}, NOT the user object — the old
 * AuthContext did setUser(data.user) here and would have stored undefined.
 * Re-fetch so callers always receive the authoritative record.
 */
export async function updateProfile({ name, preferredLanguage } = {}) {
  const body = {};
  if (name !== undefined) body.display_name = name;
  if (preferredLanguage !== undefined) body.preferred_language = preferredLanguage;
  await put('/profile', body);
  return getProfile();
}

/**
 * FR-H3.2 — consent is recorded at the point of capture. The backend rejects
 * consent:false with a 400, and a CHECK constraint enforces the pairing at the
 * database level, so this is not a formality the UI can skip.
 */
export async function setBaseLocation({ lat, lon, label, consent }) {
  if (!consent) {
    throw new Error('Consent is required before a base location can be stored');
  }
  await put('/profile/base-location', {
    latitude: lat,
    longitude: lon,
    label: label || null,
    consent: true,
  });
  return getProfile();
}

/** FR-H5.1 — the user can delete it. */
export async function deleteBaseLocation() {
  await del('/profile/base-location');
  return getProfile();
}