"""Create the PostGIS extension and all tables.

Development utility, standing in for Alembic through Iteration 1. Adding
migrations later means one `alembic stamp head` against the existing schema.

    python -m app.db.init_db          # create
    python -m app.db.init_db --drop   # drop and recreate (destructive)
"""

import asyncio
import sys

from sqlalchemy import text

from app.db import models  # noqa: F401  — registers mappers on Base.metadata
from app.db.session import engine
from app.db.models import Base


async def init_db(drop: bool = False) -> None:
    async with engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis;"))

        if drop:
            await conn.run_sync(Base.metadata.drop_all)
            # Native enums are not dropped with their tables.
            for enum_name in (
                "resolution_route", "turn_status", "invocation_status",
                "cap_severity", "cap_urgency", "cap_certainty",
                "pfz_generation_status", "pfz_empty_reason", "pfz_zone_class",
            ):
                await conn.execute(text(f"DROP TYPE IF EXISTS {enum_name} CASCADE;"))
            print("dropped existing schema")

        await conn.run_sync(Base.metadata.create_all)

    print(f"created {len(Base.metadata.tables)} tables:")
    for name in sorted(Base.metadata.tables):
        print(f"  - {name}")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(init_db(drop="--drop" in sys.argv))