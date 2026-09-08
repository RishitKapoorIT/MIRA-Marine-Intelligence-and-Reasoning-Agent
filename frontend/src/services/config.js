/**
 * API configuration.
 *
 * ONE origin. The frontend talks only to the ORCA backend on :8000.
 *
 * It must never call services/pfz-api on :8001 directly. FR-E1.2 requires PFZ
 * zones to be served from the batch-computed cache rather than derived during
 * a request, and the backend's /api/v1/pfz/zones is what enforces that — along
 * with the coverage gate that stops a partial run answering for a stretch of
 * coast it never evaluated. A direct call to the model service bypasses both.
 *
 * The old VITE_AUTH_API_BASE / VITE_PFZ_API_BASE split is retired along with
 * services/auth-api.
 */

function readEnv(key, fallback) {
  // import.meta.env exists under Vite; guarded so these modules are also
  // importable from plain Node for tests.
  const env = typeof import.meta !== 'undefined' ? import.meta.env : undefined;
  return (env && env[key]) || fallback;
}

export const API_BASE = readEnv('VITE_API_BASE', 'http://localhost:8000');
export const API_V1 = `${API_BASE}/api/v1`;

/** Default timeout for ordinary requests. The chat stream is exempt — it is
 *  long-lived by design and is cancelled by AbortController instead. */
export const REQUEST_TIMEOUT_MS = 20000;