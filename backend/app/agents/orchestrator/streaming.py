"""SSE streaming for /chat (FR-B6.1, NFR-P2).

Option 2 as agreed: progress events are emitted as they happen, and the turn
is persisted in a `finally` block regardless of how the stream ends.

THE DISCONNECT PROBLEM AND HOW IT IS HANDLED

When a client disconnects, Starlette cancels the request task. If the graph
were running on the request-scoped database session, that session would close
underneath it and the turn would be lost - exactly the outcome NFR-A1 forbids,
since the plan trace and agent invocations are supposed to be persisted.

So the graph runs as a detached task with its OWN session, created here rather
than injected. The SSE generator only relays events; it never owns the work.
A client that hangs up mid-answer still gets a complete, persisted turn -
which also means a reconnecting mobile client on a bad connection can find its
answer rather than having to ask again.

`current_user` is passed across that session boundary and is READ ONLY inside
the graph. Safe because the session factory sets expire_on_commit=False, so
its already-loaded attributes stay readable.
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
from typing import Any, AsyncGenerator

from app.agents.orchestrator.graph import _persist, get_graph
from app.core.constants import TurnStatus
from app.db.session import AsyncSessionLocal

logger = logging.getLogger(__name__)

# Emitted as an SSE comment so proxies do not close an idle connection while
# a slow specialist is still working.
HEARTBEAT_SECONDS = 15.0
_SENTINEL = object()

# asyncio holds only a WEAK reference to a running task. Once the SSE
# generator closes, its frame is destroyed and the only strong reference to
# the detached turn goes with it - so the task can be garbage collected
# mid-execution and the turn is silently lost. This is exactly the disconnect
# case we set out to protect, and it fails without a warning.
# See the asyncio.create_task docs: "Save a reference to the result of this
# function, to avoid a task disappearing mid-execution."
_BACKGROUND_TURNS: set[asyncio.Task] = set()


def _track(task: asyncio.Task) -> None:
    _BACKGROUND_TURNS.add(task)
    task.add_done_callback(_BACKGROUND_TURNS.discard)


async def wait_for_background_turns(timeout: float = 30.0) -> None:
    """Await in-flight turns. Used by the app lifespan on shutdown, and by
    tests that need to observe persistence deterministically."""
    if not _BACKGROUND_TURNS:
        return
    await asyncio.wait(set(_BACKGROUND_TURNS), timeout=timeout)


def sse(event: str, data: dict[str, Any]) -> str:
    """One SSE frame. `default=str` so UUIDs and datetimes serialise."""
    return f"event: {event}\ndata: {json.dumps(data, default=str)}\n\n"


async def emit(state: dict, event: str, data: dict[str, Any]) -> None:
    """Push a progress event if this turn is being streamed.

    A no-op when `_events` is absent, which is what lets the same graph serve
    both the streaming and the plain JSON endpoint without branching.
    """
    queue = state.get("_events")
    if queue is not None:
        await queue.put((event, data))


async def _run_and_persist(
    initial_state: dict, queue: asyncio.Queue, started: float
) -> None:
    """Run the graph on an independent session, then persist. Always ends by
    putting the sentinel so the generator cannot hang."""
    try:
        async with AsyncSessionLocal() as db:
            initial_state["_db"] = db
            try:
                final = await get_graph().ainvoke(initial_state)
                total_latency_ms = int((time.perf_counter() - started) * 1000)

                turn = await _persist(final, db, total_latency_ms)
                await db.commit()

                verdict_result = final.get("verdict")
                await queue.put(
                    (
                        "turn_completed",
                        {
                            "turn_id": str(turn.id),
                            "conversation_id": str(turn.conversation_id),
                            "status": final.get("status"),
                            "verdict": (
                                verdict_result.verdict.value if verdict_result else None
                            ),
                            "missing_inputs": final.get("missing_inputs", []),
                            "evidence": turn.evidence or [],
                            "disclosures": turn.disclosures or [],
                            "latency_ms": total_latency_ms,
                        },
                    )
                )
            except Exception as exc:
                logger.exception("Streamed turn failed")
                await db.rollback()
                await queue.put(("error", {"message": str(exc)}))
    except Exception as exc:  # session creation itself failed
        logger.exception("Could not open session for streamed turn")
        await queue.put(("error", {"message": str(exc)}))
    finally:
        await queue.put(_SENTINEL)


async def stream_turn(body, current_user) -> AsyncGenerator[str, None]:
    """SSE generator for POST /chat?stream=true."""
    queue: asyncio.Queue = asyncio.Queue()
    started = time.perf_counter()

    initial_state = {
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
        "_events": queue,
    }

    task = asyncio.create_task(_run_and_persist(initial_state, queue, started))
    _track(task)

    yield sse("turn_started", {"query": body.query_text})

    try:
        while True:
            try:
                item = await asyncio.wait_for(queue.get(), timeout=HEARTBEAT_SECONDS)
            except asyncio.TimeoutError:
                yield ": keepalive\n\n"
                continue

            if item is _SENTINEL:
                break

            event, data = item
            yield sse(event, data)
    finally:
        # The client may have hung up. The task owns its own session, so it
        # finishes and persists on its own; nothing here cancels it.
        if not task.done():
            logger.info("Client disconnected; turn continues and will persist")