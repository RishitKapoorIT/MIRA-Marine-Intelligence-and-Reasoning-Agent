"""Fishing-zone specialist.

Reads the published PFZ cache. Never derives zones (FR-E1.2) and never
invents one when the cache is empty (FR-E1.8) — an empty result is reported
as empty, with the reason it was empty.
"""

from __future__ import annotations

from app.agents.specialists import register
from app.schemas.agent_io import AgentOutput
from app.tools import pfz_tool


@register(
    "ocean_agent",
    "Potential fishing zones: nearest zones with distance, bearing, area, and "
    "the sea surface temperature and chlorophyll values behind them.",
)
async def run(state) -> AgentOutput:
    location = state.get("location")
    db = state.get("_db")

    if location is None or db is None:
        return AgentOutput(
            agent_name="ocean_agent",
            summary="Location was not resolved.",
            missing_inputs=["location unresolved"],
        )

    result = await pfz_tool.get_nearest_zones(
        db, location.latitude, location.longitude, limit=5
    )

    if result.status == "unavailable":
        return AgentOutput(
            agent_name="ocean_agent",
            summary="No fishing-zone product has been published yet.",
            findings={"status": "unavailable"},
            missing_inputs=["PFZ product not yet computed"],
        )

    if result.status == "empty":
        # FR-E1.9 — the two causes read very differently to a fisherman.
        if result.empty_reason == "insufficient_coverage":
            summary = (
                "No fishing zones could be identified because satellite coverage "
                "was insufficient — most likely cloud cover over the area."
            )
        else:
            summary = (
                "No fishing zones met the criteria in the most recent analysis. "
                "This is a real result, not a data failure."
            )
        return AgentOutput(
            agent_name="ocean_agent",
            summary=summary,
            findings={"status": "empty", "empty_reason": result.empty_reason},
        )

    zones = [pfz_tool.zone_evidence(hit) for hit in result.zones]
    nearest = zones[0]

    return AgentOutput(
        agent_name="ocean_agent",
        summary=(
            f"{len(zones)} fishing zone(s) found. Nearest is "
            f"{nearest['distance_km']} km away at bearing "
            f"{nearest['bearing_deg']}°, classified {nearest['zone_class']}."
        ),
        findings={
            "status": "ok",
            "zone_count": len(zones),
            "zones": zones,
            "observation_date": (
                result.generation.observation_date.isoformat()
                if result.generation and result.generation.observation_date
                else None
            ),
            "is_stale": result.is_stale,
        },
        missing_inputs=(
            ["PFZ product is older than the configured freshness limit"]
            if result.is_stale
            else []
        ),
    )