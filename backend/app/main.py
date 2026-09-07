"""FastAPI app factory."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import settings
from app.db.session import dispose_engine


logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.dev_auth_bypass:
        logger.warning(
            "=" * 72 + "\n"
            "  DEV_AUTH_BYPASS IS ENABLED. Every request is authenticated as\n"
            "  the development user (%s). Never enable this outside local\n"
            "  development.\n" + "=" * 72,
            settings.dev_auth_phone,
        )
    yield
    await dispose_engine()


app = FastAPI(title="ORCA / MIRA Backend", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,  # required for the session cookie to be sent
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}