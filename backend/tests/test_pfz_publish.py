"""Atomic publish ordering (FR-E1.14) and the failure path (FR-E1.15)."""

import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from app.core.constants import GenerationStatus
from app.core.thresholds import PfzThresholds
from app.workers import pfz_batch
from app.workers.pfz_client import Prediction
from app.workers.pfz_derive import DerivationResult, ZoneCandidate
from app.workers.pfz_features import FeatureBatch, FeaturePoint

CALLS = []


class RecordingDB:
    """Records the ORDER of emitted statements, which is the whole point:
    the crash was a promote emitted before the demote."""

    def __init__(self, fail_on_commit=False):
        self.fail_on_commit = fail_on_commit
        self.added = []
        self.rolled_back = False

    async def execute(self, stmt):
        text = str(stmt).split("\n")[0]
        if "UPDATE" in text:
            CALLS.append("demote_stmt")
        elif "SELECT" in text:
            CALLS.append("select")
        return SimpleNamespace(scalar_one_or_none=lambda: None,
                               scalars=lambda: SimpleNamespace(all=lambda: []),
                               rowcount=0)

    def add(self, obj):
        self.added.append(obj)
        CALLS.append(f"add:{type(obj).__name__}")

    async def flush(self):
        CALLS.append("flush")

    async def delete(self, obj):
        CALLS.append("delete")

    async def commit(self):
        if self.fail_on_commit:
            # Fail once only. Real Postgres accepts a commit after a rollback;
            # a fake that fails forever tests a situation that cannot occur.
            self.fail_on_commit = False
            CALLS.append("commit_FAILED")
            raise RuntimeError("duplicate key value violates uq_pfz_one_published")
        CALLS.append("commit")

    async def rollback(self):
        CALLS.append("rollback")
        self.rolled_back = True


def fake_batch():
    b = FeatureBatch(points_requested=100)
    b.points = [FeaturePoint(12.0 + i * 0.05, 74.0, 28.0, 0.1, 0.1, 34.5, None)
                for i in range(90)]
    b.points_with_data = 90
    return b


def fake_derived():
    return DerivationResult(
        zones=[ZoneCandidate("POLYGON((74 12, 74.1 12, 74.1 12.1, 74 12.1, 74 12))",
                             12.05, 74.05, 150.0, "BEST", 0.9, 5)],
        qualifying_points=5, clusters_found=1)


def stubs():
    return [
        patch.object(pfz_batch.pfz_features, "build_features",
                     AsyncMock(return_value=fake_batch())),
        patch.object(pfz_batch.pfz_client, "classify",
                     AsyncMock(return_value=([Prediction(12.0, 74.0, "BEST", 0.9)], []))),
        patch.object(pfz_batch.pfz_derive, "derive_zones",
                     lambda *a, **k: fake_derived()),
    ]


async def main():
    print("--- Publish ordering (the reported crash) ---")
    CALLS.clear()
    db = RecordingDB()
    ctxs = stubs()
    for c in ctxs: c.start()
    try:
        result = await pfz_batch.run_batch(db)
    finally:
        for c in ctxs: c.stop()

    print(f"  statement order: {CALLS}")
    assert result["status"] == "published", result
    demote = CALLS.index("demote_stmt")
    commit = CALLS.index("commit")
    assert demote < commit
    # A flush must separate the demote from the promote, or the ORM is free
    # to reorder them and the unique index rejects the promote.
    assert "flush" in CALLS[demote + 1: commit], CALLS[demote:commit]
    print("  PASS  demote UPDATE emitted, then flushed, before promote+commit")

    print("\n--- Failure path with a poisoned session (FR-E1.15) ---")
    CALLS.clear()
    db = RecordingDB(fail_on_commit=True)
    ctxs = stubs()
    for c in ctxs: c.start()
    try:
        result = await pfz_batch.run_batch(db)
    finally:
        for c in ctxs: c.stop()

    print(f"  statement order: {CALLS}")
    assert result["status"] == "failed"
    assert db.rolled_back, "must roll back a poisoned session before writing"
    assert CALLS.index("rollback") < len(CALLS) - 1
    assert CALLS[-1] == "commit", "FAILED row must be committed in a fresh transaction"
    failed = [o for o in db.added if getattr(o, "status", None) == GenerationStatus.FAILED]
    assert failed, "a FAILED generation row must be recorded"
    assert "uq_pfz_one_published" in failed[-1].failure_detail
    print("  PASS  rollback -> new FAILED row -> commit; detail preserved")
    print(f"        detail: {failed[-1].failure_detail[:60]}...")

    print("\n--- A failing failure-recorder must not crash the worker ---")
    CALLS.clear()

    class AlwaysFailingDB(RecordingDB):
        async def commit(self):
            CALLS.append("commit_FAILED")
            raise RuntimeError("database is gone")

    db2 = AlwaysFailingDB()
    ctxs = stubs()
    for c in ctxs: c.start()
    try:
        result = await pfz_batch.run_batch(db2)
    finally:
        for c in ctxs: c.stop()
    assert result["status"] == "failed", result
    print("  PASS  returns failed instead of raising, even when recovery also fails")

    print("\nPFZ PUBLISH TESTS PASSED")

asyncio.run(main())