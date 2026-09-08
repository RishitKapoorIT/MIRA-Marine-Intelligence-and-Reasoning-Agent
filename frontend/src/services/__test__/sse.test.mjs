import assert from 'node:assert';
import { createSseParser, createTurnAccumulator } from '../chat.js';

const frame = (event, data) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

const STREAM =
  frame('turn_started', { query: 'Is it safe at Malpe tonight?' }) +
  frame('context_resolved', {
    latitude: 13.35, longitude: 74.7, resolution_route: 'named_place',
    label: 'malpe', window: 'tonight (IST)', window_assumed: false }) +
  frame('plan', { interpretation: 'safety check',
    steps: [{ agent: 'weather_agent', reason: 'conditions' },
            { agent: 'risk_agent', reason: 'verdict' }], needs_clarification: false }) +
  frame('agent_started', { agent: 'weather_agent' }) +
  frame('agent_completed', { agent: 'weather_agent', status: 'ok',
    summary: 'Waves up to 0.94 m.', latency_ms: 412, missing_inputs: [] }) +
  ': keepalive\n\n' +
  frame('verdict', { verdict: 'unsafe', capped_by_missing_input: false,
    missing_inputs: [], reasons: [{ factor: 'wind speed', detail: 'wind 15.5 m/s', source: 'open_meteo_forecast' }] }) +
  frame('agent_started', { agent: 'risk_agent' }) +
  frame('agent_completed', { agent: 'risk_agent', status: 'ok', summary: 'Unsafe.', latency_ms: 800 }) +
  frame('answer_delta', { text: 'Conditions ' }) +
  frame('answer_delta', { text: 'are ' }) +
  frame('answer_delta', { text: 'unsafe.' }) +
  frame('turn_completed', { turn_id: 'tid', conversation_id: 'cid', status: 'complete',
    verdict: 'unsafe', missing_inputs: [], evidence: [{ source_id: 'open_meteo_marine' }],
    disclosures: [{ key: 'disclosure.not_official_warning' }], latency_ms: 6412 });

function parseWithChunks(text, size) {
  const parser = createSseParser();
  const out = [];
  for (let i = 0; i < text.length; i += size) {
    out.push(...parser.push(text.slice(i, i + size)));
  }
  out.push(...parser.flush());
  return out;
}

console.log('--- Chunk-boundary robustness (the real-network failure mode) ---');
const whole = parseWithChunks(STREAM, STREAM.length);
console.log(`  whole stream in one chunk -> ${whole.length} frames`);
assert.strictEqual(whole.length, 12);

for (const size of [1, 3, 7, 13, 64, 200, 997]) {
  const frames = parseWithChunks(STREAM, size);
  assert.strictEqual(frames.length, 12, `chunk size ${size} gave ${frames.length}`);
  assert.deepStrictEqual(frames.map(f => f.event), whole.map(f => f.event));
  assert.deepStrictEqual(frames, whole);
  console.log(`  chunk size ${String(size).padStart(4)} -> 12 frames, identical`);
}
console.log('  PASS  1-byte chunks (worst case) parse identically to one big chunk');

console.log('\n--- Keepalive comments are skipped, not emitted ---');
assert.ok(!whole.some(f => f.raw.includes('keepalive')));
console.log('  PASS  ": keepalive" produced no frame');

console.log('\n--- CRLF line endings (proxies rewrite these) ---');
const crlf = STREAM.replace(/\n/g, '\r\n');
assert.strictEqual(parseWithChunks(crlf, 17).length, 12);
console.log('  PASS  \\r\\n stream parses to 12 frames');

console.log('\n--- Multi-line data fields (SSE spec: joined with \\n) ---');
const p = createSseParser();
const multi = p.push('event: note\ndata: line one\ndata: line two\n\n');
assert.strictEqual(multi[0].data, 'line one\nline two');
console.log('  PASS  two data lines joined with newline');

console.log('\n--- Unterminated trailing frame is recovered on flush ---');
const p2 = createSseParser();
assert.strictEqual(p2.push('event: x\ndata: {"a":1}').length, 0);
const flushed = p2.flush();
assert.strictEqual(flushed.length, 1);
assert.deepStrictEqual(flushed[0].data, { a: 1 });
console.log('  PASS  frame with no trailing blank line recovered');

console.log('\n--- Accumulator: answer_delta accumulates, never replaces ---');
const acc = createTurnAccumulator();
let state;
for (const f of whole) state = acc.apply(f);
assert.strictEqual(state.answer, 'Conditions are unsafe.');
console.log(`  PASS  3 deltas -> ${JSON.stringify(state.answer)}`);
assert.strictEqual(state.verdict, 'unsafe');
assert.strictEqual(state.status, 'complete');
assert.strictEqual(state.location.resolutionRoute, 'named_place');
assert.strictEqual(state.window.assumed, false);
assert.deepStrictEqual(state.agentOrder, ['weather_agent', 'risk_agent']);
assert.strictEqual(state.agents.weather_agent.latencyMs, 412);
assert.strictEqual(state.evidence.length, 1);
assert.strictEqual(state.disclosures.length, 1);
console.log('  PASS  verdict, agents, evidence and disclosures all assembled');

console.log('\n--- answer_fallback REPLACES (it never arrived as deltas) ---');
const acc2 = createTurnAccumulator();
acc2.apply({ event: 'answer_delta', data: { text: 'partial' } });
const s2 = acc2.apply({ event: 'answer_fallback', data: { text: 'Full fallback text.' } });
assert.strictEqual(s2.answer, 'Full fallback text.');
console.log('  PASS  fallback replaced rather than appended');

console.log('\n--- Capped verdict is distinguishable from a hazard verdict ---');
const acc3 = createTurnAccumulator();
const s3 = acc3.apply({ event: 'verdict', data: {
  verdict: 'caution', capped_by_missing_input: true,
  missing_inputs: ['marine conditions (wave height) unavailable: upstream timeout'], reasons: [] } });
assert.strictEqual(s3.cappedByMissingInput, true);
assert.strictEqual(s3.verdictReasons.length, 0);
console.log('  PASS  capped=true with zero reasons -> UI can say "could not see" not "rough seas"');

console.log('\n--- Unknown future event types are ignored, not fatal ---');
const acc4 = createTurnAccumulator();
const s4 = acc4.apply({ event: 'some_future_event', data: { x: 1 } });
assert.strictEqual(s4.status, 'streaming');
console.log('  PASS  unrecognised event did not break the accumulator');

console.log('\n--- error event marks the turn failed ---');
const acc5 = createTurnAccumulator();
const s5 = acc5.apply({ event: 'error', data: { message: 'boom' } });
assert.strictEqual(s5.status, 'failed');
assert.strictEqual(s5.error, 'boom');
console.log('  PASS  status=failed, message preserved');

console.log('\nSSE PARSER + ACCUMULATOR TESTS PASSED');
