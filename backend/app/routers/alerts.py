"""app/routers/alerts.py"""
import uuid
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone

from app.database import get_db
from app.models.alert import Alert
from app.models.user import User
from app.dependencies import require_doctor

router = APIRouter(prefix="/alerts", tags=["Alerts"])


@router.get("/")
async def list_alerts(
    severity: str | None = Query(None),
    unacknowledged: bool = Query(False),
    limit: int = Query(50, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_doctor),
):
    q = select(Alert).order_by(Alert.created_at.desc()).limit(limit)
    if severity:
        q = q.where(Alert.severity == severity)
    if unacknowledged:
        q = q.where(Alert.is_acknowledged.is_(False))
    result = await db.execute(q)
    alerts = result.scalars().all()
    return [
        {
            "id": str(a.id),
            "severity": a.severity,
            "title": a.title,
            "description": a.description,
            "alert_type": a.alert_type,
            "is_acknowledged": a.is_acknowledged,
            "created_at": a.created_at.isoformat(),
        }
        for a in alerts
    ]


@router.post("/{alert_id}/acknowledge")
async def acknowledge_alert(
    alert_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_doctor),
):
    alert = await db.get(Alert, uuid.UUID(alert_id))
    if not alert:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.is_acknowledged = True
    alert.acknowledged_by = current_user.id
    alert.acknowledged_at = datetime.now(timezone.utc)
    await db.commit()
    return {"status": "acknowledged"}
