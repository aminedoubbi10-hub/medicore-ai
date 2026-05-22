"""app/models/patient.py"""
import uuid
from datetime import date, datetime
from sqlalchemy import String, Text, Date, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
from app.db_types import JSON_DATA, UUID_PK


class Patient(Base):
    __tablename__ = "patients"

    id: Mapped[uuid.UUID] = mapped_column(UUID_PK, primary_key=True, default=uuid.uuid4)
    patient_code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    date_of_birth: Mapped[date] = mapped_column(Date, nullable=False)
    sex: Mapped[str] = mapped_column(String(1), nullable=False)
    national_id: Mapped[str | None] = mapped_column(String(100))
    blood_type: Mapped[str | None] = mapped_column(String(5))
    phone: Mapped[str | None] = mapped_column(String(50))
    email: Mapped[str | None] = mapped_column(String(255))
    address: Mapped[str | None] = mapped_column(Text)
    emergency_contact: Mapped[str | None] = mapped_column(String(255))
    allergies: Mapped[list[str] | None] = mapped_column(JSON_DATA)
    chronic_diseases: Mapped[list[str] | None] = mapped_column(JSON_DATA)
    current_medications: Mapped[list[str] | None] = mapped_column(JSON_DATA)
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID_PK, ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    studies = relationship("Study", back_populates="patient", cascade="all, delete-orphan")
    alerts = relationship("Alert", back_populates="patient")

    def __repr__(self) -> str:
        return f"<Patient {self.patient_code} {self.full_name}>"
