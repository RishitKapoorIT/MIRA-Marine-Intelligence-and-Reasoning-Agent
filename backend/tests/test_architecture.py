import ast, pathlib

root = pathlib.Path("/home/swayam_bansal/projects/Project-Marine/backend/app")

def imports_of(path):
    tree = ast.parse(path.read_text())
    out = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom) and node.module:
            out.add(node.module)
        elif isinstance(node, ast.Import):
            out.update(a.name for a in node.names)
    return out

# FR-F5.8: the alerts view must not invoke the agent layer.
alerts_imports = imports_of(root / "api/v1/alerts.py")
agent_imports = {m for m in alerts_imports if m.startswith("app.agents")}
assert not agent_imports, agent_imports
print("FR-F5.8: api/v1/alerts.py imports from app.agents ->", agent_imports or "NONE")

# Tools are deterministic: no tool may import the agent layer or an LLM SDK.
for tool in sorted((root / "tools").glob("*.py")):
    if tool.name == "__init__.py":
        continue
    imps = imports_of(tool)
    bad = {m for m in imps if m.startswith("app.agents") or m.split(".")[0] in {"groq", "langchain", "langgraph", "langchain_groq", "openai"}}
    assert not bad, (tool.name, bad)
    print(f"  {tool.name:20} deterministic (no agent/LLM imports)")

# FR-E1.2: pfz_tool must not do HTTP.
pfz_imports = imports_of(root / "tools/pfz_tool.py")
assert "httpx" not in pfz_imports
assert not any(m.startswith("app.tools.base") for m in pfz_imports), pfz_imports
print("FR-E1.2: tools/pfz_tool.py has no httpx import -> cache-read only")

# Tools must not import routers (dependency direction).
for tool in sorted((root / "tools").glob("*.py")):
    imps = imports_of(tool)
    assert not any(m.startswith("app.api") for m in imps), tool.name
print("dependency direction: no tool imports app.api")
print()
print("ARCHITECTURE CHECKS PASSED")