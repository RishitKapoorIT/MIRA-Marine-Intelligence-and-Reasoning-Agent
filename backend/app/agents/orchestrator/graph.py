"""LangGraph orchestrator.

Graph shape:

    resolve_context -> plan -> execute_specialists -> compute_verdict
                                     -> explain_risk -> synthesize -> persist

Specialists run concurrently inside one `execute_specialists` node via
asyncio.gather rather than as dynamically fanned-out LangGraph nodes. The
Send API would give the same concurrency with a much harder-to-follow control
flow, and every specialist still goes through the orchestrator — FR-B3.1 and
FR-B3.2 hold either way. Worth revisiting if per-node checkpointing is ever
needed.

risk_agent is sequenced AFTER compute_verdict because it explains a verdict
it is handed. The safety decision itself (app/safety/verdict.py) is a pure
function that never sees the model.

Returns a single JSON payload. SSE streaming (FR-B6.1) is Step 5.
"""

from __future__ import annotations

import asyncio
import logging
import time
import uuid
from datetime import datetime, timezone

from geoalchemy2 import WKTElement
from langgraph.graph import END, START, StateGraph
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.orchestrator.planner import build_plan
from app.agents.orchestrator.state import OrcaState
from app.agents.specialists import SPECIALISTS
from app.core.constants import SRID, InvocationStatus, SourceId, TurnStatus
from app.core.thresholds import thresholds
from app.db.models import AgentInvocation, Conversation, SourceStatus, Turn
from app.safety import verdict as verdict_module
from app.safety.disclosures import for_answer
from app.schemas.evidence import EvidenceItem
from app.tools import geo_tool, sachet_tool
from app.tools.base import SourceEnvelope

logger = logging.getLogger(__name__)

SYNTHESIS_SYSTEM = """You write the final answer for a marine assistant used by coastal
fishermen in Karnataka, India.

You are given findings from one or more specialist agents. Combine them into a single
clear answer.

Rules:
- Use ONLY the values and statements provided. Never add a number, place, or condition
  that is not in the findings.
- If a safety verdict is present, lead with it and do not contradict it.
- If specialists disagree, say so explicitly rather than picking one silently.
- If data was missing, say what was missing. Never fill a gap with a reassuring guess.
- Short paragraphs, plain language, no jargon, no markdown headers.
- Do not repeat the safety disclaimers; they are appended separately."""


# --- Nodes -------------------------------------------------------------------

async def resolve_context(state: OrcaState) -> dict:
    """FR-D1 / FR-D3. FR-D1.4: no location means ask, never assume."""
    user = state["_user"]

    location = geo_tool.resolve_location(
        user,
        explicit_coords=state.get("_explicit_coords"),
        named_place=state.get("_named_place"),
        shared_position=state.get("_shared_position"),
        live_gps=state.get("_live_gps"),
    )

    from app.agents.orchestrator.streaming import emit

    if location is None:
        return {
            "location": None,
            "window": None,
            "clarification_needed": (
                "I do not know where you are asking about. Please set your home "
                "port in your profile, or tell me the place name."
            ),
            "status": TurnStatus.CLARIFICATION_REQUESTED.value,
        }

    window = geo_tool.resolve_window(relative=state.get("_relative_time"))
    await emit(
        state,
        "context_resolved",
        {
            "latitude": location.latitude,
            "longitude": location.longitude,
            "resolution_route": location.route.value,
            "label": location.label,
            "window": window.description,
            "window_assumed": window.assumed,
        },
    )
    return {"location": location, "window": window}


async def plan_node(state: OrcaState) -> dict:
    if state.get("clarification_needed"):
        return {}
    from app.agents.orchestrator.streaming import emit

    location = state.get("location")
    plan = await build_plan(state["query_text"], location.label if location else None)
    # FR-B1.1 - the plan is visible before any specialist runs.
    await emit(
        state,
        "plan",
        {
            "interpretation": plan.interpretation,
            "steps": [{"agent": s.agent_name, "reason": s.reason} for s in plan.steps],
            "needs_clarification": plan.needs_clarification,
        },
    )
    return {"plan": plan}


