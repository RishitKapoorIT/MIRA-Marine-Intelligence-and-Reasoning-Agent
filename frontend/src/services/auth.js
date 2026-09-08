/**
 * Authentication (FR-H1, FR-H2).
 *
 * The session is an httpOnly cookie set by the backend. There is no token to
 * read, store or attach — that is the point. The retired services/auth-api
 * kept a bearer token in localStorage, where any script on the page could read
 * it; the cookie cannot be touched by JavaScript at all.
 *
 * Nothing here has an offline fallback. The old verifyOtp accepted "123456"
 * client-side when the backend was unreachable, which is an authentication
 * bypass that ships in the production bundle. A failed login now fails.
 */

import { get, post, AuthError } from './http.js';

/**
 * Exchange a Firebase ID token for an ORCA session.
 *
 * The client obtains id_token via the Firebase JS SDK after the user completes
 * phone OTP. Until that is wired, DEV_AUTH_BYPASS on the backend authenticates
 * every request as the development user and this call is unnecessary.
 */
export function verifyIdToken(idToken) {
  return post('/auth/verify', { id_token: idToken });
}

/** FR-H2.2 — server-side revocation, not just a cleared cookie. */
export function logout() {
  return post('/auth/logout', {});
}

/** Current session, or null when unauthenticated.
 *  Only AuthError is swallowed: "not logged in" is an answer, everything else
 *  (backend down, 500) must reach the caller. */
export async function getCurrentUser() {
  try {
    return await get('/auth/me');
  } catch (err) {
    if (err instanceof AuthError) return null;
    throw err;
  }
}