"""app/utils/audit.py — HIPAA-compliant audit logging."""
import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import insert
from app.models.audit import AuditLog


async def log_action(
    db: AsyncSession,
    user_id: uuid.UUID | None,
    action: str,
    resource: str | None = None,
    resource_id: uuid.UUID | None = None,
    ip: str | None = None,
    user_agent: str | None = None,
    details: dict | None = None,
) -> None:
    """Write an audit log entry. Never raises — audit failures are silent."""
    try:
        entry = AuditLog(
            user_id=user_id,
            action=action,
            resource=resource,
            resource_id=resource_id,
            ip_address=ip,
            user_agent=user_agent,
            details=details or {},
        )
        db.add(entry)
        # Don't commit here — caller's session handles it
    except Exception:
        pass  # Audit failures must never break the main request
