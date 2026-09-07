"""FR-H1, FR-H2 — mobile + OTP identity, no password, session persistence."""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Request, Response
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import (
    COOKIE_NAME,
    check_rate_limit,
    clear_session_cookie,
    get_current_user,
    issue_session_token,
    set_session_cookie,
    try_decode_session_token,
    verify_firebase_id_token,
)
from app.db.models import User
from app.db.session import get_session

router = APIRouter()


class VerifyRequest(BaseModel):
    id_token: str


class VerifyResponse(BaseModel):
    user_id: uuid.UUID
    onboarding_completed: bool


@router.post("/verify", response_model=VerifyResponse)
async def verify(
    body: VerifyRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_session),
) -> VerifyResponse:
    """Client verifies the OTP via the Firebase client SDK and sends the
    resulting ID token here. FR-H1.3: rate-limited per client IP, since the
    caller has no identified account yet.
    """
    check_rate_limit(request.client.host if request.client else "unknown")

    claims = verify_firebase_id_token(body.id_token)
    firebase_uid = claims["uid"]
    phone_number = claims.get("phone_number", "")

    result = await db.execute(select(User).where(User.firebase_uid == firebase_uid))
    user = result.scalar_one_or_none()

    if user is None:
        # Demo-scale simplification: a race between two simultaneous first
        # logins for the same brand-new number could double-insert here.
        # Acceptable at NFR-C1 scale; an ON CONFLICT upsert would close it.
        user = User(firebase_uid=firebase_uid, phone_number=phone_number)
        db.add(user)
        await db.flush()  # assigns user.id before we sign a cookie referencing it

    user.last_seen_at = datetime.now(timezone.utc)

    set_session_cookie(response, issue_session_token(user.id))

    return VerifyResponse(
        user_id=user.id,
        onboarding_completed=user.onboarding_completed_at is not None,
    )


@router.post("/logout")
async def logout(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_session),
) -> dict:
    """FR-H2.2 — revocable by explicit logout. Idempotent: always clears the
    cookie, even if the session was already invalid or missing."""
    token = request.cookies.get(COOKIE_NAME)
    if token:
        payload = try_decode_session_token(token)
        if payload:
            user = await db.get(User, uuid.UUID(payload["uid"]))
            if user is not None:
                user.session_revoked_at = datetime.now(timezone.utc)

    clear_session_cookie(response)
    return {"status": "logged_out"}


@router.get("/me")
async def me(current_user: User = Depends(get_current_user)) -> dict:
    return {
        "user_id": current_user.id,
        "phone_number": current_user.phone_number,
        "display_name": current_user.display_name,
        "preferred_language": current_user.preferred_language,
        "onboarding_completed": current_user.onboarding_completed_at is not None,
        "has_base_location": current_user.base_location is not None,
    }