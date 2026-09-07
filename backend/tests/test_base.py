import asyncio
from datetime import datetime, timedelta, timezone
from unittest.mock import patch, MagicMock

import httpx
from app.tools import base
from app.tools.base import DataKind, SourceEnvelope, fetch_json

# --- staleness semantics
now = datetime.now(timezone.utc)
fresh = SourceEnvelope(source_id="x", kind=DataKind.OBSERVATION, valid_at=now)
old   = SourceEnvelope(source_id="x", kind=DataKind.OBSERVATION, valid_at=now - timedelta(hours=10))
noneT = SourceEnvelope(source_id="x", kind=DataKind.OBSERVATION, valid_at=None)
down  = SourceEnvelope.unavailable("x", DataKind.OBSERVATION, "boom")

assert fresh.is_stale(timedelta(hours=6)) is False
assert old.is_stale(timedelta(hours=6)) is True
assert noneT.is_stale(timedelta(hours=6)) is True   # unknown freshness == stale
assert down.is_stale(timedelta(hours=6)) is True
print("staleness: fresh=False, old=True, unknown-valid_at=True, unavailable=True")
print("age_hours(old) =", round(old.age_hours(), 2))

# --- retry policy
calls = {"n": 0}

class Resp:
    def __init__(self, code, payload=None):
        self.status_code = code; self._p = payload or {}; self.text = "err"
    def json(self): return self._p

def make_client(sequence):
    def _factory(*a, **k):
        cm = MagicMock()
        async def _get(*a, **k):
            i = calls["n"]; calls["n"] += 1
            item = sequence[min(i, len(sequence)-1)]
            if isinstance(item, Exception): raise item
            return item
        cm.__aenter__ = lambda s: asyncio.sleep(0, result=cm)
        cm.__aexit__  = lambda s, *a: asyncio.sleep(0, result=False)
        cm.get = _get
        return cm
    return _factory

async def main():
    # 5xx retried then succeeds
    calls["n"] = 0
    with patch.object(base, "BACKOFF_BASE_SECONDS", 0.0), \
         patch.object(httpx, "AsyncClient", make_client([Resp(503), Resp(200, {"ok": 1})])):
        payload, err = await fetch_json("http://x")
    assert payload == {"ok": 1} and err is None
    print(f"5xx then 200: retried, attempts={calls['n']}, payload={payload}")

    # 4xx NOT retried (our bug, not theirs)
    calls["n"] = 0
    with patch.object(base, "BACKOFF_BASE_SECONDS", 0.0), \
         patch.object(httpx, "AsyncClient", make_client([Resp(422)])):
        payload, err = await fetch_json("http://x")
    assert payload is None and "422" in err
    assert calls["n"] == 1, calls["n"]
    print(f"4xx: NOT retried, attempts={calls['n']}, err={err[:30]!r}")

    # persistent 5xx exhausts bounded retries
    calls["n"] = 0
    with patch.object(base, "BACKOFF_BASE_SECONDS", 0.0), \
         patch.object(httpx, "AsyncClient", make_client([Resp(500)])):
        payload, err = await fetch_json("http://x")
    assert payload is None and calls["n"] == base.MAX_ATTEMPTS
    print(f"persistent 5xx: bounded at {calls['n']} attempts (MAX_ATTEMPTS={base.MAX_ATTEMPTS}), err={err!r}")

    # timeout is caught, returned as error, never raised
    calls["n"] = 0
    with patch.object(base, "BACKOFF_BASE_SECONDS", 0.0), \
         patch.object(httpx, "AsyncClient", make_client([httpx.TimeoutException("slow")])):
        payload, err = await fetch_json("http://x")
    assert payload is None and "Timed out" in err
    print(f"timeout: caught not raised, attempts={calls['n']}, err={err!r}")
    print()
    print("BASE / RETRY PASSED")

asyncio.run(main())