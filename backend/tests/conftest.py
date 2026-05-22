import pytest_asyncio

from app.bootstrap import ensure_demo_admin
from app.database import AsyncSessionLocal, Base, engine
from app import models as _models


@pytest_asyncio.fixture(autouse=True, scope="session")
async def initialize_test_database():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with AsyncSessionLocal() as db:
        await ensure_demo_admin(db)
    yield
