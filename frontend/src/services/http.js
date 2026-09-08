/**
 * HTTP layer.
 *
 * THE ONE RULE: this module never invents data.
 *
 * The previous AuthContext caught every failure and fabricated a user; the old
 * ChatPage fell back to bundled sample weather and PFZ layers. That behaviour
 * defeats the backend outright — the coverage gate, the `not_covered` status,
 * the staleness flags and the evidence timestamps all exist so a fisherman is
 * never shown a number nobody measured. A UI that substitutes plausible mock
 * data when the API fails reintroduces exactly the failure those guards remove,
 * and FR-I6.1 is explicit that absence of data is reported as absence.
 *
 * So: every failure throws. Callers render an explicit error state. There is
 * no default value, no cached stand-in, no "offline demo mode".
 */

import { API_V1, REQUEST_TIMEOUT_MS } from './config.js';

/** The server responded, but with an error status. */
export class ApiError extends Error {
  constructor(status, detail, url) {
    super(detail || `Request failed with status ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
    this.url = url;
  }
}

/** The server could not be reached at all — down, wrong port, CORS, offline.
 *  Kept distinct from ApiError so the UI can say "cannot reach ORCA" rather
 *  than reporting a server response that never happened. */
export class NetworkError extends Error {
  constructor(message, url, cause) {
    super(message);
    this.name = 'NetworkError';
    this.url = url;
    this.cause = cause;
  }
}

/** 401. The session is missing, expired or revoked. */
export class AuthError extends ApiError {
  constructor(detail, url) {
    super(401, detail || 'Not authenticated', url);
    this.name = 'AuthError';
  }
}

async function parseDetail(response) {
  try {
    const body = await response.json();
    if (typeof body?.detail === 'string') return body.detail;
    if (Array.isArray(body?.detail)) {
      // FastAPI validation errors
      return body.detail.map((d) => d.msg || JSON.stringify(d)).join('; ');
    }
    return JSON.stringify(body);
  } catch {
    return response.statusText;
  }
}

/**
 * Perform a request against the ORCA API.
 *
 * credentials: 'include' on every call — the session is an httpOnly cookie
 * that JavaScript deliberately cannot read, so it only travels if we ask for
 * it. That is also why there is no Authorization header anywhere in this
 * layer; the old localStorage bearer token was readable by any script on the
 * page and is not coming back.
 */
export async function request(path, { method = 'GET', body, signal, timeout = REQUEST_TIMEOUT_MS, headers = {} } = {}) {
  const url = `${API_V1}${path}`;

  // Compose caller cancellation with our own timeout.
  const timeoutController = new AbortController();
  const timer = timeout ? setTimeout(() => timeoutController.abort(), timeout) : null;
  const signals = [timeoutController.signal, signal].filter(Boolean);
  const composed = signals.length > 1 && AbortSignal.any
    ? AbortSignal.any(signals)
    : signals[0];

  let response;
  try {
    response = await fetch(url, {
      method,
      credentials: 'include',
      headers: body ? { 'Content-Type': 'application/json', ...headers } : headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: composed,
    });
  } catch (err) {
    if (signal?.aborted) throw err; // caller cancelled; not a failure
    if (timeoutController.signal.aborted) {
      throw new NetworkError(`Request timed out after ${timeout}ms`, url, err);
    }
    throw new NetworkError('Could not reach the ORCA backend', url, err);
  } finally {
    if (timer) clearTimeout(timer);
  }

  if (response.status === 401) {
    throw new AuthError(await parseDetail(response), url);
  }
  if (!response.ok) {
    throw new ApiError(response.status, await parseDetail(response), url);
  }
  if (response.status === 204) return null;

  return response.json();
}

export const get = (path, options) => request(path, { ...options, method: 'GET' });
export const post = (path, body, options) => request(path, { ...options, method: 'POST', body });
export const put = (path, body, options) => request(path, { ...options, method: 'PUT', body });
export const del = (path, options) => request(path, { ...options, method: 'DELETE' });

/**
 * Liveness probe for a connection banner.
 *
 * Returns a status object rather than throwing, because this is the one call
 * whose *failure* is the useful answer. Everything else throws.
 */
export async function checkHealth() {
  try {
    const response = await fetch(`${API_V1.replace('/api/v1', '')}/health`, {
      credentials: 'include',
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return { online: false, reason: `HTTP ${response.status}` };
    return { online: true, ...(await response.json()) };
  } catch (err) {
    return { online: false, reason: err.message };
  }
}