async def execute_specialists(state: OrcaState) -> dict:
    """Runs the planned specialists concurrently, except risk_agent which is
    deferred until after the verdict exists."""
    if state.get("clarification_needed"):
        return {}

    plan = state.get("plan")
    if plan is None or plan.needs_clarification:
        return {
            "clarification_needed": (
                plan.clarification_question if plan else "Could you rephrase that?"
            ),
            "status": TurnStatus.CLARIFICATION_REQUESTED.value,
        }

    names = [s.agent_name for s in plan.steps if s.agent_name != "risk_agent"]
    if not names:
        return {"agent_outputs": {}, "invocations": []}

    outputs, invocations = await _run_agents(names, state, start_index=0)
    return {"agent_outputs": outputs, "invocations": invocations}


async def compute_verdict(state: OrcaState) -> dict:
    """FR-E2. Deterministic — this node calls no LLM."""
    if state.get("clarification_needed"):
        return {}

    weather_out = state.get("agent_outputs", {}).get("weather_agent")

    marine_env = weather_env = None
    if weather_out:
        raw_marine = weather_out.findings.get("_marine_envelope")
        raw_weather = weather_out.findings.get("_weather_envelope")
        if raw_marine:
            marine_env = SourceEnvelope.model_validate(raw_marine)
        if raw_weather:
            weather_env = SourceEnvelope.model_validate(raw_weather)

    db: AsyncSession = state["_db"]
    location = state.get("location")

    alerts = []
    feed_available = True
    if location is not None:
        status_row = await db.get(SourceStatus, SourceId.SACHET_CAP.value)
        # No row means the poller has never run. That is not an all-clear.
        feed_available = status_row is not None and status_row.is_available
        try:
            alerts = await sachet_tool.read_active_alerts(
                db,
                location.latitude,
                location.longitude,
                thresholds.alerts.default_radius_km,
            )
        except Exception as exc:
            logger.warning("Alert lookup failed: %s", exc)
            feed_available = False

    result = verdict_module.evaluate(
        marine_env, weather_env, alerts, alerts_feed_available=feed_available
    )
    from app.agents.orchestrator.streaming import emit

    await emit(
        state,
        "verdict",
        {
            "verdict": result.verdict.value,
            "capped_by_missing_input": result.capped_by_missing_input,
            "missing_inputs": result.missing_inputs,
            "reasons": [
                {"factor": r.factor, "detail": r.detail, "source": r.source_id}
                for r in result.reasons
            ],
        },
    )
    return {"verdict": result, "_alerts": alerts, "_feed_available": feed_available}


async def explain_risk(state: OrcaState) -> dict:
    if state.get("clarification_needed"):
        return {}
    plan = state.get("plan")
    if plan is None or not any(s.agent_name == "risk_agent" for s in plan.steps):
        return {}

    start_index = len(state.get("invocations", []))
    outputs, invocations = await _run_agents(["risk_agent"], state, start_index)
    return {
        "agent_outputs": outputs,
        "invocations": state.get("invocations", []) + invocations,
    }


async def synthesize(state: OrcaState) -> dict:
    """FR-B4. Composes prose from structured findings only."""
    if state.get("clarification_needed"):
        return {
            "answer_text": state["clarification_needed"],
            "status": TurnStatus.CLARIFICATION_REQUESTED.value,
        }

    from app.agents.llm import call_text, call_text_stream
    from app.agents.orchestrator.streaming import emit

    outputs = state.get("agent_outputs", {})
    missing = sorted({m for o in outputs.values() for m in o.missing_inputs})

    findings_text = "\n\n".join(
        f"[{name}] {out.summary}\nFindings: "
        f"{ {k: v for k, v in out.findings.items() if not k.startswith('_')} }"
        for name, out in outputs.items()
    )

    verdict_result = state.get("verdict")
    verdict_text = (
        f"Safety verdict (already decided, do not change): "
        f"{verdict_result.verdict.value.upper()}"
        if verdict_result
        else "No safety verdict."
    )

    prompt = (
        f"User question: {state['query_text']}\n\n{verdict_text}\n\n"
        f"Specialist findings:\n{findings_text}\n\n"
        f"Missing data: {missing or 'none'}"
    )

    answer: str | None
    if state.get("_events") is not None:
        # Streamed turn: relay tokens as they arrive (NFR-P2).
        answer = None
        async for kind, payload in call_text_stream(
            SYNTHESIS_SYSTEM, prompt, max_tokens=700
        ):
            if kind == "delta":
                await emit(state, "answer_delta", {"text": payload})
            elif kind == "done":
                answer = payload
            else:
                answer = None
    else:
        answer, _error = await call_text(SYNTHESIS_SYSTEM, prompt, max_tokens=700)

    if not answer:
        # FR-B4.3 — concatenated specialist summaries are a worse answer than
        # synthesised prose, but they are a truthful one.
        answer = " ".join(o.summary for o in outputs.values()) or (
            "I could not produce an answer for that."
        )
        # The fallback text never reached the client as deltas, so send it.
        await emit(state, "answer_fallback", {"text": answer})

    status = TurnStatus.PARTIAL.value if missing else TurnStatus.COMPLETE.value
    return {"answer_text": answer, "status": status, "missing_inputs": missing}


