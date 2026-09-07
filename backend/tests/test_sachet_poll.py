"""SACHET poller tests. Everything except the live feed and live DB."""

import asyncio
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from shapely import wkt as shapely_wkt

from app.tools.base import DataKind, SourceEnvelope
from app.workers import sachet_poll as sp

NOW = datetime.now(timezone.utc)

CAP_TEMPLATE = '''<?xml version="1.0" encoding="UTF-8"?>
<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">
  <identifier>{ident}</identifier>
  <sender>ndma@gov.in</sender>
  <sent>2026-09-08T06:00:00+05:30</sent>
  <info>
    <language>en-IN</language>
    <event>{event}</event>
    <urgency>Immediate</urgency>
    <severity>{severity}</severity>
    <certainty>Likely</certainty>
    <senderName>India Meteorological Department</senderName>
    <headline>{event} warning</headline>
    <description>Test description.</description>
    <onset>2026-09-08T12:00:00+05:30</onset>
    <effective>2026-09-08T06:00:00+05:30</effective>
    <expires>2026-09-09T06:00:00+05:30</expires>
    <area>
      <areaDesc>Karnataka coastal districts</areaDesc>
      <polygon>{polygon}</polygon>
    </area>
  </info>
</alert>'''

GOOD_POLY = "12.0,74.0 12.0,75.0 13.0,75.0 13.0,74.0 12.0,74.0"
# Bowtie: rings cross themselves. PostGIS geography rejects these outright.
BOWTIE = "12.0,74.0 13.0,75.0 13.0,74.0 12.0,75.0 12.0,74.0"


print("--- Geometry normalisation ---")
good = sp.normalise_geometry("MULTIPOLYGON(((74 12, 75 12, 75 13, 74 13, 74 12)))")
assert good and shapely_wkt.loads(good).is_valid
print("  PASS  valid polygon passes through, still valid")

from app.tools.sachet_tool import _cap_polygon_to_wkt
bow_wkt = "MULTIPOLYGON(" + _cap_polygon_to_wkt(BOWTIE).replace("POLYGON", "").strip() + ")"
assert not shapely_wkt.loads(bow_wkt).is_valid, "test fixture should be invalid"
repaired = sp.normalise_geometry(bow_wkt)
assert repaired is not None, "bowtie should be repaired, not dropped"
g = shapely_wkt.loads(repaired)
assert g.is_valid and g.geom_type == "MultiPolygon", g.geom_type
print(f"  PASS  self-intersecting bowtie repaired -> valid {g.geom_type}")

assert sp.normalise_geometry(None) is None
assert sp.normalise_geometry("NOT WKT AT ALL") is None
print("  PASS  missing / unparseable geometry -> None (alert kept, polygon dropped)")


print("\n--- to_alert_values ---")
from app.tools.sachet_tool import parse_cap_alert
parsed = parse_cap_alert(CAP_TEMPLATE.format(ident="A-1", event="Cyclonic Storm",
                                             severity="Severe", polygon=GOOD_POLY))
vals = sp.to_alert_values(parsed)
assert "area_wkt" not in vals, "raw wkt key must not reach the column mapping"
assert vals["area_geom"].startswith("SRID=4326;MULTIPOLYGON")
assert vals["cap_identifier"] == "A-1"
assert vals["severity"].value == "Severe"
assert vals["ingested_at"] is not None
print("  PASS  column values built, SRID prefixed, area_wkt key removed")

parsed_bad = parse_cap_alert(CAP_TEMPLATE.format(ident="A-2", event="Flood",
                                                 severity="Moderate", polygon="garbage"))
vals_bad = sp.to_alert_values(parsed_bad)
assert vals_bad["area_geom"] is None
assert vals_bad["area_description"] == "Karnataka coastal districts"
print("  PASS  alert with bad polygon retained, area_geom=None, description intact")


print("\n--- poll_once ---")

class FakeDB:
    def __init__(self):
        self.executed = []
        self.status = None
        self.committed = False
    async def execute(self, stmt):
        self.executed.append(stmt)
        return SimpleNamespace(rowcount=0)
    async def get(self, model, key):
        return self.status
    def add(self, obj):
        self.status = obj
    async def commit(self):
        self.committed = True

