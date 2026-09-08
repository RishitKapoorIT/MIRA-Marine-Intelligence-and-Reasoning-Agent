"""SSE streaming: event ordering, token deltas, and disconnect persistence."""

import asyncio
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from geoalchemy2 import WKTElement

from app.core.constants import SRID
from app.schemas.agent_io import Plan, PlannedStep
from app.tools.base import DataKind, SourceEnvelope

NOW = datetime.now(timezone.utc)
USER = SimpleNamespace(id="11111111-1111-1111-1111-111111111111",
                       preferred_language="en",
                       base_location=WKTElement("POINT(74.84 12.87)", srid=SRID),
                       base_location_label="Mangaluru")

PERSISTED = []


class FakeDB:
    async def get(self, *a, **k): return None
    def add(self, *a, **k): pass
    async def flush(self): pass
    async def commit(self): PERSISTED.append("commit")
    async def rollback(self): pass
    async def execute(self, *a, **k):
        return SimpleNamespace(scalar_one=lambda: 0,
                               scalars=lambda: SimpleNamespace(all=lambda: []))
    async def __aenter__(self): return self
    async def __aexit__(self, *a): return False


def marine():
    return SourceEnvelope(source_id="open_meteo_marine", kind=DataKind.FORECAST,
                          valid_at=NOW, values={"max_wave_height_m": 1.2,
                                                "max_current_velocity_ms": 0.2})

def weather():
    return SourceEnvelope(source_id="open_meteo_forecast", kind=DataKind.FORECAST,
                          valid_at=NOW, values={"max_wind_speed_ms": 5.0,
                                                "max_wind_gust_ms": 8.0,
                                                "min_visibility_m": 10000.0})

PLAN = Plan(interpretation="safety check",
            steps=[PlannedStep(agent_name="weather_agent", reason="conditions"),
                   PlannedStep(agent_name="risk_agent", reason="verdict")])


async def fake_json(system, user, schema, **k):
    if schema is Plan:
        return PLAN, None
    return schema(summary="Stubbed sentence."), None


async def fake_stream(system, user, **k):
    for tok in ["Conditions ", "look ", "calm ", "tomorrow."]:
        await asyncio.sleep(0.001)
        yield "delta", tok
    yield "done", "Conditions look calm tomorrow."


def parse_sse(frames):
    """(event, has_data) pairs, ignoring keepalive comments."""
    out = []
    for f in frames:
        if f.startswith(":"):
            out.append(("keepalive", False)); continue
        lines = f.strip().split("\n")
        ev = lines[0].removeprefix("event: ")
        out.append((ev, len(lines) > 1))
    return out


def stubs():
    turn = SimpleNamespace(id="tid", conversation_id="cid", evidence=[], disclosures=[])
    return [
        patch("app.agents.orchestrator.planner.call_json", fake_json),
        patch("app.agents.specialists.weather_agent.call_json", fake_json),
        patch("app.agents.specialists.risk_agent.call_json", fake_json),
        patch("app.agents.llm.call_text_stream", fake_stream),
        patch("app.tools.weather_tool.get_marine_conditions", AsyncMock(return_value=marine())),
        patch("app.tools.weather_tool.get_weather_forecast", AsyncMock(return_value=weather())),
        patch("app.tools.sachet_tool.read_active_alerts", AsyncMock(return_value=[])),
        patch("app.agents.orchestrator.streaming.AsyncSessionLocal", FakeDB),
        patch("app.agents.orchestrator.streaming._persist", AsyncMock(return_value=turn)),
    ]


async def collect(consume_all=True, stop_after=None):
    """Run one streamed turn.

    The detached task outlives the generator by design, so the mock patches
    must stay active until it finishes - otherwise it falls through to the
    real Groq client and database and the assertion fails for the wrong
    reason. wait_for_background_turns makes that deterministic instead of
    relying on a sleep.
    """
    from app.agents.orchestrator.streaming import stream_turn, wait_for_background_turns

    body = SimpleNamespace(conversation_id=None, query_text="Is it safe tomorrow?",
                           was_voice_input=False)
    frames = []
    ctxs = stubs()
    for c in ctxs: c.start()
    try:
        gen = stream_turn(body, USER)
        async for frame in gen:
            frames.append(frame)
            if stop_after and len(frames) >= stop_after:
                await gen.aclose()   # simulate client hanging up
                break
        await wait_for_background_turns(timeout=10.0)
    finally:
        for c in ctxs: c.stop()
    return frames


async def main():
    print("--- Full stream ---")
    PERSISTED.clear()
    frames = await collect()
    events = parse_sse(frames)
    names = [e for e, _ in events]
    for e, has_data in events:
        if e != "answer_delta":
            print(f"  {e}")
    print(f"  (answer_delta x{names.count('answer_delta')})")

    assert names[0] == "turn_started"
    assert names[-1] == "turn_completed"
    print("\n  PASS  opens with turn_started, closes with turn_completed")

    for required in ["context_resolved", "plan", "agent_started", "agent_completed", "verdict"]:
        assert required in names, required
    print("  PASS  all progress events present:", ", ".join(
        sorted(set(names) - {"answer_delta"})))

    # FR-B1.1: the plan must be visible before any specialist runs.
    assert names.index("plan") < names.index("agent_started")
    print("  PASS  plan emitted before first agent_started (FR-B1.1)")

    # The verdict is deterministic and must precede the risk agent explaining it.
    starts = [i for i, n in enumerate(names) if n == "agent_started"]
    assert names.index("verdict") > starts[0]
    assert names.index("verdict") < starts[-1]
    print("  PASS  verdict emitted after data agents, before risk_agent")

    assert names.count("answer_delta") == 4
    print(f"  PASS  {names.count('answer_delta')} token deltas streamed")

    assert "commit" in PERSISTED
    print("  PASS  turn persisted")

    print("\n--- Client disconnects mid-stream ---")
    PERSISTED.clear()
    frames = await collect(stop_after=3)
    got = [e for e, _ in parse_sse(frames)]
    print(f"  client received {len(frames)} frames then hung up: {got}")
    assert "turn_completed" not in got
    assert "commit" in PERSISTED, "turn must persist despite disconnect"
    print("  PASS  turn still completed and persisted after disconnect")
    print("        (NFR-A1: plan trace and invocations survive a dropped connection)")

    print("\n--- Task is strongly referenced (survives generator GC) ---")
    import gc
    from app.agents.orchestrator.streaming import _BACKGROUND_TURNS
    PERSISTED.clear()
    frames = await collect(stop_after=2)
    gc.collect()
    assert "commit" in PERSISTED
    print("  PASS  turn persisted even after forced gc.collect()")
    print(f"        registry drained to {len(_BACKGROUND_TURNS)} in-flight turns")

    print("\n--- SSE frame format ---")
    from app.agents.orchestrator.streaming import sse
    import uuid as _uuid
    frame = sse("verdict", {"verdict": "caution", "turn_id": _uuid.uuid4(), "at": NOW})
    assert frame.startswith("event: verdict\ndata: ") and frame.endswith("\n\n")
    print("  PASS  UUID and datetime serialise; frame terminated with blank line")

    print("\nSTREAMING TESTS PASSED")

asyncio.run(main())