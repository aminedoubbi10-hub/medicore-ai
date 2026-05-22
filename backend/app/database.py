"""
app/database.py
Async SQLAlchemy engine and session factory.
"""
from sqlalchemy.ext.asyncio import (
    create_async_engine,
    AsyncSession,
    async_sessionmaker,
)
from sqlalchemy.orm import DeclarativeBase
from pathlib import Path
from app.config import settings


def _async_database_url(url: str) -> str:
    if url.startswith(("sqlite:///./", "sqlite+aiosqlite:///./")):
        prefix, relative_path = url.split("///./", 1)
        db_path = Path(__file__).resolve().parents[1] / relative_path
        return f"{prefix}///{db_path.as_posix()}"
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+asyncpg://", 1)
    if url.startswith("sqlite:///"):
        return url.replace("sqlite:///", "sqlite+aiosqlite:///", 1)
    return url


def _engine_kwargs(url: str) -> dict:
    kwargs = {"echo": settings.DEBUG, "pool_pre_ping": True}
    if not url.startswith("sqlite"):
        kwargs.update(
            pool_size=settings.DATABASE_POOL_SIZE,
            max_overflow=settings.DATABASE_MAX_OVERFLOW,
            pool_recycle=3600,
        )
    return kwargs


database_url = _async_database_url(settings.DATABASE_URL)
engine = create_async_engine(database_url, **_engine_kwargs(database_url))

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:
    """FastAPI dependency — yields a DB session, handles commit/rollback."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
