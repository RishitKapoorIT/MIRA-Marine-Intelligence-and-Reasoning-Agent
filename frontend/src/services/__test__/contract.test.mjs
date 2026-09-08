/** Response-mapping tests using real backend payloads from the logs. */
import assert from 'node:assert';

// Stub fetch so the mappers can be exercised without a server.
let NEXT = null;
globalThis.fetch = async () => ({
  ok: true, status: 200,
  json: async () => NEXT,
});

const { getZones, PFZ_STATUS } = await import('../pfz.js');
const { getAlerts } = await import('../alerts.js');
const { toUiProfile } = await import('../profile.js');

console.log('--- PFZ: four statuses stay four statuses ---');

NEXT = { status: 'empty', empty_reason: 'no_qualifying_conditions', is_stale: false,
         coverage_fraction: 0.8598, zones: [], disclosures: [{ key: 'disclosure.pfz_not_certified' }] };
let r = await getZones({ lat: 12.87, lon: 74.84 });
assert.strictEqual(r.status, PFZ_STATUS.EMPTY);
assert.strictEqual(r.emptyReason, 'no_qualifying_conditions');
console.log(`  empty        -> status=${r.status} reason=${r.emptyReason} zones=${r.zones.length}`);

NEXT = { status: 'not_covered', message: 'The most recent analysis did not cover your area.',
         is_stale: false, zones: [], disclosures: [{ key: 'disclosure.pfz_partial_coverage' }] };
r = await getZones({ lat: 14.81, lon: 74.13 });
assert.strictEqual(r.status, PFZ_STATUS.NOT_COVERED);
assert.ok(r.message);
console.log(`  not_covered  -> status=${r.status} message present=${Boolean(r.message)}`);

// The distinction that matters: both have zero zones.
assert.strictEqual(r.zones.length, 0);
console.log('  PASS  empty and not_covered BOTH have zones.length === 0');
console.log('        -> a UI branching on zones.length alone would merge them');

NEXT = { status: 'unavailable', message: 'No PFZ product has been published yet.', zones: [], disclosures: [] };
assert.strictEqual((await getZones({})).status, PFZ_STATUS.UNAVAILABLE);
console.log('  unavailable  -> status=unavailable');

console.log('\n--- PFZ: chlorophyll is null with provenance, not zero ---');
NEXT = { status: 'ok', is_stale: false, observation_date: '2026-09-08', zones: [{
  id: 'z1', zone_class: 'BEST', confidence: 0.665, area_km2: 45464.46,
  distance_km: 12.4, bearing_deg: 315.0, geometry: { type: 'Polygon', coordinates: [] },
  evidence: { sea_surface_temperature_c: 28.79, chlorophyll_mg_m3: null,
              salinity_psu: 34.5,
              feature_provenance: { chlorophyll: { kind: 'unavailable',
                note: 'Not retrieved. NASA OB.DAAC requires Earthdata credentials.' } },
              observation_date: '2026-09-08' } }], disclosures: [] };
r = await getZones({ lat: 13, lon: 74.3 });
const z = r.zones[0];
assert.strictEqual(z.evidence.chlorophyllMgM3, null);
assert.notStrictEqual(z.evidence.chlorophyllMgM3, 0);
assert.strictEqual(z.evidence.featureProvenance.chlorophyll.kind, 'unavailable');
console.log(`  PASS  chlorophyll=${z.evidence.chlorophyllMgM3} (null, NOT 0) kind=${z.evidence.featureProvenance.chlorophyll.kind}`);
console.log(`        sst=${z.evidence.seaSurfaceTemperatureC} salinity=${z.evidence.salinityPsu} distance=${z.distanceKm}km`);

console.log('\n--- Alerts: three lists, and the feed-unreachable state ---');
NEXT = { feed_status: 'unavailable',
         feed_warning: 'Live hazard alert feed is currently unreachable.',
         last_successful_update_at: null, region: { latitude: 12.87, longitude: 74.84, radius_km: 25 },
         active_alerts: [], expired_alerts: [],
         ungeolocated_alerts: [{ id: 'a1', hazard_type: 'Cyclonic Storm', severity: 'Severe',
           headline: 'Warning', originating_agency: 'IMD', area_description: 'Dakshina Kannada',
           original_language: 'en', is_expired: false }],
         ungeolocated_note: 'These alerts name an affected area but carry no map geometry.',
         attribution: 'NDMA SACHET' };
const a = await getAlerts({ lat: 12.87, lon: 74.84 });
assert.strictEqual(a.feedStatus, 'unavailable');
assert.ok(a.feedWarning);
assert.strictEqual(a.active.length, 0);
assert.strictEqual(a.ungeolocated.length, 1);
console.log(`  active=${a.active.length} expired=${a.expired.length} ungeolocated=${a.ungeolocated.length}`);
console.log('  PASS  active is empty but feedWarning is set and 1 ungeolocated alert exists');
console.log('        -> rendering only `active` would show a false all-clear');
assert.strictEqual(a.ungeolocated[0].originatingAgency, 'IMD');
assert.strictEqual(a.ungeolocated[0].headline, 'Warning');
console.log('  PASS  original agency text and attribution preserved (FR-F5.7)');

console.log('\n--- Profile: backend field names mapped, no aadhaar ---');
const ui = toUiProfile({ user_id: 'u1', phone_number: '+910000000001',
  display_name: 'Dev User', preferred_language: 'en', onboarding_completed: true,
  base_location: { latitude: 12.87, longitude: 74.84, label: 'Mangaluru', consented_at: '2026-09-08T00:00:00Z' } });
assert.strictEqual(ui.name, 'Dev User');
assert.strictEqual(ui.phone, '+910000000001');
assert.strictEqual(ui.baseLocation.lat, 12.87);
assert.ok(!('aadhaar' in ui));
console.log(`  PASS  display_name->name, phone_number->phone, base_location->baseLocation`);
console.log(`  PASS  'aadhaar' in mapped profile: ${'aadhaar' in ui}`);

assert.strictEqual(toUiProfile({ user_id: 'u2', phone_number: '+91', base_location: null }).baseLocation, null);
console.log('  PASS  absent base location maps to null, not a default port');

console.log('\nCONTRACT TESTS PASSED');
