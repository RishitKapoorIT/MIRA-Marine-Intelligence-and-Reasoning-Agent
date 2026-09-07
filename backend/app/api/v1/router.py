from fastapi import APIRouter

from app.api.v1 import alerts, auth, chat, pfz, profile

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(profile.router, prefix="/profile", tags=["profile"])
api_router.include_router(alerts.router, prefix="/alerts", tags=["alerts"])
api_router.include_router(pfz.router, prefix="/pfz", tags=["pfz"])
api_router.include_router(chat.router, prefix="/chat", tags=["chat"])