"""app/models/ai_result.py"""
import uuid
from datetime import datetime
from decimal import Decimal
from sqlalchemy import String, Text, Integer, Numeric, ForeignKey, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
from app.db_types import JSON_DATA, UUID_PK


class AIResult(Base):
    __tablename__ = "ai_results"

    id: Mapped[uuid.UUID] = mapped_column(UUID_PK, primary_key=True, default=uuid.uuid4)
    study_id: Mapped[uuid.UUID] = mapped_column(UUID_PK, ForeignKey("studies.id", ondelete="CASCADE"), nullable=False, index=True)
    model_name: Mapped[str] = mapped_column(String(100), nullable=False)
    model_version: Mapped[str | None] = mapped_column(String(50))
    confidence_score: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    urgency: Mapped[str | None] = mapped_column(String(20))
    raw_findings: Mapped[dict | None] = mapped_column(JSON_DATA)
    measurements: Mapped[dict | None] = mapped_column(JSON_DATA)
    primary_findings: Mapped[list[str] | None] = mapped_column(JSON_DATA)
    critical_flags: Mapped[list[str] | None] = mapped_column(JSON_DATA)
    differential_dx: Mapped[list[str] | None] = mapped_column(JSON_DATA)
    recommendation: Mapped[str | None] = mapped_column(Text)
    heatmap_path: Mapped[str | None] = mapped_column(Text)
    processing_time_ms: Mapped[int | None] = mapped_column(Integer)
    error_message: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    study = relationship("Study", back_populates="ai_results")
