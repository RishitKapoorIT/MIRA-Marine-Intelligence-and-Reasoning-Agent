"""Authentication: Firebase ID-token verification at login, and our own
signed session cookie thereafter.

Firebase's own session-cookie mechanism (firebase_admin.auth.create_session_
cookie) hard-caps expires_in between 5 minutes and 14 days. FR-H2.2 requires
a 30-day session, refreshed on activity, revocable by explicit logout — all
three of which a bare Firebase session cookie cannot give us. Rather than
silently shipping a 14-day session against a signed-off requirement, login
verifies the Firebase ID token once to establish identity, then issues our
own itsdangerous-signed cookie whose lifetime and revocation we control
directly. Firebase remains the sole identity/OTP provider (EI-12); it is
just not the session mechanism.
"""

import time
import uuid
from datetime import datetime, timezone
from pathlib import Path

import firebase_admin
from firebase_admin import auth as firebase_auth
from firebase_admin import credentials
from fastapi import Depends, HTTPException, Request, Response, status
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.models import User
from app.db.session import get_session

COOKIE_NAME = "orca_session"
SESSION_MAX_AGE_SECONDS = settings.session_lifetime_days * 24 * 3600
REFRESH_THRESHOLD_SECONDS = 24 * 3600  # reissue the cookie once it's >1 day old

_serializer = URLSafeTimedSerializer(settings.session_secret, salt="orca-session")

_firebase_app: firebase_admin.App | None = None


def _get_firebase_app() -> firebase_admin.App:
    """Lazy init: importing this module never requires real credentials —
    only calling verify_firebase_id_token does."""
    global _firebase_app
    if _firebase_app is None:
        cred_path = Path(settings.firebase_credentials_path)
        cred = (
            credentials.Certificate(str(cred_path))
            if cred_path.exists()
            else credentials.ApplicationDefault()
        )
        init_kwargs = (
            {"projectId": settings.firebase_project_id}
            if settings.firebase_project_id
            else {}
        )
        _firebase_app = firebase_admin.initialize_app(cred, init_kwargs)
    return _firebase_app


def verify_firebase_id_token(id_token: str) -> dict:
    """EI-12. 500 for a server misconfiguration, 401 for a bad/expired token
    — kept distinct so a missing credentials file doesn't read as user error.
    """
    try:
        app = _get_firebase_app()
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"Firebase not configured: {exc}"
        ) from None

    try:
        return firebase_auth.verify_id_token(id_token, app=app)
    except Exception as exc:
        raise HTTPException(status_code=401, detail=f"Invalid ID token: {exc}") from None


# --- Our own session cookie --------------------------------------------------

def issue_session_token(user_id: uuid.UUID) -> str:
    return _serializer.dumps({"uid": str(user_id), "iat": time.time()})


def _decode_session_token(token: str) -> dict:
    try:
        return _serializer.loads(token, max_age=SESSION_MAX_AGE_SECONDS)
    except (BadSignature, SignatureExpired):
        raise HTTPException(status_code=401, detail="Session expired or invalid") from None


def try_decode_session_token(token: str) -> dict | None:
    """Best-effort decode for paths like logout, where an already-invalid
    session is not itself an error worth surfacing."""
    try:
        return _decode_session_token(token)
    except HTTPException:
        return None


def set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        max_age=SESSION_MAX_AGE_SECONDS,
        httponly=True,
        secure=settings.is_production,
        samesite="lax",
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(COOKIE_NAME)


# --- FastAPI dependency ------------------------------------------------------

async def get_current_user(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_session),
) -> User:
    """FR-H2.1 session read. FR-H2.2 sliding refresh and revocation check."""
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    payload = _decode_session_token(token)
    user = await db.get(User, uuid.UUID(payload["uid"]))
    if user is None:
        raise HTTPException(status_code=401, detail="Session refers to an unknown user")

    issued_at = payload["iat"]
    if (
        user.session_revoked_at is not None
        and issued_at < user.session_revoked_at.timestamp()
    ):
        raise HTTPException(status_code=401, detail="Session has been revoked")

    user.last_seen_at = datetime.now(timezone.utc)

    if time.time() - issued_at > REFRESH_THRESHOLD_SECONDS:
        set_session_cookie(response, issue_session_token(user.id))

    return user


# --- OTP-endpoint rate limiting (FR-H1.3) ------------------------------------
# In-process sliding window. Sufficient at NFR-C1 demo scale (single
# instance); does not survive multiple workers or instances — move to a
# shared store (e.g. Redis) if NFR-C2 scale is ever reached.

_attempts: dict[str, list[float]] = {}
RATE_LIMIT_MAX_ATTEMPTS = 5
RATE_LIMIT_WINDOW_SECONDS = 600


def check_rate_limit(key: str) -> None:
    now = time.time()
    window = _attempts.setdefault(key, [])
    window[:] = [t for t in window if now - t < RATE_LIMIT_WINDOW_SECONDS]
    if len(window) >= RATE_LIMIT_MAX_ATTEMPTS:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many attempts. Try again later.",
        )
    window.append(now)