# --- Helpers -----------------------------------------------------------------

async def _run_agents(names: list[str], state: OrcaState, start_index: int):
    """Runs specialists concurrently, recording NFR-A4 per-agent latency.

    A specialist raising is recorded as FAILED and the turn continues — one
    broken agent degrades the answer rather than losing it.
    """

    from app.agents.orchestrator.streaming import emit

    async def _invoke(name: str):
        specialist = SPECIALISTS[name]
        started = time.perf_counter()
        await emit(state, "agent_started", {"agent": name})
        try:
            output = await specialist.run(state)
            await emit(
                state,
                "agent_completed",
                {
                    "agent": name,
                    "status": InvocationStatus.OK.value,
                    "summary": output.summary,
                    "latency_ms": int((time.perf_counter() - started) * 1000),
                    "missing_inputs": output.missing_inputs,
                },
            )
            return name, output, InvocationStatus.OK, None, int(
                (time.perf_counter() - started) * 1000
            )
        except Exception as exc:
            logger.exception("Specialist %s failed", name)
            await emit(
                state,
                "agent_completed",
                {
                    "agent": name,
                    "status": InvocationStatus.FAILED.value,
                    "error": str(exc),
                    "latency_ms": int((time.perf_counter() - started) * 1000),
                },
            )
            return name, None, InvocationStatus.FAILED, str(exc), int(
                (time.perf_counter() - started) * 1000
            )

    results = await asyncio.gather(*(_invoke(n) for n in names))

    outputs = {}
    invocations = []
    for offset, (name, output, status, error, latency) in enumerate(results):
        if output is not None:
            outputs[name] = output
        invocations.append(
            {
                "agent_name": name,
                "sequence_index": start_index + offset,
                "status": status.value,
                "latency_ms": latency,
                "error_detail": error,
                "output_payload": output.model_dump(mode="json") if output else None,
            }
        )
    return outputs, invocations


async def _persist(state: OrcaState, db: AsyncSession, total_latency_ms: int) -> Turn:
    """NFR-A1 — plan, invocations and evidence persisted with the turn."""
    conversation_id = state.get("conversation_id")
    if conversation_id is None:
        conversation = Conversation(user_id=state["user_id"])
        db.add(conversation)
        await db.flush()
        conversation_id = conversation.id

    next_index = (
        await db.execute(
            select(func.coalesce(func.max(Turn.sequence_index), -1) + 1).where(
                Turn.conversation_id == conversation_id
            )
        )
    ).scalar_one()

    location = state.get("location")
    window = state.get("window")
    verdict_result = state.get("verdict")
    outputs = state.get("agent_outputs", {})

    evidence: list[dict] = []
    for out in outputs.values():
        evidence.extend(e.model_dump(mode="json") for e in out.evidence)

    disclosures = for_answer(
        verdict=verdict_result.verdict if verdict_result else None,
        capped_by_missing_input=(
            verdict_result.capped_by_missing_input if verdict_result else False
        ),
        missing_inputs=state.get("missing_inputs", []),
        alerts_feed_available=state.get("_feed_available", True),
        includes_pfz="ocean_agent" in outputs,
        includes_forecast="weather_agent" in outputs,
        any_stale=any(e.get("is_stale") for e in evidence),
    )

    plan = state.get("plan")
    turn = Turn(
        conversation_id=conversation_id,
        sequence_index=next_index,
        query_text=state["query_text"],
        detected_language=state.get("detected_language", "en"),
        was_voice_input=state.get("was_voice_input", False),
        resolved_point=(
            WKTElement(f"POINT({location.longitude} {location.latitude})", srid=SRID)
            if location
            else None
        ),
        resolution_route=location.route if location else None,
        resolved_place_label=location.label if location else None,
        window_start=window.start if window else None,
        window_end=window.end if window else None,
        window_assumed=window.assumed if window else False,
        answer_text=state.get("answer_text"),
        status=state.get("status", TurnStatus.COMPLETE.value),
        missing_inputs=state.get("missing_inputs") or None,
        plan=plan.model_dump(mode="json") if plan else None,
        evidence=evidence or None,
        disclosures=[d.__dict__ for d in disclosures],
        total_latency_ms=total_latency_ms,
    )
    db.add(turn)
    await db.flush()

    for record in state.get("invocations", []):
        db.add(
            AgentInvocation(
                turn_id=turn.id,
                agent_name=record["agent_name"],
                sequence_index=record["sequence_index"],
                status=InvocationStatus(record["status"]),
                latency_ms=record["latency_ms"],
                error_detail=record["error_detail"],
                output_payload=record["output_payload"],
                finished_at=datetime.now(timezone.utc),
            )
        )

    return turn


