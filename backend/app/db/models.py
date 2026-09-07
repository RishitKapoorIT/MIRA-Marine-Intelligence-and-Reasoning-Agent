"""ORCA data model.

SQLAlchemy 2.0 declarative, GeoAlchemy2 for spatial columns.

All spatial columns are Geography(srid=4326) rather than Geometry, so that
ST_Distance returns metres and ST_Area returns square metres without an
intermediate projection. This is what FR-E1.1 (distance and bearing),
FR-F1.3 (25 km buffer) and the 100 km2 minimum-zone floor all need.
Clustering in workers/pfz_derive.py casts to ::geometry where required.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime

from geoalchemy2 import Geography
from geoalchemy2.elements import WKBElement
from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    Enum as SAEnum,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

from app.core.constants import (
    SRID,
    CapCertainty,
    CapSeverity,
    CapUrgency,
    DEFAULT_LANGUAGE,
    EmptyReason,
    GenerationStatus,
    InvocationStatus,
    PfzZoneClass,
    ResolutionRoute,
    TurnStatus,
    Verdict,
)


def pg_enum(enum_cls, name: str) -> SAEnum:
    """Native PG enum storing `.value`, not the member name."""
    return SAEnum(
        enum_cls,
        name=name,
        native_enum=True,
        values_callable=lambda e: [m.value for m in e],
    )


class Base(DeclarativeBase):
    pass


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


# ---------------------------------------------------------------------------
# Identity & profile  (FR-H)
# ---------------------------------------------------------------------------

class User(Base, TimestampMixin):
    """FR-H1-H5. Base location is folded in here rather than held in its own
    table, because it is strictly one-per-user.

    NFR-S1: no positional history is stored for any user. NFR-S2: phone_number
    exists for auth and alert delivery only and is never exposed to other users.
    """

    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)

    # EI-12 Firebase Phone Auth is the identity provider; no password (NFR-S4).
    firebase_uid: Mapped[str] = mapped_column(String(128), unique=True, nullable=False)
    phone_number: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)

    display_name: Mapped[str | None] = mapped_column(String(120))
    preferred_language: Mapped[str] = mapped_column(
        String(8), default=DEFAULT_LANGUAGE, nullable=False
    )

    # --- Base location (FR-H3.1, FR-H5.1). Nullable: set during onboarding. ---
    base_location: Mapped[WKBElement | None] = mapped_column(
        Geography(geometry_type="POINT", srid=SRID, spatial_index=True)
    )
    base_location_label: Mapped[str | None] = mapped_column(String(200))
    # FR-H3.2 / NFR-S7: consent is captured at the point of capture.
    base_location_consent_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True)
    )

    onboarding_completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True)
    )
    # FR-H7.1: seeded Karnataka demo accounts, so judging needs no live onboarding.
    is_demo: Mapped[bool] = mapped_column(server_default=text("false"), nullable=False)
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # FR-H2.2 explicit-logout revocation. Firebase's own session-cookie
    # mechanism caps expiresIn at 14 days, short of the signed-off 30-day
    # requirement, so app/core/security.py issues its own signed token and
    # uses this column to make logout an actual server-side revocation
    # rather than a client-side-only cookie clear.
    session_revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    
    conversations: Mapped[list[Conversation]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )

    __table_args__ = (
        # A base location without recorded consent would violate FR-H3.2.
        CheckConstraint(
            "(base_location IS NULL) = (base_location_consent_at IS NULL)",
            name="ck_users_base_location_consent",
        ),
    )


# ---------------------------------------------------------------------------
# Conversation, plan trace, evidence  (FR-A, FR-B, FR-G)
# ---------------------------------------------------------------------------

class Conversation(Base, TimestampMixin):
    """FR-A3.1 multi-turn context container. NFR-S6: deleted with the account."""

    __tablename__ = "conversations"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str | None] = mapped_column(String(200))

    user: Mapped[User] = relationship(back_populates="conversations")
    turns: Mapped[list[Turn]] = relationship(
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="Turn.sequence_index",
    )


class Turn(Base):
    """One question and answer.

    Holds the plan trace (FR-B1.2 requires it persisted *with* the turn) and the
    evidence panel (FR-G1.1). Per-agent detail lives in AgentInvocation so that
    NFR-A4 latency is queryable rather than buried in JSON.
    """

    __tablename__ = "turns"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    conversation_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    sequence_index: Mapped[int] = mapped_column(Integer, nullable=False)

    # --- Input ---
    query_text: Mapped[str] = mapped_column(Text, nullable=False)
    detected_language: Mapped[str | None] = mapped_column(String(8))
    # FR-A2.4: when confidence is low we assume a language and say so.
    language_assumed: Mapped[bool] = mapped_column(
        server_default=text("false"), nullable=False
    )
    was_voice_input: Mapped[bool] = mapped_column(
        server_default=text("false"), nullable=False
    )

    # --- Resolved context (FR-D1, FR-D3) ---
    resolved_point: Mapped[WKBElement | None] = mapped_column(
        Geography(geometry_type="POINT", srid=SRID, spatial_index=True)
    )
    resolution_route: Mapped[ResolutionRoute | None] = mapped_column(
        pg_enum(ResolutionRoute, "resolution_route")
    )
    resolved_place_label: Mapped[str | None] = mapped_column(String(200))
    window_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    window_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # FR-A4.2: a defaulted time window must be stated in the answer.
    window_assumed: Mapped[bool] = mapped_column(
        server_default=text("false"), nullable=False
    )

    # --- Output ---
    answer_text: Mapped[str | None] = mapped_column(Text)
    status: Mapped[TurnStatus] = mapped_column(
        pg_enum(TurnStatus, "turn_status"),
        default=TurnStatus.COMPLETE,
        nullable=False,
    )
    # FR-B4.3: a partial answer names what is missing rather than hiding the gap.
    missing_inputs: Mapped[list | None] = mapped_column(JSONB)
    # FR-B4.2: conflicting agent outputs are surfaced, never silently resolved.
    conflicts: Mapped[list | None] = mapped_column(JSONB)

    # FR-B1.1 / FR-B5.1: the plan, inspectable on request.
    plan: Mapped[dict | None] = mapped_column(JSONB)
    # FR-G1.1: sources, values, observation timestamps, thresholds applied.
    evidence: Mapped[list | None] = mapped_column(JSONB)
    # FR-I1 / FR-I2: which disclosure keys this answer must render.
    disclosures: Mapped[list | None] = mapped_column(JSONB)

    total_latency_ms: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    conversation: Mapped[Conversation] = relationship(back_populates="turns")
    invocations: Mapped[list[AgentInvocation]] = relationship(
        back_populates="turn",
        cascade="all, delete-orphan",
        order_by="AgentInvocation.sequence_index",
    )

    __table_args__ = (
        UniqueConstraint("conversation_id", "sequence_index", name="uq_turn_sequence"),
    )


class AgentInvocation(Base):
    """FR-B5.2: which agents ran, in what order, and what each returned.
    NFR-A4: per-agent latency recorded so the NFR-P budgets are measurable.
    """

    __tablename__ = "agent_invocations"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    turn_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("turns.id", ondelete="CASCADE"), nullable=False, index=True
    )
    sequence_index: Mapped[int] = mapped_column(Integer, nullable=False)

    agent_name: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    status: Mapped[InvocationStatus] = mapped_column(
        pg_enum(InvocationStatus, "invocation_status"), nullable=False
    )

    # FR-B3.3: structured JSON conforming to a declared schema, both directions.
    input_payload: Mapped[dict | None] = mapped_column(JSONB)
    output_payload: Mapped[dict | None] = mapped_column(JSONB)
    error_detail: Mapped[str | None] = mapped_column(Text)

    latency_ms: Mapped[int | None] = mapped_column(Integer)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    turn: Mapped[Turn] = relationship(back_populates="invocations")

    __table_args__ = (
        UniqueConstraint("turn_id", "sequence_index", name="uq_invocation_sequence"),
    )


# ---------------------------------------------------------------------------
# Hazard alerts  (FR-C4, FR-E4, FR-F5)
# ---------------------------------------------------------------------------

class Alert(Base):
    """NDMA SACHET CAP alert, ingested deterministically (FR-C4.2 — never
    LLM-inferred). FR-C4.3: severity, polygon, validity window and originating
    agency are all retained.
    """

    __tablename__ = "alerts"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    # CAP <identifier> — the natural dedupe key for the poller.
    cap_identifier: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    cap_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Free text in CAP's <event>; String, not an enum (NFR-C4).
    hazard_type: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    severity: Mapped[CapSeverity] = mapped_column(
        pg_enum(CapSeverity, "cap_severity"), nullable=False, index=True
    )
    urgency: Mapped[CapUrgency | None] = mapped_column(pg_enum(CapUrgency, "cap_urgency"))
    certainty: Mapped[CapCertainty | None] = mapped_column(
        pg_enum(CapCertainty, "cap_certainty")
    )

    # FR-F5.7: original agency text is preserved and always displayed.
    # Translation is offered alongside it at read time and never stored over it.
    headline: Mapped[str | None] = mapped_column(Text)
    description: Mapped[str | None] = mapped_column(Text)
    instruction: Mapped[str | None] = mapped_column(Text)
    original_language: Mapped[str | None] = mapped_column(String(8))

    # §8.2 / FR-I5.1: the originating agency must be credited in the UI.
    originating_agency: Mapped[str | None] = mapped_column(String(120))
    area_description: Mapped[str | None] = mapped_column(Text)

    area_geom: Mapped[WKBElement | None] = mapped_column(
        Geography(geometry_type="MULTIPOLYGON", srid=SRID, spatial_index=True)
    )

    onset_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    effective_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), index=True
    )

    raw_cap: Mapped[dict | None] = mapped_column(JSONB)
    ingested_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        # FR-F5.9: purge runs on this; FR-F5.6 reads expired alerts for 7 days.
        Index("ix_alerts_expiry_severity", "expires_at", "severity"),
    )


# ---------------------------------------------------------------------------
# Source health  (FR-C6, FR-F5.4, §7.8)
# ---------------------------------------------------------------------------

class SourceStatus(Base):
    """One row per external interface. Drives the §7.8 degradation matrix and
    FR-F5.4's 'feed status and last-successful-update' display.

    FR-C6.3: when a source is down and no acceptable cache exists, the answer
    states the absence. It never substitutes a modelled or default value.
    """

    __tablename__ = "source_status"

    source_id: Mapped[str] = mapped_column(String(32), primary_key=True)
    is_available: Mapped[bool] = mapped_column(server_default=text("true"), nullable=False)

    last_attempt_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_success_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # FR-C6.1: the true timestamp of the observation, not of our fetch.
    last_observation_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    consecutive_failures: Mapped[int] = mapped_column(
        Integer, server_default=text("0"), nullable=False
    )
    detail: Mapped[str | None] = mapped_column(Text)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(),
        nullable=False,
    )


# ---------------------------------------------------------------------------
# PFZ derived product  (FR-E1)
# ---------------------------------------------------------------------------

class PfzGeneration(Base):
    """One batch run. FR-E1.2: zones are served from here, never derived live.

    FR-E1.14 atomic publish is enforced by uq_pfz_one_published below: at most
    one row may hold status='published'. The worker builds into 'building', then
    flips statuses inside a single transaction, so a reader can never observe a
    partially written generation.
    """

    __tablename__ = "pfz_generations"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    status: Mapped[GenerationStatus] = mapped_column(
        pg_enum(GenerationStatus, "pfz_generation_status"),
        default=GenerationStatus.BUILDING,
        nullable=False,
    )

    # FR-E1.11: the observation date is what the user is shown; computed_at is not.
    observation_date: Mapped[date | None] = mapped_column(Date)
    computed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # FR-E1.10: rolling composite window, and which dates actually contributed.
    composite_days: Mapped[int | None] = mapped_column(Integer)
    contributing_dates: Mapped[list | None] = mapped_column(JSONB)

    # Grid snapshot, so a generation stays interpretable after RK-9 retuning.
    grid_bbox: Mapped[dict | None] = mapped_column(JSONB)
    grid_spacing_deg: Mapped[float | None] = mapped_column(Float)
    thresholds_snapshot: Mapped[dict | None] = mapped_column(JSONB)

    points_evaluated: Mapped[int | None] = mapped_column(Integer)
    # FR-E1.9 / FR-E1.15: coverage decides whether an empty result means
    # "nothing qualified" or "we could not see enough of the ocean".
    coverage_fraction: Mapped[float | None] = mapped_column(Float)
    zone_count: Mapped[int | None] = mapped_column(Integer)
    empty_reason: Mapped[EmptyReason | None] = mapped_column(
        pg_enum(EmptyReason, "pfz_empty_reason")
    )
    failure_detail: Mapped[str | None] = mapped_column(Text)

    zones: Mapped[list[PfzZone]] = relationship(
        back_populates="generation", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index(
            "uq_pfz_one_published",
            "status",
            unique=True,
            postgresql_where=text("status = 'published'"),
        ),
        CheckConstraint(
            "coverage_fraction IS NULL OR (coverage_fraction >= 0 AND coverage_fraction <= 1)",
            name="ck_pfz_coverage_fraction_range",
        ),
    )


class PfzZone(Base):
    """A clustered zone polygon.

    FR-E1.7: zone count is an output of the data. Nothing in this table takes a
    target count as input — the worker thresholds, clusters what qualifies, and
    discards clusters below the configured minimum area.
    """

    __tablename__ = "pfz_zones"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    generation_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("pfz_generations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    geom: Mapped[WKBElement] = mapped_column(
        Geography(geometry_type="POLYGON", srid=SRID, spatial_index=True),
        nullable=False,
    )
    centroid: Mapped[WKBElement] = mapped_column(
        Geography(geometry_type="POINT", srid=SRID, spatial_index=True), nullable=False
    )
    area_km2: Mapped[float] = mapped_column(Float, nullable=False)
    point_count: Mapped[int | None] = mapped_column(Integer)

    zone_class: Mapped[PfzZoneClass] = mapped_column(
        pg_enum(PfzZoneClass, "pfz_zone_class"), nullable=False, index=True
    )
    # Mean of the microservice's per-point class probabilities.
    confidence: Mapped[float | None] = mapped_column(Float)

    # --- FR-E1.4: the values behind the zone, shown in the evidence panel ---
    mean_sst_c: Mapped[float | None] = mapped_column(Float)
    mean_chlorophyll_mg_m3: Mapped[float | None] = mapped_column(Float)
    mean_current_speed_ms: Mapped[float | None] = mapped_column(Float)
    sst_gradient: Mapped[float | None] = mapped_column(Float)
    # Salinity has no free real-time source, so it is a climatology constant.
    # FR-C6.1/FR-G1.1: that provenance is recorded, not passed off as observed.
    salinity_psu: Mapped[float | None] = mapped_column(Float)
    feature_provenance: Mapped[dict | None] = mapped_column(JSONB)

    # FR-E1.11: observation date of the most recent contributing data.
    observation_date: Mapped[date | None] = mapped_column(Date)

    # --- FR-E1.12 / FR-E1.13, Iteration 2. Nullable now; backfilled when the
    # marineregions and WDPA layers land, so this stays a backfill not a migration.
    intersects_mpa: Mapped[bool | None] = mapped_column()
    intersects_restricted: Mapped[bool | None] = mapped_column()
    distance_to_boundary_m: Mapped[float | None] = mapped_column(Float)

    generation: Mapped[PfzGeneration] = relationship(back_populates="zones")

    __table_args__ = (
        CheckConstraint("area_km2 > 0", name="ck_pfz_zone_area_positive"),
    )