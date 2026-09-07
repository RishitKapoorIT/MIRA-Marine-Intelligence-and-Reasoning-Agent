"""Shared request/response primitives."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel

from app.core.constants import ResolutionRoute


class ResolvedLocationOut(BaseModel):
    latitude: float
    longitude: float
    # FR-D1.3 — the answer must state which route produced the location.
    resolution_route: ResolutionRoute
    label: str | None = None


class TimeWindowOut(BaseModel):
    start: datetime
    end: datetime
    # FR-A4.2 — a defaulted window must be visible to the user.
    assumed: bool
    description: str