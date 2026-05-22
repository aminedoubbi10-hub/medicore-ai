"""app/routers/labs.py"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from app.database import get_db
from app.models.user import User
from app.utils.audit import log_action
from app.dependencies import require_doctor
from app.ai.lab_interpreter import interpret_labs

router = APIRouter(prefix="/labs", tags=["Laboratory"])


class LabSubmission(BaseModel):
    patient_id: str
    values: dict[str, float | None]
    patient_context: str = ""


@router.post("/interpret")
async def interpret_lab_results(
    body: LabSubmission,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_doctor),
):
    result = await interpret_labs(
        {k: v for k, v in body.values.items() if v is not None},
        patient_context=body.patient_context,
    )
    if result.get("critical_values") or result.get("invalid_values"):
        await log_action(
            db,
            current_user.id,
            "lab_safety_review_required",
            resource="labs",
            details={
                "patient_id": body.patient_id,
                "critical_values": result.get("critical_values", []),
                "invalid_values": result.get("invalid_values", []),
                "urgency": result.get("urgency"),
            },
        )
    return result
