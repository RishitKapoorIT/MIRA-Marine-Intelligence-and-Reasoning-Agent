"""Specialist registry.

FR-B2.1 forbids routing on hardcoded query strings, and FR-B2.2 requires that
adding an agent not modify any existing agent. Both are handled here: each
specialist self-registers with a capability description, the planner is shown
that description list as data, and the graph dispatches by registry lookup.

Adding a fourth specialist is: write the module, add one import line at the
bottom of this file. No existing agent, the planner, or the graph changes.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Awaitable, Callable, TYPE_CHECKING

from app.schemas.agent_io import AgentOutput

if TYPE_CHECKING:
    from app.agents.orchestrator.state import OrcaState

SpecialistFn = Callable[["OrcaState"], Awaitable[AgentOutput]]


@dataclass
class Specialist:
    name: str
    description: str  # shown to the planner — this IS the routing signal
    run: SpecialistFn


SPECIALISTS: dict[str, Specialist] = {}


def register(name: str, description: str):
    def decorator(fn: SpecialistFn) -> SpecialistFn:
        SPECIALISTS[name] = Specialist(name=name, description=description, run=fn)
        return fn

    return decorator


def capability_catalogue() -> str:
    """Rendered into the planner prompt so routing follows the registry
    rather than anything baked into the prompt text."""
    return "\n".join(f"- {s.name}: {s.description}" for s in SPECIALISTS.values())


# Self-registration. One line per specialist; nothing else changes.
from app.agents.specialists import weather_agent  # noqa: E402,F401
from app.agents.specialists import ocean_agent  # noqa: E402,F401
from app.agents.specialists import risk_agent  # noqa: E402,F401