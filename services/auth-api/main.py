"""
ORCA / MIRA Auth & Profile Service
Provides mobile + OTP identity, session cookies, and profile persistence (Safe House, Safe Route, Aadhaar, i18n preferences).
Uses lightweight SQLite storage (zero external servers or PostgreSQL dependencies).
"""

import os
import json
import time
import uuid
import sqlite3
import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any

from fastapi import FastAPI, HTTPException, Request, Response, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("orca-auth")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "users.db")
COOKIE_NAME = "orca_session"
SESSION_MAX_AGE_SECONDS = 30 * 24 * 3600  # 30 days session

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                phone TEXT UNIQUE NOT NULL,
                name TEXT,
                safe_house TEXT,
                safe_route TEXT,
                aadhaar TEXT,
                preferred_language TEXT DEFAULT 'en',
                onboarding_completed INTEGER DEFAULT 0,
                created_at TEXT,
                updated_at TEXT
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS otp_tokens (
                phone TEXT PRIMARY KEY,
                otp TEXT NOT NULL,
                expires_at REAL NOT NULL
            )
        """)
        conn.commit()

init_db()

app = FastAPI(
    title="ORCA / MIRA Auth & Profile Service",
    description="Mobile OTP authentication and User Profile management with Safe House & Safe Route persistence.",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class RequestOtpBody(BaseModel):
    phone: str

class VerifyOtpBody(BaseModel):
    phone: str
    otp: str

class SafeHouseModel(BaseModel):
    lat: float
    lon: float
    label: str

class SafeRoutePort(BaseModel):
    id: str
    name: str
    lat: float
    lon: float
    region: Optional[str] = None

class SafeRouteModel(BaseModel):
    origin: Optional[SafeRoutePort] = None
    destination: Optional[SafeRoutePort] = None
    waypoint: Optional[SafeRoutePort] = None

class ProfileUpdateBody(BaseModel):
    name: Optional[str] = None
    safe_house: Optional[SafeHouseModel] = None
    safe_route: Optional[SafeRouteModel] = None
    aadhaar: Optional[str] = None  # Note: Optional identity field per FR-H; stored locally in demo SQLite
    preferred_language: Optional[str] = None

# ---------------------------------------------------------------------------
# Helper: Send SMS Hook (Adapter pattern for production SMS gateway)
# ---------------------------------------------------------------------------
def dispatch_sms_otp(phone: str, otp: str) -> None:
    """
    Adapter Hook: In development, logs OTP loudly to console and returns in response.
    To integrate production SMS (e.g. Fast2SMS, Twilio, Gupshup), replace this hook.
    """
    logger.info("=" * 60)
    logger.info(f"🔑 [ORCA AUTH DEV] Mobile OTP for {phone} is: {otp}")
    logger.info("=" * 60)

def serialize_user(row: sqlite3.Row) -> Dict[str, Any]:
    safe_house = None
    if row["safe_house"]:
        try:
            safe_house = json.loads(row["safe_house"])
        except Exception:
            safe_house = None

    safe_route = None
    if row["safe_route"]:
        try:
            safe_route = json.loads(row["safe_route"])
        except Exception:
            safe_route = None

    return {
        "id": row["id"],
        "phone": row["phone"],
        "name": row["name"] or "Coastal Fisher",
        "safe_house": safe_house or {"lat": 12.8698, "lon": 74.8431, "label": "Mangalore Old Port"},
        "safe_route": safe_route,
        "aadhaar": row["aadhaar"],
        "preferred_language": row["preferred_language"] or "en",
        "onboarding_completed": bool(row["onboarding_completed"]),
        "created_at": row["created_at"],
        "updated_at": row["updated_at"]
    }

def get_user_from_token(token: str) -> Optional[Dict[str, Any]]:
    if not token:
        return None
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE id = ?", (token,))
        row = cursor.fetchone()
        if row:
            return serialize_user(row)
    return None

def resolve_user(request: Request, authorization: Optional[str] = Header(None)) -> Dict[str, Any]:
    # Check cookie first, then Authorization: Bearer <token>
    token = request.cookies.get(COOKIE_NAME)
    if not token and authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]
    
    if not token:
        raise HTTPException(status_code=401, detail="Authentication session required")
    
    user = get_user_from_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    return user

# ---------------------------------------------------------------------------
# Auth Endpoints
# ---------------------------------------------------------------------------

@app.get("/health")
def health():
    return {"status": "online", "service": "orca-auth-profile", "db": "sqlite3"}

@app.post("/api/v1/auth/request-otp")
def request_otp(body: RequestOtpBody):
    phone = body.phone.strip()
    if len(phone) < 8:
        raise HTTPException(status_code=400, detail="Invalid phone number format")

    # In dev mode, generate a predictable OTP or random 6-digit
    otp = "123456"
    expires_at = time.time() + 600 # 10 minutes expiry

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO otp_tokens (phone, otp, expires_at) VALUES (?, ?, ?) "
            "ON CONFLICT(phone) DO UPDATE SET otp=excluded.otp, expires_at=excluded.expires_at",
            (phone, otp, expires_at)
        )
        conn.commit()

    dispatch_sms_otp(phone, otp)

    return {
        "status": "otp_sent",
        "phone": phone,
        "dev_otp": otp,
        "message": "Dev OTP generated. In demo mode, use 123456 or check console."
    }

@app.post("/api/v1/auth/verify-otp")
def verify_otp(body: VerifyOtpBody, response: Response):
    phone = body.phone.strip()
    entered_otp = body.otp.strip()

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM otp_tokens WHERE phone = ?", (phone,))
        row = cursor.fetchone()

        # Allow 123456 as master dev code or verify against database token
        valid = False
        if entered_otp == "123456":
            valid = True
        elif row and row["otp"] == entered_otp and time.time() <= row["expires_at"]:
            valid = True

        if not valid:
            raise HTTPException(status_code=400, detail="Invalid or expired OTP code")

        # Find or create user
        cursor.execute("SELECT * FROM users WHERE phone = ?", (phone,))
        user_row = cursor.fetchone()
        now_iso = datetime.now(timezone.utc).isoformat()

        if user_row is None:
            user_id = str(uuid.uuid4())
            default_safe_house = json.dumps({"lat": 12.8698, "lon": 74.8431, "label": "Mangalore Old Port"})
            cursor.execute(
                "INSERT INTO users (id, phone, name, safe_house, preferred_language, onboarding_completed, created_at, updated_at) "
                "VALUES (?, ?, ?, ?, 'en', 0, ?, ?)",
                (user_id, phone, "Coastal Fisher", default_safe_house, now_iso, now_iso)
            )
            conn.commit()
            cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
            user_row = cursor.fetchone()
            is_new_user = True
        else:
            is_new_user = not bool(user_row["onboarding_completed"])

        user_data = serialize_user(user_row)

        # Set persistent session cookie
        response.set_cookie(
            key=COOKIE_NAME,
            value=user_data["id"],
            max_age=SESSION_MAX_AGE_SECONDS,
            httponly=True,
            samesite="lax",
        )

        return {
            "status": "authenticated",
            "token": user_data["id"],
            "is_new_user": is_new_user,
            "user": user_data
        }

@app.post("/api/v1/auth/logout")
def logout(response: Response):
    response.delete_cookie(COOKIE_NAME)
    return {"status": "logged_out"}

@app.get("/api/v1/auth/me")
def get_me(request: Request, authorization: Optional[str] = Header(None)):
    user = resolve_user(request, authorization)
    return user

# ---------------------------------------------------------------------------
# Profile Endpoints
# ---------------------------------------------------------------------------

@app.get("/api/v1/profile")
def get_profile(request: Request, authorization: Optional[str] = Header(None)):
    user = resolve_user(request, authorization)
    return user

@app.put("/api/v1/profile")
def update_profile(body: ProfileUpdateBody, request: Request, authorization: Optional[str] = Header(None)):
    user = resolve_user(request, authorization)
    user_id = user["id"]

    updates = []
    params = []
    now_iso = datetime.now(timezone.utc).isoformat()

    if body.name is not None:
        updates.append("name = ?")
        params.append(body.name.strip())

    if body.safe_house is not None:
        updates.append("safe_house = ?")
        params.append(json.dumps(body.safe_house.model_dump()))

    if body.safe_route is not None:
        updates.append("safe_route = ?")
        params.append(json.dumps(body.safe_route.model_dump()))

    if body.aadhaar is not None:
        updates.append("aadhaar = ?")
        params.append(body.aadhaar.strip())

    if body.preferred_language is not None:
        updates.append("preferred_language = ?")
        params.append(body.preferred_language.strip())

    # Mark onboarding completed if safe_house provided
    if body.safe_house is not None or body.name is not None:
        updates.append("onboarding_completed = 1")

    updates.append("updated_at = ?")
    params.append(now_iso)
    params.append(user_id)

    with get_db() as conn:
        cursor = conn.cursor()
        query = f"UPDATE users SET {', '.join(updates)} WHERE id = ?"
        cursor.execute(query, params)
        conn.commit()

        cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
        updated_row = cursor.fetchone()
        return {
            "status": "updated",
            "user": serialize_user(updated_row)
        }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8001, reload=True)
