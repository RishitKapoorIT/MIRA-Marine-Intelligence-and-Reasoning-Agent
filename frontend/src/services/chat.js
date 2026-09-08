/**
 * Chat: streaming and non-streaming.
 *
 * WHY NOT EventSource: the browser's EventSource only issues GET requests and
 * cannot send a body, so it cannot carry the query. This uses fetch with a
 * ReadableStream and parses the SSE wire format directly.
 *
 * THE PARSER IS THE RISKY PART. Network chunks do not align to SSE frames — a
 * single read can end mid-field, or deliver three frames at once. A parser
 * that assumes one chunk equals one frame works perfectly on localhost and
 * corrupts answers over a real mobile connection, which is precisely the
 * network our users are on. Hence the retained buffer and the tests in
 * services/__tests__/sse.test.mjs.
 */

import { API_V1 } from './config.js';
import { ApiError, AuthError, NetworkError, post } from './http.js';

/**
 * Incremental SSE parser.
 *
 * Feed it arbitrary string chunks; it returns whatever complete frames those
 * chunks completed, and retains any partial frame for the next call.
 */
export function createSseParser() {
  let buffer = '';

  return {
    /** @returns {Array<{event: string, data: any, raw: string}>} */
    push(chunk) {
      buffer += chunk;
      const frames = [];

      // Frames are separated by a blank line. \r\n tolerated for proxies that
      // rewrite line endings.
      let index;
      while ((index = buffer.search(/\r?\n\r?\n/)) !== -1) {
        const rawFrame = buffer.slice(0, index);
        buffer = buffer.slice(index + buffer.match(/\r?\n\r?\n/)[0].length);

        const parsed = parseFrame(rawFrame);
        if (parsed) frames.push(parsed);
      }
      return frames;
    },

    /** Anything left unterminated when the stream closed. */
    flush() {
      const remainder = buffer.trim();
      buffer = '';
      return remainder ? [parseFrame(remainder)].filter(Boolean) : [];
    },
  };
}

function parseFrame(rawFrame) {
  let eventName = 'message';
  const dataLines = [];

  for (const line of rawFrame.split(/\r?\n/)) {
    // Comment / keepalive. The backend sends ": keepalive" every 15s so
    // proxies do not close an idle connection mid-turn.
    if (line.startsWith(':')) continue;

    const colon = line.indexOf(':');
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? '' : line.slice(colon + 1);
    if (value.startsWith(' ')) value = value.slice(1); // spec: strip one space

    if (field === 'event') eventName = value;
    else if (field === 'data') dataLines.push(value);
  }

  if (dataLines.length === 0) return null; // keepalive-only frame

  // Multi-line data fields are joined with newlines, per the SSE spec.
  const raw = dataLines.join('\n');
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    data = raw; // not JSON; hand it over untouched rather than dropping it
  }
  return { event: eventName, data, raw };
}

/**
 * Stream a chat turn.
 *
 * Async generator yielding {event, data} in arrival order. Event types:
 *   turn_started · context_resolved · plan · agent_started · agent_completed
 *   verdict · answer_delta · answer_fallback · turn_completed · error
 *
 * answer_delta carries an INCREMENT. Accumulate it; do not replace. Use
 * createTurnAccumulator below rather than reimplementing that per component.
 */
export async function* streamChat({ queryText, conversationId = null, wasVoiceInput = false, signal } = {}) {
  const url = `${API_V1}/chat?stream=true`;

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify({
        query_text: queryText,
        conversation_id: conversationId,
        was_voice_input: wasVoiceInput,
      }),
      signal,
    });
  } catch (err) {
    if (signal?.aborted) throw err;
    throw new NetworkError('Could not reach the ORCA backend', url, err);
  }

  if (response.status === 401) throw new AuthError(null, url);
  if (!response.ok) {
    let detail = response.statusText;
    try {
      detail = (await response.json())?.detail ?? detail;
    } catch { /* body was not JSON */ }
    throw new ApiError(response.status, detail, url);
  }
  if (!response.body) {
    throw new NetworkError('Response carried no readable stream', url);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const parser = createSseParser();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      // stream:true so a multi-byte character split across chunks is not
      // mangled — this matters for Hindi and Kannada answers.
      for (const frame of parser.push(decoder.decode(value, { stream: true }))) {
        yield frame;
      }
    }
    for (const frame of parser.flush()) yield frame;
  } finally {
    // Releases the connection when the consumer breaks out early. The backend
    // keeps running the turn and persists it regardless, so an abandoned
    // stream loses the live view but not the answer.
    try { await reader.cancel(); } catch { /* already closed */ }
  }
}

/**
 * Reduces the event stream into renderable turn state.
 *
 * Keeps answer accumulation and agent-status tracking in one tested place
 * instead of spread across components.
 */
export function createTurnAccumulator() {
  const state = {
    status: 'streaming',
    query: null,
    location: null,
    window: null,
    plan: null,
    agents: {},        // name -> {status, summary, latencyMs, error}
    agentOrder: [],
    verdict: null,
    verdictReasons: [],
    cappedByMissingInput: false,
    answer: '',
    missingInputs: [],
    evidence: [],
    disclosures: [],
    turnId: null,
    conversationId: null,
    latencyMs: null,
    error: null,
  };

  function apply({ event, data }) {
    switch (event) {
      case 'turn_started':
        state.query = data.query;
        break;
      case 'context_resolved':
        state.location = {
          latitude: data.latitude,
          longitude: data.longitude,
          resolutionRoute: data.resolution_route,
          label: data.label,
        };
        state.window = { description: data.window, assumed: data.window_assumed };
        break;
      case 'plan':
        state.plan = data;
        break;
      case 'agent_started':
        if (!state.agentOrder.includes(data.agent)) state.agentOrder.push(data.agent);
        state.agents[data.agent] = { status: 'running' };
        break;
      case 'agent_completed':
        state.agents[data.agent] = {
          status: data.status,
          summary: data.summary,
          latencyMs: data.latency_ms,
          error: data.error,
          missingInputs: data.missing_inputs || [],
          // Public findings only; the backend strips its internal carriers.
          findings: data.findings || null,
        };
        break;
      case 'verdict':
        state.verdict = data.verdict;
        state.verdictReasons = data.reasons || [];
        state.cappedByMissingInput = Boolean(data.capped_by_missing_input);
        state.missingInputs = data.missing_inputs || [];
        break;
      case 'answer_delta':
        state.answer += data.text;   // INCREMENT, not replacement
        break;
      case 'answer_fallback':
        // Synthesis failed and the backend sent assembled specialist
        // summaries instead. It never arrived as deltas, so replace.
        state.answer = data.text;
        break;
      case 'turn_completed':
        state.turnId = data.turn_id;
        state.conversationId = data.conversation_id;
        state.status = data.status;
        state.verdict = data.verdict ?? state.verdict;
        state.missingInputs = data.missing_inputs || state.missingInputs;
        state.evidence = data.evidence || [];
        state.disclosures = data.disclosures || [];
        state.latencyMs = data.latency_ms;
        break;
      case 'error':
        state.status = 'failed';
        state.error = data.message;
        break;
      default:
        break; // unknown future event types are ignored, not fatal
    }
    return { ...state };
  }

  return { apply, get: () => ({ ...state }) };
}

/** Non-streaming turn. Same graph, single JSON payload. */
export function sendChat({ queryText, conversationId = null, wasVoiceInput = false, signal } = {}) {
  return post(
    '/chat',
    { query_text: queryText, conversation_id: conversationId, was_voice_input: wasVoiceInput },
    { signal, timeout: 60000 },
  );
}