"""FR-B3.3 — every agent declares a JSON contract in both directions.

Specialists return AgentOutput. The orchestrator never reads a specialist's
free text; it reads `summary`, `findings` and `evidence`, which is what keeps
FR-B3.2 (no peer-to-peer messaging) enforceable.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field

from app.schemas.evidence import EvidenceItem


class AgentOutput(BaseModel):
    agent_name: str
    # One or two plain sentences. Never the final answer — the synthesizer
    # composes that from all agents together.
    summary: str
    findings: dict[str, Any] = Field(default_factory=dict)
    evidence: list[EvidenceItem] = Field(default_factory=list)
    # FR-B4.3 — what this agent could not obtain.
    missing_inputs: list[str] = Field(default_factory=list)


class PlannedStep(BaseModel):
    agent_name: str
    reason: str


class Plan(BaseModel):
    """FR-B1.1 — produced before any specialist runs."""

    steps: list[PlannedStep] = Field(default_factory=list)
    interpretation: str = ""
    needs_clarification: bool = False
    clarification_question: str | None = None