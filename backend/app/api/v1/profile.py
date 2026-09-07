"""FR-H3 onboarding + base location, FR-H5 view/change/delete."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from geoalchemy2 import WKTElement
from geoalchemy2.shape import to_shape
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import SRID
from app.core.security import get_current_user
from app.db.models import User
from app.db.session import get_session

router = APIRouter()


def _location_out(user: User) -> dict | None:
    """Reads a location loaded FROM the database. Do not call this on a
    location just assigned in-memory this request — see set_base_location,
    which echoes the input instead of round-tripping through to_shape."""
    if user.base_location is None:
        return None
    point = to_shape(user.base_location)
    return {
        "latitude": point.y,
        "longitude": point.x,
        "label": user.base_location_label,
        "consented_at": user.base_location_consent_at,
    }


@router.get("")
async def get_profile(current_user: User = Depends(get_current_user)) -> dict:
    return {
        "user_id": current_user.id,
        "phone_number": current_user.phone_number,
        "display_name": current_user.display_name,
        "preferred_language": current_user.preferred_language,
        "base_location": _location_out(current_user),
        "onboarding_completed": current_user.onboarding_completed_at is not None,
    }


class ProfileUpdate(BaseModel):
    display_name: str | None = None
    preferred_language: str | None = None


@router.put("")
async def update_profile(
    body: ProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> dict:
    if body.display_name is not None:
        current_user.display_name = body.display_name
    if body.preferred_language is not None:
        current_user.preferred_language = body.preferred_language
    return {"status": "updated"}


class BaseLocationUpdate(BaseModel):
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    label: str | None = None
    consent: bool


@router.put("/base-location")
async def set_base_location(
    body: BaseLocationUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> dict:
    """FR-H3.1 capture, FR-H3.2 consent recorded at the point of capture.
    ck_users_base_location_consent enforces this pairing at the DB level too.
    """
    if not body.consent:
        raise HTTPException(
            status_code=400, detail="Consent is required to store a base location"
        )

    current_user.base_location = WKTElement(
        f"POINT({body.longitude} {body.latitude})", srid=SRID
    )
    current_user.base_location_label = body.label
    current_user.base_location_consent_at = datetime.now(timezone.utc)

    if current_user.onboarding_completed_at is None:
        current_user.onboarding_completed_at = datetime.now(timezone.utc)

    # Echo the input rather than round-tripping through to_shape(): the
    # freshly assigned WKTElement hasn't been through the DB yet this request.
    return {
        "status": "updated",
        "base_location": {
            "latitude": body.latitude,
            "longitude": body.longitude,
            "label": body.label,
        },
    }


@router.delete("/base-location")
async def delete_base_location(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> dict:
    """FR-H5.1. Both columns clear together per ck_users_base_location_consent."""
    current_user.base_location = None
    current_user.base_location_label = None
    current_user.base_location_consent_at = None
    return {"status": "deleted"}