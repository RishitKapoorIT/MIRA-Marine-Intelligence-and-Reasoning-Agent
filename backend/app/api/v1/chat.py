"""FR-A1.1 conversational entry point.

The endpoint contract is fixed here; the orchestrator it delegates to
(app.agents.orchestrator.graph.run_turn) is Step 4. Importing it lazily
keeps this module — and therefore the whole app — importable and every
other router testable before Step 4 lands, and turns an unbuilt dependency
into an honest 501 rather than a crash or a faked response.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException
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
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    """Whether this streams (FR-B6.1 per-agent progress) or returns a single
    JSON payload is decided in Step 4 alongside graph.py and streaming.py —
    not committed to here."""
    try:
        from app.agents.orchestrator.graph import run_turn
    except ImportError:
        raise HTTPException(
            status_code=501,
            detail=(
                "Orchestrator not yet implemented (Step 4). "
                "The /chat contract is stable; execution is pending."
            ),
        )
    return await run_turn(body, current_user, db)