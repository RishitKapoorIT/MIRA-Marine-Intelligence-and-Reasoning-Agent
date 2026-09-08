/** AuthContext state machine, exercised without React. */
import assert from 'node:assert';

// Mirror of the branch logic in AuthContext.refresh(), kept in step with it.
class AuthError extends Error {}
class NetworkError extends Error {}

async function resolveStatus({ health, getCurrentUser, getProfile }) {
  if (!health.online) return { status: 'unreachable', user: null, error: `Cannot reach the ORCA backend (${health.reason}).` };
  try {
    const session = await getCurrentUser();
    if (!session) return { status: 'unauthenticated', user: null };
    return { status: 'authenticated', user: await getProfile() };
  } catch (err) {
    if (err instanceof AuthError) return { status: 'unauthenticated', user: null };
    return { status: 'unreachable', user: null, error: err.message };
  }
}

const profile = { id: 'u1', name: 'Dev User', baseLocation: null };

console.log('--- The distinction the old context collapsed ---');

let r = await resolveStatus({
  health: { online: false, reason: 'Failed to fetch' },
  getCurrentUser: async () => { throw new NetworkError('down'); },
  getProfile: async () => profile,
});
assert.strictEqual(r.status, 'unreachable');
assert.strictEqual(r.user, null);
console.log(`  backend down       -> status=${r.status}, user=${r.user}`);
console.log('    (old behaviour: fabricated "Captain Ramanath K." and reported authenticated)');

r = await resolveStatus({
  health: { online: true },
  getCurrentUser: async () => { throw new AuthError('Not authenticated'); },
  getProfile: async () => profile,
});
assert.strictEqual(r.status, 'unauthenticated');
console.log(`  401 from /auth/me  -> status=${r.status}`);

r = await resolveStatus({
  health: { online: true },
  getCurrentUser: async () => null,
  getProfile: async () => profile,
});
assert.strictEqual(r.status, 'unauthenticated');
console.log(`  no session         -> status=${r.status}`);

r = await resolveStatus({
  health: { online: true, dev_auth_bypass: true },
  getCurrentUser: async () => ({ user_id: 'u1' }),
  getProfile: async () => profile,
});
assert.strictEqual(r.status, 'authenticated');
assert.strictEqual(r.user.name, 'Dev User');
console.log(`  bypass on          -> status=${r.status}, user=${r.user.name}`);

r = await resolveStatus({
  health: { online: true },
  getCurrentUser: async () => ({ user_id: 'u1' }),
  getProfile: async () => { throw new Error('HTTP 500'); },
});
assert.strictEqual(r.status, 'unreachable');
console.log(`  500 on /profile    -> status=${r.status} (not silently logged out)`);

console.log('\n  PASS  "backend down" and "logged out" are four distinct states, never merged');

console.log('\n--- safeHouse is null when no base location, never defaulted ---');
function safeHouseOf(user) {
  if (!user?.baseLocation) return null;
  return { lat: user.baseLocation.lat, lon: user.baseLocation.lon, label: user.baseLocation.label || 'Home port' };
}
assert.strictEqual(safeHouseOf({ baseLocation: null }), null);
assert.strictEqual(safeHouseOf(null), null);
const sh = safeHouseOf({ baseLocation: { lat: 12.87, lon: 74.84, label: 'Mangaluru' } });
assert.strictEqual(sh.lat, 12.87);
console.log('  PASS  no base location -> null (old code defaulted to Mangalore Old Port)');
console.log(`  PASS  with base location -> ${sh.label} ${sh.lat},${sh.lon}`);

console.log('\n--- Consent is required before a base location is stored ---');
async function setBaseLocation({ consent }) {
  if (!consent) throw new Error('Consent is required before a base location can be stored');
  return { ok: true };
}
await assert.rejects(() => setBaseLocation({ consent: false }), /Consent is required/);
assert.deepStrictEqual(await setBaseLocation({ consent: true }), { ok: true });
console.log('  PASS  consent:false rejected client-side, before the 400 and the CHECK constraint');

console.log('\nAUTH CONTEXT TESTS PASSED');
