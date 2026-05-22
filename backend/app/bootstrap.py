"""Local development bootstrap helpers."""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.utils.security import hash_password


async def ensure_demo_admin(db: AsyncSession) -> None:
    """Create the README demo user when the database is empty."""
    result = await db.execute(select(User).where(User.email == "admin@medicore.ai"))
    if result.scalar_one_or_none():
        return

    db.add(
        User(
            email="admin@medicore.ai",
            hashed_password=hash_password("Admin1234!"),
            full_name="MediCore Admin",
            role="admin",
            specialty="Internal Medicine",
            institution="MediCore Local",
            is_active=True,
            is_verified=True,
        )
    )
    await db.commit()
