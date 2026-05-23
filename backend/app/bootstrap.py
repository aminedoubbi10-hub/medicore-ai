"""Local development bootstrap helpers."""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.utils.security import hash_password
from app.config import settings


async def ensure_initial_admin(db: AsyncSession) -> None:
    """Create an initial administrator if one has not been provisioned yet."""
    result = await db.execute(select(User).where(User.email == settings.INITIAL_ADMIN_EMAIL.lower()))
    if result.scalar_one_or_none():
        return

    db.add(
        User(
            email=settings.INITIAL_ADMIN_EMAIL.lower(),
            hashed_password=hash_password(settings.INITIAL_ADMIN_PASSWORD),
            full_name=settings.INITIAL_ADMIN_FULL_NAME,
            role="admin",
            specialty="Internal Medicine",
            institution="MediCore",
            is_active=True,
            is_verified=True,
        )
    )
    await db.commit()
