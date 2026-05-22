"""app/routers/reports.py"""
import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.database import get_db
from app.models.user import User
from app.models.report import Report
from app.models.study import Study
from app.models.ai_result import AIResult
from app.dependencies import require_doctor
from app.ai.claude_client import generate_report

router = APIRouter(prefix="/reports", tags=["Reports"])


class ReportRequest(BaseModel):
    study_id: str
    language: str = "en"
    clinical_notes: str = ""


@router.post("/generate", status_code=201)
async def generate_report_endpoint(
    body: ReportRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_doctor),
):
    study = await db.get(Study, uuid.UUID(body.study_id))
    if not study:
        raise HTTPException(status_code=404, detail="Study not found")

    res = await db.execute(select(AIResult).where(AIResult.study_id == study.id))
    ai = res.scalar_one_or_none()

    report_text = await generate_report(
        study_type=study.study_type,
        ai_findings=ai.raw_findings if ai else {},
        language=body.language,
        clinical_notes=body.clinical_notes,
    )

    report = Report(
        study_id=study.id,
        ai_result_id=ai.id if ai else None,
        patient_id=study.patient_id,
        language=body.language,
        report_type=study.study_type,
        report_text=report_text,
        status="draft",
        generated_by=current_user.id,
    )
    db.add(report)
    await db.commit()
    await db.refresh(report)

    return {
        "report_id": str(report.id),
        "status": "draft",
        "report_text": report_text,
        "language": body.language,
        "disclaimer": "AI-generated draft. Must be reviewed and signed by a licensed physician.",
    }


@router.get("/{report_id}")
async def get_report(
    report_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_doctor),
):
    report = await db.get(Report, uuid.UUID(report_id))
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return report
