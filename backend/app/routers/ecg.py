"""app/routers/ecg.py — ECG upload and result retrieval."""
import uuid, os
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.database import get_db
from app.models.user import User
from app.models.study import Study
from app.models.ai_result import AIResult
from app.dependencies import require_doctor
from app.utils.file_utils import validate_file, generate_unique_filename, ensure_upload_dir
from app.utils.audit import log_action
from app.config import settings

router = APIRouter(prefix="/ecg", tags=["ECG Analysis"])


class ECGReviewRequest(BaseModel):
    final_impression: str
    rhythm: str | None = None
    intervals: str | None = None
    st_t_changes: str | None = None
    reviewer_notes: str | None = None
    review_status: str = "reviewed"


async def _run_ecg_analysis(study_id: str, file_path: str, patient_id: str, clinical_notes: str):
    """Background task: run ECG pipeline and save results."""
    from app.ai.ecg_pipeline import ECGPipeline
    from app.database import AsyncSessionLocal
    from app.models.alert import Alert

    pipeline = ECGPipeline()
    result = await pipeline.analyze(
        file_path=file_path,
        patient_context=f"Patient ID: {patient_id}",
        clinical_notes=clinical_notes,
    )

    async with AsyncSessionLocal() as db:
        study = await db.get(Study, uuid.UUID(study_id))
        if not study:
            return

        study.status = "completed"
        study.urgency = result.get("urgency", "routine")

        ai = AIResult(
            study_id=study.id,
            model_name="MediCore ECG Safety Gate",
            model_version="2.4.1",
            confidence_score=result.get("confidence", 0),
            urgency=result.get("urgency", "routine"),
            raw_findings=result,
            measurements=result.get("measurements", {}),
            primary_findings=result.get("primaryFindings", []),
            critical_flags=result.get("criticalFindings", []),
            differential_dx=result.get("differentialDiagnosis", []),
            recommendation=result.get("recommendation", ""),
            heatmap_path=result.get("heatmap_path"),
            processing_time_ms=result.get("processing_time_ms"),
        )
        db.add(ai)

        if (
            result.get("urgency") in {"urgent", "emergent"}
            or result.get("criticalFindings")
            or result.get("requires_physician_review")
        ):
            try:
                parsed_patient_id = uuid.UUID(patient_id)
            except ValueError:
                parsed_patient_id = None
            alert = Alert(
                patient_id=parsed_patient_id,
                study_id=study.id,
                alert_type="ecg_review_required",
                severity="critical" if result.get("urgency") == "emergent" else "warning",
                title="ECG Requires Physician Review",
                description="; ".join(result.get("primaryFindings", [])),
            )
            db.add(alert)

        await db.commit()


@router.post("/upload", status_code=202)
async def upload_ecg(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    patient_id: str = Form(...),
    clinical_notes: str = Form(""),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_doctor),
):
    await validate_file(file, allowed_extensions=["png", "jpg", "jpeg", "pdf", "edf", "xml", "csv", "txt"], max_size_mb=settings.MAX_FILE_SIZE_MB)

    upload_dir = ensure_upload_dir(f"{settings.UPLOAD_DIR}/ecg/{patient_id}")
    safe_name = generate_unique_filename(file.filename)
    file_path = str(upload_dir / safe_name)

    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)

    study = Study(
        patient_id=uuid.UUID(patient_id) if len(patient_id) == 36 else uuid.uuid4(),
        study_type="ecg",
        status="processing",
        file_path=file_path,
        file_name=file.filename,
        file_size=len(content),
        file_mime=file.content_type,
        clinical_notes=clinical_notes,
        uploaded_by=current_user.id,
    )
    db.add(study)
    await db.commit()
    await db.refresh(study)

    background_tasks.add_task(
        _run_ecg_analysis, str(study.id), file_path, patient_id, clinical_notes
    )

    return {"study_id": str(study.id), "status": "processing", "estimated_seconds": 30}


@router.get("/{study_id}/result")
async def get_ecg_result(
    study_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_doctor),
):
    study = await db.get(Study, uuid.UUID(study_id))
    if not study:
        raise HTTPException(status_code=404, detail="Study not found")

    if study.status in ("pending", "processing"):
        return {"status": study.status}

    if study.status == "failed":
        return {"status": "failed", "message": "Analysis failed. Please retry."}

    res = await db.execute(select(AIResult).where(AIResult.study_id == study.id))
    ai = res.scalar_one_or_none()

    return {
        "status": "completed",
        "study_id": str(study.id),
        "urgency": ai.urgency if ai else "routine",
        "confidence_score": float(ai.confidence_score) if ai and ai.confidence_score else None,
        "findings": ai.raw_findings if ai else {},
        "measurements": ai.measurements if ai else {},
        "primary_findings": ai.primary_findings or [],
        "critical_flags": ai.critical_flags or [],
        "differential_diagnosis": ai.differential_dx or [],
        "recommendation": ai.recommendation or "",
        "requires_physician_review": bool((ai.raw_findings or {}).get("requires_physician_review")) if ai else True,
        "review_status": _review_status(study, ai),
        "physician_review": (ai.raw_findings or {}).get("physician_review") if ai else None,
        "diagnostic_status": (ai.raw_findings or {}).get("diagnostic_status", "unknown") if ai else "unknown",
        "clinical_disclaimer": (ai.raw_findings or {}).get("clinical_disclaimer") if ai else None,
        "heatmap_url": ai.heatmap_path if ai else None,
        "disclaimer": (
            "AI decision support only. Confidence: "
            f"{float(ai.confidence_score) if ai and ai.confidence_score else 0}%. "
            "Not a definitive diagnosis. Final interpretation must be by a licensed physician."
        ),
    }


@router.post("/{study_id}/review")
async def review_ecg_result(
    study_id: str,
    body: ECGReviewRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_doctor),
):
    study = await db.get(Study, uuid.UUID(study_id))
    if not study:
        raise HTTPException(status_code=404, detail="Study not found")

    res = await db.execute(select(AIResult).where(AIResult.study_id == study.id))
    ai = res.scalar_one_or_none()
    if not ai:
        raise HTTPException(status_code=404, detail="AI result not found")

    review_payload = {
        "review_status": body.review_status,
        "reviewed_by": str(current_user.id),
        "reviewed_by_name": current_user.full_name,
        "reviewed_at": datetime.now(timezone.utc).isoformat(),
        "final_impression": body.final_impression.strip(),
        "rhythm": body.rhythm,
        "intervals": body.intervals,
        "st_t_changes": body.st_t_changes,
        "reviewer_notes": body.reviewer_notes,
        "source": "physician_entered_final_interpretation",
    }

    raw = ai.raw_findings or {}
    raw["physician_review"] = review_payload
    raw["review_status"] = body.review_status
    raw["diagnostic_status"] = "physician_reviewed_ai_assisted"
    raw["requires_physician_review"] = False
    ai.raw_findings = raw

    study.reviewed_by = current_user.id
    study.reviewed_at = datetime.now(timezone.utc)

    await log_action(
        db,
        current_user.id,
        "ecg_physician_review_completed",
        resource="ecg",
        resource_id=study_id,
        details={"review_status": body.review_status},
    )
    await db.commit()

    return {
        "status": "reviewed",
        "study_id": str(study.id),
        "review_status": body.review_status,
        "physician_review": review_payload,
    }


def _review_status(study: Study, ai: AIResult | None) -> str:
    if study.reviewed_at:
        return "reviewed"
    if ai and ai.raw_findings:
        return ai.raw_findings.get("review_status", "pending_cardiologist_review")
    return "pending_cardiologist_review"
