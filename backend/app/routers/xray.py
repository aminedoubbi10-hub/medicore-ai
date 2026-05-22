"""app/routers/xray.py"""
import uuid
from fastapi import APIRouter, Depends, UploadFile, File, Form, BackgroundTasks, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.user import User
from app.models.study import Study
from app.models.ai_result import AIResult
from app.dependencies import require_doctor
from app.utils.file_utils import validate_file, generate_unique_filename, ensure_upload_dir
from app.config import settings

router = APIRouter(prefix="/xray", tags=["Chest X-Ray"])


async def _run_xray(study_id: str, file_path: str, patient_context: str):
    from app.ai.xray_pipeline import XRayPipeline
    from app.database import AsyncSessionLocal
    from app.models.ai_result import AIResult
    from app.models.alert import Alert

    pipeline = XRayPipeline()
    result = await pipeline.analyze(file_path=file_path, patient_context=patient_context)

    async with AsyncSessionLocal() as db:
        study = await db.get(Study, uuid.UUID(study_id))
        if not study:
            return
        study.status = "completed"
        study.urgency = result.get("urgency", "routine")
        ai = AIResult(
            study_id=study.id,
            model_name="MediCore Radiology Safety Gate",
            model_version="2.4.1",
            confidence_score=result.get("confidence", 0),
            urgency=result.get("urgency", "routine"),
            raw_findings=result,
            measurements=result.get("image_quality", {}),
            primary_findings=[f.get("finding", "") for f in result.get("findings", [])],
            critical_flags=result.get("emergency_flags", []) + result.get("criticalFindings", []),
            differential_dx=result.get("differentialDx", []),
            recommendation=result.get("recommendation", ""),
            heatmap_path=result.get("heatmap_path"),
        )
        db.add(ai)
        if result.get("requires_physician_review"):
            db.add(
                Alert(
                    patient_id=None,
                    study_id=study.id,
                    alert_type="radiology_review_required",
                    severity="critical" if result.get("urgency") == "emergent" else "warning",
                    title="Radiology Requires Physician Review",
                    description=result.get("impression", "Radiologist confirmation required."),
                )
            )
        await db.commit()


@router.post("/upload", status_code=202)
async def upload_xray(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    patient_id: str = Form(...),
    clinical_notes: str = Form(""),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_doctor),
):
    await validate_file(file, allowed_extensions=["png", "jpg", "jpeg", "dcm", "pdf"], max_size_mb=settings.MAX_FILE_SIZE_MB)
    upload_dir = ensure_upload_dir(f"{settings.UPLOAD_DIR}/xray/{patient_id}")
    safe_name = generate_unique_filename(file.filename)
    file_path = str(upload_dir / safe_name)
    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)

    study = Study(
        patient_id=uuid.uuid4(),
        study_type="xray",
        status="processing",
        file_path=file_path,
        file_name=file.filename,
        file_size=len(content),
        clinical_notes=clinical_notes,
        uploaded_by=current_user.id,
    )
    db.add(study)
    await db.commit()
    await db.refresh(study)

    background_tasks.add_task(_run_xray, str(study.id), file_path, clinical_notes)
    return {"study_id": str(study.id), "status": "processing"}


@router.get("/{study_id}/result")
async def get_xray_result(
    study_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_doctor),
):
    study = await db.get(Study, uuid.UUID(study_id))
    if not study:
        raise HTTPException(status_code=404, detail="Study not found")

    if study.status in ("pending", "processing"):
        return {"status": study.status}

    res = await db.execute(select(AIResult).where(AIResult.study_id == study.id))
    ai = res.scalar_one_or_none()
    if not ai:
        return {"status": "processing"}

    findings = ai.raw_findings or {}
    return {
        "status": "completed",
        "study_id": str(study.id),
        "urgency": ai.urgency or "routine",
        "confidence_score": float(ai.confidence_score) if ai.confidence_score else 0,
        "findings": findings,
        "primary_findings": ai.primary_findings or [],
        "critical_flags": ai.critical_flags or [],
        "differential_diagnosis": ai.differential_dx or [],
        "recommendation": ai.recommendation or "",
        "requires_physician_review": bool(findings.get("requires_physician_review", True)),
        "review_status": findings.get("review_status", "pending_radiologist_review"),
        "diagnostic_status": findings.get("diagnostic_status", "unknown"),
        "clinical_disclaimer": findings.get("clinical_disclaimer"),
        "disclaimer": (
            "AI-assisted radiology screening only. Not a definitive diagnosis. "
            "Final interpretation must be made by a qualified radiologist/physician."
        ),
    }
