"""Risk specialist.

Explains a verdict; it does not decide one. The VerdictResult is computed by
app/safety/verdict.py before this runs, and this agent is given it as input.
FR-E2.4 is therefore a property of a pure function under unit test, not
something the model could talk itself out of.
"""

from __future__ import annotations

from app.agents.llm import call_json
from app.agents.specialists import register
from app.schemas.agent_io import AgentOutput
from pydantic import BaseModel

SYSTEM = """You explain marine safety assessments to coastal fishermen in Karnataka, India.

You are given a verdict that has ALREADY been decided by a deterministic rule engine,
along with the reasons behind it. Your job is only to explain it clearly.

Rules:
- NEVER contradict, soften, or upgrade the given verdict. If it says CAUTION, you explain CAUTION.
- Use only the observed values and thresholds provided.
- If the verdict was limited by missing data, say so plainly: we could not see enough
  to judge. Do not imply conditions are either safe or dangerous in that case.
- Two or three short sentences. Plain language.

Respond with JSON: {"summary": "<your explanation>"}"""


class _Summary(BaseModel):
    summary: str


@register(
    "risk_agent",
    "Explains the overall safety-to-sail assessment: whether conditions are "
    "safe, need caution, or are unsafe, and which factor drove that.",
)
async def run(state) -> AgentOutput:
    verdict_result = state.get("verdict")

    if verdict_result is None:
        return AgentOutput(
            agent_name="risk_agent",
            summary="No safety assessment could be produced.",
            missing_inputs=["verdict not computed"],
        )

    reasons = [
        {
            "factor": r.factor,
            "observed": r.observed,
            "threshold": r.threshold,
            "unit": r.unit,
            "detail": r.detail,
            "source": r.source_id,
        }
        for r in verdict_result.reasons
    ]

    result, error = await call_json(
        SYSTEM,
        f"Verdict: {verdict_result.verdict.value.upper()}\n"
        f"Reasons: {reasons or 'no threshold was crossed'}\n"
        f"Missing inputs: {verdict_result.missing_inputs or 'none'}\n"
        f"Verdict limited by missing data: {verdict_result.capped_by_missing_input}",
        _Summary,
    )

    if result:
        summary = result.summary
    elif verdict_result.capped_by_missing_input:
        # Deterministic fallback, so a failed LLM call still yields a correct
        # and non-misleading statement rather than nothing.
        summary = (
            "We could not retrieve enough data to assess conditions fully, so "
            "this is marked CAUTION. That is not a finding that conditions are "
            "dangerous, nor a confirmation that they are safe."
        )
    else:
        drivers = "; ".join(r.detail for r in verdict_result.reasons) or "no threshold crossed"
        summary = f"Assessment: {verdict_result.verdict.value.upper()}. {drivers}."

    return AgentOutput(
        agent_name="risk_agent",
        summary=summary,
        findings={
            "verdict": verdict_result.verdict.value,
            "reasons": reasons,
            "capped_by_missing_input": verdict_result.capped_by_missing_input,
        },
        missing_inputs=verdict_result.missing_inputs,
    )