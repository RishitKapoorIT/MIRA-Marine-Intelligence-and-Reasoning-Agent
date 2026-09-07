"""Weather and sea-state specialist.

Calls the deterministic tools, then asks the LLM only to phrase what came
back. The numbers in `findings` are the tool's, never the model's — if the
LLM call fails, the findings and evidence still stand and only the prose
sentence is lost.
"""

from __future__ import annotations

import asyncio
from datetime import timedelta

from app.agents.llm import call_json
from app.agents.specialists import register
from app.core.thresholds import thresholds
from app.schemas.agent_io import AgentOutput
from app.schemas.evidence import EvidenceItem
from app.tools import weather_tool
from pydantic import BaseModel

SYSTEM = """You are a marine weather reporter for coastal fishermen in Karnataka, India.
You will be given retrieved forecast values. Write one or two short, plain sentences
describing the conditions.

Rules:
- Use ONLY the numbers given to you. Never estimate, round away, or invent a value.
- Do not give a safety verdict or advise whether to sail. That is decided elsewhere.
- Plain language. No jargon.

Respond with JSON: {"summary": "<your sentences>"}"""


class _Summary(BaseModel):
    summary: str


@register(
    "weather_agent",
    "Wind speed and gusts, precipitation, visibility, wave and swell height, "
    "sea surface temperature and currents for a location and time window.",
)
async def run(state) -> AgentOutput:
    location = state.get("location")
    window = state.get("window")

    if location is None or window is None:
        return AgentOutput(
            agent_name="weather_agent",
            summary="Location or time window was not resolved.",
            missing_inputs=["location or time window unresolved"],
        )

    marine, weather = await asyncio.gather(
        weather_tool.get_marine_conditions(
            location.latitude, location.longitude, window.start, window.end
        ),
        weather_tool.get_weather_forecast(
            location.latitude, location.longitude, window.start, window.end
        ),
    )

    max_age = timedelta(hours=thresholds.safety.max_forecast_age_hours)
    evidence = [
        EvidenceItem.from_envelope(marine, stale=marine.is_stale(max_age)),
        EvidenceItem.from_envelope(weather, stale=weather.is_stale(max_age)),
    ]

    _SOURCE_LABEL = {
        marine.source_id: "marine conditions (wave height)",
        weather.source_id: "wind forecast",
    }
    missing = [
        f"{_SOURCE_LABEL.get(env.source_id, env.source_id)} unavailable: "
        f"{env.unavailable_reason or 'no data returned'}"
        for env in (marine, weather)
        if not env.available
    ]

    findings = {
        "marine": marine.values if marine.available else None,
        "weather": weather.values if weather.available else None,
        # Carried forward so the risk node can compute the verdict without
        # re-fetching. FR-E2 stays deterministic and this stays the only fetch.
        "_marine_envelope": marine.model_dump(mode="json"),
        "_weather_envelope": weather.model_dump(mode="json"),
    }

    if not marine.available and not weather.available:
        return AgentOutput(
            agent_name="weather_agent",
            summary="No weather or sea-state data could be retrieved for this location and time.",
            findings=findings,
            evidence=evidence,
            missing_inputs=missing,
        )

    result, error = await call_json(
        SYSTEM,
        f"Location: {location.latitude:.3f}, {location.longitude:.3f}\n"
        f"Window: {window.description}\n"
        f"Marine: {marine.values if marine.available else 'UNAVAILABLE'}\n"
        f"Weather: {weather.values if weather.available else 'UNAVAILABLE'}",
        _Summary,
    )

    # Losing the prose does not lose the data.
    summary = result.summary if result else "Retrieved forecast values are listed below."

    return AgentOutput(
        agent_name="weather_agent",
        summary=summary,
        findings=findings,
        evidence=evidence,
        missing_inputs=missing,
    )