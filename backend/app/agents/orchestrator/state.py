"""LangGraph state.

One mutable object threaded through the graph. Specialists read from it and
write only their own AgentOutput into `agent_outputs` — they never read each
other's entries, which is how FR-B3.2 (no peer-to-peer messaging) holds even
though they share a state object.
"""

from __future__ import annotations

import uuid
from typing import Annotated, Any, TypedDict

from app.safety.verdict import VerdictResult
from app.schemas.agent_io import AgentOutput, Plan
from app.tools.geo_tool import ResolvedLocation, ResolvedWindow


def merge_outputs(
    left: dict[str, AgentOutput], right: dict[str, AgentOutput]
) -> dict[str, AgentOutput]:
    """Reducer so concurrent specialist writes merge instead of overwriting."""
    return {**left, **right}


class InvocationRecord(TypedDict):
    agent_name: str
    sequence_index: int
    status: str
    latency_ms: int | None
    error_detail: str | None
    output_payload: dict[str, Any] | None


class OrcaState(TypedDict, total=False):
    # --- Runtime context ---
    # LangGraph filters state down to the keys declared here, so the request
    # handles and raw inputs must be declared even though they are internal
    # and never serialised into a response. Underscore prefix marks them as
    # not part of the agent-visible contract.
    _user: Any
    _db: Any
    _explicit_coords: tuple[float, float] | None
    _named_place: str | None
    _shared_position: tuple[float, float] | None
    _live_gps: tuple[float, float] | None
    _relative_time: str | None
    _alerts: list[Any]
    _feed_available: bool
    # asyncio.Queue when the turn is streamed; absent otherwise. Progress
    # emission is a no-op without it, so one graph serves both endpoints.
    _events: Any

    # --- Input ---
    user_id: uuid.UUID
    conversation_id: uuid.UUID | None
    query_text: str
    was_voice_input: bool
    detected_language: str

    # --- Resolved context (FR-D) ---
    location: ResolvedLocation | None
    window: ResolvedWindow | None
    clarification_needed: str | None

    # --- Planning (FR-B1) ---
    plan: Plan | None

    # --- Execution ---
    agent_outputs: Annotated[dict[str, AgentOutput], merge_outputs]
    invocations: list[InvocationRecord]

    # --- Safety (FR-E2) — computed deterministically, never by an agent ---
    verdict: VerdictResult | None

    # --- Output ---
    answer_text: str | None
    status: str
    missing_inputs: list[str]