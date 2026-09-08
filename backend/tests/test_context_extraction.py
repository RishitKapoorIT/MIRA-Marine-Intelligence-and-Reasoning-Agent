"""Query-level context extraction (FR-D1, FR-D3, FR-A4.2)."""

import asyncio
from types import SimpleNamespace

from geoalchemy2 import WKTElement

from app.agents.orchestrator.graph import resolve_context
from app.core.constants import SRID, ResolutionRoute
from app.tools.geo_tool import (
    extract_coordinates, extract_place, extract_relative_time, resolve_window,
)

NO_BASE = SimpleNamespace(base_location=None, base_location_label=None)
WITH_BASE = SimpleNamespace(
    base_location=WKTElement("POINT(74.84 12.87)", srid=SRID),
    base_location_label="Mangaluru")


def ctx(query, user=NO_BASE):
    return asyncio.run(resolve_context({"_user": user, "query_text": query}))


print("--- Place extraction ---")
for q, want in [("Is it safe to sail from Karwar?", "karwar"),
                ("weather near Malpe tomorrow", "malpe"),
                ("MANGALURU conditions", "mangaluru"),
                ("kya aaj Bhatkal mein safe hai", "bhatkal"),
                ("fishing near Timbuktu", None),
                ("is it safe", None)]:
    got = extract_place(q)
    assert got == want, (q, got, want)
    print(f"  PASS  {q!r:42} -> {got}")

print("\n  whole-word matching, no substring false positives:")
assert extract_place("karwarrior gaming") is None
assert extract_place("udupimania") is None
print("  PASS  'karwarrior' and 'udupimania' do not match")

print("\n--- Coordinates ---")
assert extract_coordinates("conditions at 12.87, 74.84") == (12.87, 74.84)
assert extract_coordinates("12.87N 74.84E please") == (12.87, 74.84)
assert extract_coordinates("no numbers here") is None
assert extract_coordinates("999.9, 74.84") is None
print("  PASS  parsed, and out-of-range rejected")

print("\n--- Relative time (FR-D3.1, three languages) ---")
for q, want in [("is it safe tomorrow", "tomorrow"), ("safe tonight?", "tonight"),
                ("aaj kaisa hai", "today"), ("kal safe hai kya", "tomorrow"),
                ("naale hegide", "tomorrow"), ("day after tomorrow", "day_after_tomorrow"),
                ("parso", "day_after_tomorrow"), ("is it safe", None)]:
    got = extract_relative_time(q)
    assert got == want, (q, got, want)
    print(f"  PASS  {q!r:28} -> {got}")

assert extract_relative_time("day after tomorrow") == "day_after_tomorrow", "longest-first"
print("  PASS  'day after tomorrow' not shadowed by 'tomorrow'")

print("\n--- The reported bug: Karwar, no base location ---")
out = ctx("Is it safe to sail from Karwar?")
loc = out["location"]
assert loc is not None, "regression: still aborting"
assert loc.route == ResolutionRoute.NAMED_PLACE
assert (round(loc.latitude, 2), round(loc.longitude, 2)) == (14.81, 74.13)
print(f"  PASS  resolves to {loc.route.value} ({loc.latitude}, {loc.longitude}) instead of aborting")

print("\n--- Named place beats base location (FR-D1.2) ---")
out = ctx("weather at Karwar", WITH_BASE)
assert out["location"].route == ResolutionRoute.NAMED_PLACE
assert round(out["location"].latitude, 2) == 14.81
print("  PASS  asking about Karwar from a Mangaluru account answers for Karwar")

out = ctx("is it safe tomorrow", WITH_BASE)
assert out["location"].route == ResolutionRoute.BASE_LOCATION
print("  PASS  no place named -> falls back to base location")

print("\n--- Time now reaches the window (FR-A4.2) ---")
out = ctx("Is it safe at Karwar tomorrow?")
assert out["window"].assumed is False, "explicit 'tomorrow' must not be flagged assumed"
assert "tomorrow" in out["window"].description
print(f"  PASS  'tomorrow' -> {out['window'].description}, assumed=False")

out = ctx("Is it safe at Karwar?")
assert out["window"].assumed is True
print(f"  PASS  no time given -> {out['window'].description}, assumed=True")

print("\n--- FR-D1.4: still asks rather than guessing ---")
out = ctx("is it safe to go fishing tomorrow")
assert out["location"] is None and out["clarification_needed"]
assert "Mangaluru" in out["clarification_needed"]
print("  PASS  unknown location asks, and names examples that would work")

print("\n--- Coordinates outrank a named place ---")
out = ctx("conditions at 13.50, 74.20 near Karwar")
assert out["location"].route == ResolutionRoute.EXPLICIT_COORDS
print("  PASS  explicit coordinates win")

print("\nCONTEXT EXTRACTION TESTS PASSED")