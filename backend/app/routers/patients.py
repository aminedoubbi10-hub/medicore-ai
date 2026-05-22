"""app/routers/patients.py"""
import uuid
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from pydantic import BaseModel
from datetime import date

from app.database import get_db
from app.models.patient import Patient
from app.models.user import User
from app.dependencies import require_doctor

router = APIRouter(prefix="/patients", tags=["Patients"])


class PatientCreate(BaseModel):
    full_name: str
    date_of_birth: date
    sex: str
    patient_code: str
    blood_type: str | None = None
    phone: str | None = None
    email: str | None = None
    allergies: list[str] = []
    chronic_diseases: list[str] = []
    current_medications: list[str] = []


@router.get("/")
async def list_patients(
    search: str | None = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_doctor),
):
    offset = (page - 1) * limit
    q = select(Patient).order_by(Patient.created_at.desc()).offset(offset).limit(limit)
    if search:
        q = q.where(
            or_(
                Patient.full_name.ilike(f"%{search}%"),
                Patient.patient_code.ilike(f"%{search}%"),
            )
        )
    result = await db.execute(q)
    patients = result.scalars().all()
    return [
        {
            "id": str(p.id),
            "patient_code": p.patient_code,
            "full_name": p.full_name,
            "date_of_birth": p.date_of_birth.isoformat(),
            "sex": p.sex,
            "blood_type": p.blood_type,
            "chronic_diseases": p.chronic_diseases or [],
        }
        for p in patients
    ]


@router.get("/{patient_id}")
async def get_patient(
    patient_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_doctor),
):
    patient = await db.get(Patient, uuid.UUID(patient_id))
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return patient


@router.post("/", status_code=201)
async def create_patient(
    body: PatientCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_doctor),
):
    patient = Patient(**body.model_dump(), created_by=current_user.id)
    db.add(patient)
    await db.commit()
    await db.refresh(patient)
    return {"id": str(patient.id), "patient_code": patient.patient_code}