# --- Graph -------------------------------------------------------------------

def build_graph():
    graph = StateGraph(OrcaState)
    graph.add_node("resolve_context", resolve_context)
    graph.add_node("plan", plan_node)
    graph.add_node("execute_specialists", execute_specialists)
    graph.add_node("compute_verdict", compute_verdict)
    graph.add_node("explain_risk", explain_risk)
    graph.add_node("synthesize", synthesize)

    graph.add_edge(START, "resolve_context")
    graph.add_edge("resolve_context", "plan")
    graph.add_edge("plan", "execute_specialists")
    graph.add_edge("execute_specialists", "compute_verdict")
    graph.add_edge("compute_verdict", "explain_risk")
    graph.add_edge("explain_risk", "synthesize")
    graph.add_edge("synthesize", END)
    return graph.compile()


_compiled = None


def get_graph():
    global _compiled
    if _compiled is None:
        _compiled = build_graph()
    return _compiled


async def run_turn(body, current_user, db: AsyncSession) -> dict:
    """Entry point called by api/v1/chat.py."""
    started = time.perf_counter()

    initial: OrcaState = {
        "user_id": current_user.id,
        "conversation_id": body.conversation_id,
        "query_text": body.query_text,
        "was_voice_input": getattr(body, "was_voice_input", False),
        "detected_language": current_user.preferred_language,
        "agent_outputs": {},
        "invocations": [],
        "missing_inputs": [],
        "status": TurnStatus.COMPLETE.value,
        "_user": current_user,
        "_db": db,
    }

    final = await get_graph().ainvoke(initial)
    total_latency_ms = int((time.perf_counter() - started) * 1000)

    turn = await _persist(final, db, total_latency_ms)

    verdict_result = final.get("verdict")
    return {
        "conversation_id": turn.conversation_id,
        "turn_id": turn.id,
        "answer": final.get("answer_text"),
        "status": final.get("status"),
        "verdict": verdict_result.verdict.value if verdict_result else None,
        "verdict_reasons": (
            [r.__dict__ | {"verdict": r.verdict.value} for r in verdict_result.reasons]
            if verdict_result
            else []
        ),
        "capped_by_missing_input": (
            verdict_result.capped_by_missing_input if verdict_result else False
        ),
        "missing_inputs": final.get("missing_inputs", []),
        "location": (
            {
                "latitude": final["location"].latitude,
                "longitude": final["location"].longitude,
                "resolution_route": final["location"].route.value,
                "label": final["location"].label,
            }
            if final.get("location")
            else None
        ),
        "window": (
            {
                "start": final["window"].start,
                "end": final["window"].end,
                "assumed": final["window"].assumed,
                "description": final["window"].description,
            }
            if final.get("window")
            else None
        ),
        "plan": final["plan"].model_dump(mode="json") if final.get("plan") else None,
        "evidence": turn.evidence or [],
        "disclosures": turn.disclosures or [],
        "latency_ms": total_latency_ms,
    }