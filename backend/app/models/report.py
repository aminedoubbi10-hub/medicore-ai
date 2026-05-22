"""app/models/report.py"""
import uuid
from datetime import datetime
from sqlalchemy import String, Text, ForeignKey, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
from app.db_types import UUID_PK


class Report(Base):
    __tablename__ = "reports"

    id: Mapped[uuid.UUID] = mapped_column(UUID_PK, primary_key=True, default=uuid.uuid4)
    study_id: Mapped[uuid.UUID] = mapped_column(UUID_PK, ForeignKey("studies.id"), nullable=False)
    ai_result_id: Mapped[uuid.UUID | None] = mapped_column(UUID_PK, ForeignKey("ai_results.id"))
    patient_id: Mapped[uuid.UUID] = mapped_column(UUID_PK, ForeignKey("patients.id"), nullable=False)
    language: Mapped[str] = mapped_column(String(10), default="en")
    report_type: Mapped[str | None] = mapped_column(String(50))
    report_text: Mapped[str] = mapped_column(Text, nullable=False)
    report_html: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(50), default="draft")
    generated_by: Mapped[uuid.UUID | None] = mapped_column(UUID_PK, ForeignKey("users.id"))
    signed_by: Mapped[uuid.UUID | None] = mapped_column(UUID_PK, ForeignKey("users.id"))
    signed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    physician_notes: Mapped[str | None] = mapped_column(Text)
    pdf_path: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    study = relationship("Study", back_populates="reports")
