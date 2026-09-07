"""FR-B1 task planner.

Produces an explicit plan before any specialist runs, and the plan is
persisted with the turn (FR-B1.2) so it can be inspected later (FR-B5.1).

Routing is driven by the registry's capability descriptions, not by matching
query strings — FR-B2.1. If the planner LLM fails, a deterministic fallback
runs every registered specialist rather than losing the turn: over-fetching
costs latency, whereas guessing at a narrower set could silently drop the
hazard check.
"""

from __future__ import annotations

from app.agents.llm import call_json
from app.agents.specialists import SPECIALISTS, capability_catalogue
from app.schemas.agent_io import Plan, PlannedStep

SYSTEM = """You are the planner for a marine information assistant used by coastal
fishermen in Karnataka, India.

Given the user's question, decide which specialist agents should run. You are given
the available agents and what each one covers. Choose only those needed to answer
the question.

Safety rule: if the question involves going to sea, fishing, travel, or conditions
in any way, ALWAYS include risk_agent and weather_agent. When in doubt, include them.

If the question is too vague to act on at all (no discernible topic), set
needs_clarification true and give one short clarifying question.

Respond with JSON in exactly this shape:
{
  "interpretation": "<one sentence restating what the user wants>",
  "steps": [{"agent_name": "<name>", "reason": "<why>"}],
  "needs_clarification": false,
  "clarification_question": null
}"""


def fallback_plan(reason: str) -> Plan:
    """Every registered specialist, in registration order."""
    return Plan(
        interpretation=f"Planner unavailable ({reason}); running all specialists.",
        steps=[
            PlannedStep(agent_name=name, reason="fallback: planner unavailable")
            for name in SPECIALISTS
        ],
    )


async def build_plan(query_text: str, location_label: str | None) -> Plan:
    plan, error = await call_json(
        SYSTEM,
        f"Available agents:\n{capability_catalogue()}\n\n"
        f"User location context: {location_label or 'not specified'}\n"
        f"User question: {query_text}",
        Plan,
    )

    if plan is None:
        return fallback_plan(error or "unknown error")

    # The model can name an agent that does not exist. Drop unknown steps
    # rather than failing the turn, and fall back if nothing valid remains.
    valid_steps = [s for s in plan.steps if s.agent_name in SPECIALISTS]

    if not valid_steps and not plan.needs_clarification:
        return fallback_plan("planner returned no valid agents")

    plan.steps = valid_steps
    return plan