def feed_ok(links):
    return SourceEnvelope(source_id="sachet_cap", kind=DataKind.OBSERVATION,
                          valid_at=NOW, values={"links": links})

async def main():
    # --- feed down: status recorded, nothing else attempted
    db = FakeDB()
    down = SourceEnvelope.unavailable("sachet_cap", DataKind.OBSERVATION, "connection refused")
    with patch.object(sp.sachet_tool, "fetch_alert_feed", AsyncMock(return_value=down)):
        summary = await sp.poll_once(db)
    assert summary["feed_available"] is False
    assert summary["upserted"] == 0
    assert db.status is not None and db.status.is_available is False
    assert db.status.consecutive_failures == 1
    assert not db.committed, "must not commit a success path on failure"
    print(f"  PASS  feed down -> is_available=False, failures=1, reason={summary['reason']!r}")

    # --- feed up, two documents
    db = FakeDB()
    docs = {
        "http://x/1": CAP_TEMPLATE.format(ident="A-1", event="Cyclonic Storm", severity="Severe", polygon=GOOD_POLY),
        "http://x/2": CAP_TEMPLATE.format(ident="A-2", event="Heavy Rainfall", severity="Moderate", polygon=BOWTIE),
    }
    async def fake_fetch_text(url, **k):
        return docs[url], None
    with patch.object(sp.sachet_tool, "fetch_alert_feed", AsyncMock(return_value=feed_ok(list(docs)))), \
         patch.object(sp, "fetch_text", fake_fetch_text):
        summary = await sp.poll_once(db)
    assert summary["feed_available"] is True
    assert summary["parsed"] == 2 and summary["upserted"] == 2, summary
    assert db.status.is_available is True and db.status.consecutive_failures == 0
    assert db.committed
    print(f"  PASS  feed up -> {summary['parsed']} parsed, {summary['upserted']} upserted, is_available=True")
    print("        (bowtie alert survived: repaired rather than dropped)")

    # --- duplicate identifiers in one feed must not reach a single INSERT twice
    db = FakeDB()
    dup = CAP_TEMPLATE.format(ident="SAME", event="Flood", severity="Minor", polygon=GOOD_POLY)
    docs2 = {"http://x/a": dup, "http://x/b": dup}
    async def fake_fetch_dup(url, **k):
        return docs2[url], None
    with patch.object(sp.sachet_tool, "fetch_alert_feed", AsyncMock(return_value=feed_ok(list(docs2)))), \
         patch.object(sp, "fetch_text", fake_fetch_dup):
        summary = await sp.poll_once(db)
    assert summary["parsed"] == 1, summary
    print(f"  PASS  duplicate identifier deduped in-batch -> parsed={summary['parsed']}")

    # --- one bad document must not lose the good ones
    db = FakeDB()
    docs3 = {"http://x/ok": CAP_TEMPLATE.format(ident="A-9", event="Gale", severity="Severe", polygon=GOOD_POLY),
             "http://x/bad": "<html>404 not found</html>"}
    async def fake_fetch_mixed(url, **k):
        return docs3[url], None
    with patch.object(sp.sachet_tool, "fetch_alert_feed", AsyncMock(return_value=feed_ok(list(docs3)))), \
         patch.object(sp, "fetch_text", fake_fetch_mixed):
        summary = await sp.poll_once(db)
    assert summary["parsed"] == 1, summary
    assert summary["feed_available"] is True
    print("  PASS  unparseable document skipped, good document still stored")

    # --- fetch failure on one link
    db = FakeDB()
    docs4 = {"http://x/ok": CAP_TEMPLATE.format(ident="A-10", event="Gale", severity="Minor", polygon=GOOD_POLY)}
    async def fake_fetch_err(url, **k):
        if url == "http://x/dead":
            return None, "Timed out after 15.0s"
        return docs4[url], None
    with patch.object(sp.sachet_tool, "fetch_alert_feed", AsyncMock(return_value=feed_ok(["http://x/ok", "http://x/dead"]))), \
         patch.object(sp, "fetch_text", fake_fetch_err):
        summary = await sp.poll_once(db)
    assert summary["parsed"] == 1
    print("  PASS  per-document fetch failure tolerated")

    print("\nSACHET POLLER TESTS PASSED")

asyncio.run(main())