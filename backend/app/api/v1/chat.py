"""FR-A1.1 conversational entry point.

Two response shapes from one endpoint:

  POST /chat                 -> single JSON payload (default)
  POST /chat?stream=true     -> SSE progress stream (FR-B6.1, NFR-P2)

Both run the same LangGraph. The graph emits progress events only when a
queue is present in state, so there is one code path rather than two
implementations that can drift.
"""

import uuid

from fastapi import APIRouter, Depends, Header, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user
from app.db.models import User
from app.db.session import get_session

router = APIRouter()


class ChatRequest(BaseModel):
    conversation_id: uuid.UUID | None = None
    query_text: str
    was_voice_input: bool = False


@router.post("")
async def post_chat(
    body: ChatRequest,
    stream: bool = Query(False, description="Stream progress events as SSE"),
    accept: str = Header(default=""),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    # Either trigger works. The Accept header is the standards-conformant one
    # and is what EventSource sends automatically; ?stream=true is the
    # explicit override for curl and for clients that cannot set headers.
    wants_stream = stream or "text/event-stream" in accept.lower()

    if wants_stream:
        from app.agents.orchestrator.streaming import stream_turn

        # No db argument: the streaming runner opens its own session so the
        # turn still persists if the client disconnects mid-answer.
        return StreamingResponse(
            stream_turn(body, current_user),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                # Stops nginx buffering the stream into one lump.
                "X-Accel-Buffering": "no",
            },
        )

    from app.agents.orchestrator.graph import run_turn

    return await run_turn(body, current_user, db)