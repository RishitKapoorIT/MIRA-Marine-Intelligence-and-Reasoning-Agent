"""FR-B2.2: adding an agent must not modify any existing agent.

Registers a fourth specialist at runtime and confirms the planner catalogue
and graph dispatch both pick it up with zero edits elsewhere.
"""
import asyncio, hashlib, pathlib

files = ["app/agents/specialists/weather_agent.py",
         "app/agents/specialists/ocean_agent.py",
         "app/agents/specialists/risk_agent.py",
         "app/agents/orchestrator/graph.py",
         "app/agents/orchestrator/planner.py"]
before = {f: hashlib.sha256(pathlib.Path(f).read_bytes()).hexdigest() for f in files}

from app.agents.specialists import SPECIALISTS, capability_catalogue, register
from app.schemas.agent_io import AgentOutput

print("before:", list(SPECIALISTS))

@register("tide_agent", "Tide times and heights for a coastal location.")
async def run(state) -> AgentOutput:
    return AgentOutput(agent_name="tide_agent", summary="High tide at 14:20.")

print("after :", list(SPECIALISTS))
assert "tide_agent" in SPECIALISTS
assert "tide_agent" in capability_catalogue()
print("\nplanner catalogue now advertises it:")
print("  " + [l for l in capability_catalogue().splitlines() if "tide" in l][0])

# Graph dispatch reaches it with no graph edit
from app.agents.orchestrator.graph import _run_agents
outputs, invs = asyncio.run(_run_agents(["tide_agent"], {}, 0))
assert outputs["tide_agent"].summary == "High tide at 14:20."
assert invs[0]["status"] == "ok"
print(f"\ngraph dispatched it: status={invs[0]['status']}, latency={invs[0]['latency_ms']}ms")

after = {f: hashlib.sha256(pathlib.Path(f).read_bytes()).hexdigest() for f in files}
assert before == after
print("\nunchanged files:")
for f in files:
    print("  ", f.split('/')[-1])
print("\nFR-B2.2 VERIFIED: new agent registered, planned and dispatched; zero edits.")