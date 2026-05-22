"""app/models/study.py"""
import uuid
from datetime import datetime
from sqlalchemy import String, Text, Integer, BigInteger, ForeignKey, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
from app.db_types import UUID_PK


class Study(Base):
    __tablename__ = "studies"

    id: Mapped[uuid.UUID] = mapped_column(UUID_PK, primary_key=True, default=uuid.uuid4)
    patient_id: Mapped[uuid.UUID] = mapped_column(UUID_PK, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True)
    study_type: Mapped[str] = mapped_column(String(50), nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="pending")
    urgency: Mapped[str] = mapped_column(String(20), default="routine")
    file_path: Mapped[str | None] = mapped_column(Text)
    file_name: Mapped[str | None] = mapped_column(Text)
    file_size: Mapped[int | None] = mapped_column(BigInteger)
    file_mime: Mapped[str | None] = mapped_column(String(100))
    clinical_notes: Mapped[str | None] = mapped_column(Text)
    ordering_physician: Mapped[str | None] = mapped_column(String(255))
    uploaded_by: Mapped[uuid.UUID | None] = mapped_column(UUID_PK, ForeignKey("users.id"))
    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(UUID_PK, ForeignKey("users.id"))
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    patient = relationship("Patient", back_populates="studies")
    ai_results = relationship("AIResult", back_populates="study", cascade="all, delete-orphan")
    reports = relationship("Report", back_populates="study")
    alerts = relationship("Alert", back_populates="study")
