"""End-to-end graph run with LLM and DB stubbed.

Proves node sequencing, the deterministic-verdict boundary, and FR-B4.3
partial answers without needing Groq credentials or a live database.
"""

import asyncio
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from geoalchemy2 import WKTElement
from pydantic import BaseModel

from app.core.constants import SRID, Verdict
from app.schemas.agent_io import Plan, PlannedStep
from app.tools.base import DataKind, SourceEnvelope

NOW = datetime.now(timezone.utc)

USER = SimpleNamespace(
    id="11111111-1111-1111-1111-111111111111",
    preferred_language="en",
    base_location=WKTElement("POINT(74.84 12.87)", srid=SRID),
    base_location_label="Mangaluru",
)


class FakeDB:
    """Minimal async stand-in. get() returns None so the SACHET SourceStatus
    row is absent -> feed treated as unavailable, which is the safe reading."""
    async def get(self, *a, **k): return None
    def add(self, *a, **k): pass
    async def flush(self): pass
    async def execute(self, *a, **k):
        return SimpleNamespace(scalar_one=lambda: 0, scalars=lambda: SimpleNamespace(all=lambda: []))


def marine(wave):
    return SourceEnvelope(source_id="open_meteo_marine", kind=DataKind.FORECAST,
                          valid_at=NOW, values={"max_wave_height_m": wave,
                                                "max_current_velocity_ms": 0.2})

def weather(wind):
    return SourceEnvelope(source_id="open_meteo_forecast", kind=DataKind.FORECAST,
                          valid_at=NOW, values={"max_wind_speed_ms": wind,
                                                "max_wind_gust_ms": wind + 3,
                                                "min_visibility_m": 10000.0})


async def run_case(label, wave, wind, marine_ok=True, expect=None):
    from app.agents.orchestrator import graph as g

    plan = Plan(interpretation="safety check",
                steps=[PlannedStep(agent_name="weather_agent", reason="conditions"),
                       PlannedStep(agent_name="risk_agent", reason="verdict")])

    m = marine(wave) if marine_ok else SourceEnvelope.unavailable(
        "open_meteo_marine", DataKind.FORECAST, "upstream timeout")

    async def fake_json(system, user, schema, **k):
        if schema is Plan:
            return plan, None
        return schema(summary="Stubbed specialist sentence."), None

    async def fake_text(system, user, **k):
        return "Stubbed synthesized answer.", None

    with patch("app.agents.orchestrator.planner.call_json", fake_json), \
         patch("app.agents.specialists.weather_agent.call_json", fake_json), \
         patch("app.agents.specialists.risk_agent.call_json", fake_json), \
         patch("app.agents.llm.call_text", fake_text), \
         patch("app.tools.weather_tool.get_marine_conditions", AsyncMock(return_value=m)), \
         patch("app.tools.weather_tool.get_weather_forecast", AsyncMock(return_value=weather(wind))), \
         patch("app.tools.sachet_tool.read_active_alerts", AsyncMock(return_value=[])):

        state = {
            "user_id": USER.id, "conversation_id": None,
            "query_text": "Is it safe to go out tomorrow?",
            "was_voice_input": False, "detected_language": "en",
            "agent_outputs": {}, "invocations": [], "missing_inputs": [],
            "status": "complete", "_user": USER, "_db": FakeDB(),
        }
        final = await g.build_graph().ainvoke(state)

    v = final["verdict"]
    print(f"  {label}")
    print(f"    verdict={v.verdict.value.upper()}  capped={v.capped_by_missing_input}  status={final['status']}")
    print(f"    location={final['location'].route.value}  window_assumed={final['window'].assumed}")
    print(f"    agents_run={sorted(final['agent_outputs'])}  invocations={len(final['invocations'])}")
    if final["missing_inputs"]:
        print(f"    missing={final['missing_inputs']}")
    assert v.verdict == expect, f"{label}: got {v.verdict}, want {expect}"
    return final


async def main():
    print("--- Graph end-to-end ---")
    f = await run_case("calm conditions", 1.0, 5.0, expect=Verdict.CAUTION)
    # Feed unavailable (FakeDB has no SourceStatus row) => capped, never SAFE
    assert f["verdict"].capped_by_missing_input is True
    assert any("hazard alert feed" in m for m in f["verdict"].missing_inputs)
    print("    -> absent SACHET status row correctly read as feed-unavailable, not all-clear")

    await run_case("rough sea (wave 3.5m)", 3.5, 5.0, expect=Verdict.UNSAFE)
    await run_case("high wind (18 m/s)", 1.0, 18.0, expect=Verdict.UNSAFE)

    f = await run_case("marine source down", 1.0, 5.0, marine_ok=False, expect=Verdict.CAUTION)
    assert f["status"] == "partial", f["status"]
    assert any("marine" in m for m in f["missing_inputs"])
    print("    -> FR-B4.3 partial status set, missing input named")

    print("\n--- Node ordering: verdict exists before risk_agent runs ---")
    from app.agents.orchestrator import graph as g
    nodes = list(g.build_graph().get_graph().nodes)
    assert nodes.index("compute_verdict") < nodes.index("explain_risk")
    print("  PASS  compute_verdict precedes explain_risk")

    print("\n--- Clarification path (FR-D1.4): no location, nothing assumed ---")
    no_loc = SimpleNamespace(id=USER.id, preferred_language="en",
                             base_location=None, base_location_label=None)
    state = {"user_id": USER.id, "conversation_id": None, "query_text": "is it safe?",
             "was_voice_input": False, "detected_language": "en", "agent_outputs": {},
             "invocations": [], "missing_inputs": [], "status": "complete",
             "_user": no_loc, "_db": FakeDB()}
    final = await g.build_graph().ainvoke(state)
    assert final["status"] == "clarification_requested", final["status"]
    assert final["location"] is None
    assert final.get("verdict") is None
    print(f"  PASS  status={final['status']}, no verdict fabricated")
    print(f"        asked: {final['answer_text'][:70]}...")

    print("\nGRAPH TESTS PASSED")

asyncio.run(main())