"""Conservative chest X-ray decision-support pipeline.

This module does not diagnose radiology findings from heuristics. Without a
validated radiology model/service it returns an "unable to interpret safely"
state and requires radiologist review.
"""
import json
import time

import anthropic
import numpy as np

from app.config import settings
from app.ai.safety import CLINICAL_DISCLAIMER, pipeline_trace, review_required
from app.ai.radiology_model import run_radiology_model

EMERGENCY_REVIEW_TERMS = {"pneumothorax", "tension pneumothorax"}


class XRayPipeline:
    def __init__(self):
        self.client = (
            anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
            if settings.ANTHROPIC_API_KEY
            else None
        )

    async def analyze(self, file_path: str, patient_context: str = "") -> dict:
        start = time.time()
        try:
            image = self._load(file_path)
            quality = self._quality(image)
            if quality["diagnostic_quality"] == "poor":
                report = self._unable_to_interpret(
                    quality,
                    "Image quality is insufficient for safe AI-assisted radiology interpretation.",
                )
            else:
                model_result = await run_radiology_model(file_path)
                if not model_result.get("available"):
                    report = self._unable_to_interpret(quality, model_result.get("reason", "Radiology model unavailable."))
                else:
                    report = await self._report(quality, model_result, patient_context)

            report["success"] = True
            report["processing_time_ms"] = int((time.time() - start) * 1000)
            return report
        except Exception as exc:
            report = self._unable_to_interpret({}, f"Radiology pipeline failed: {exc}")
            report["success"] = True
            report["processing_time_ms"] = int((time.time() - start) * 1000)
            return report

    def _load(self, path: str):
        try:
            import cv2

            if path.lower().endswith(".dcm"):
                import pydicom

                dcm = pydicom.dcmread(path)
                arr = dcm.pixel_array.astype(np.float32)
                arr = ((arr - arr.min()) / (arr.max() - arr.min() + 1e-8) * 255).astype(np.uint8)
                return cv2.cvtColor(arr, cv2.COLOR_GRAY2BGR)
            return cv2.imread(path)
        except Exception:
            return None

    def _quality(self, image) -> dict:
        if image is None:
            return {
                "diagnostic_quality": "poor",
                "quality_score": 0,
                "reason": "Image could not be read.",
            }
        gray = image.mean(axis=2) if image.ndim == 3 else image
        contrast = float(np.std(gray) / 255)
        brightness = float(np.mean(gray) / 255)
        quality_score = max(0.0, min(1.0, contrast * 4))
        diagnostic_quality = "poor" if quality_score < 0.15 else "limited" if quality_score < 0.35 else "reviewable"
        return {
            "diagnostic_quality": diagnostic_quality,
            "quality_score": round(quality_score, 3),
            "brightness": round(brightness, 3),
            "contrast": round(contrast, 3),
            "reason": "Quality heuristic only; not a diagnostic image validation.",
        }

    async def _report(self, quality: dict, model_result: dict, patient_context: str) -> dict:
        if self.client is None:
            return self._model_summary_without_llm(quality, model_result)

        prompt = f"""Create a conservative AI-assisted chest X-ray review note.

Image quality metadata:
{json.dumps(quality, indent=2)}

Specialized model output:
{json.dumps(model_result, indent=2)}

Patient context: {patient_context or "Not provided"}

Rules:
- Do not overcall pathology.
- If findings are uncertain, say unable to determine.
- Require radiologist confirmation.
- Do not claim a definitive diagnosis.

Return JSON with technique, findings, impression, differentialDx, confidence,
urgency, recommendation, criticalFindings, diagnostic_status, limitations."""

        try:
            response = self.client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=1200,
                messages=[{"role": "user", "content": prompt}],
            )
            raw = response.content[0].text.strip().replace("```json", "").replace("```", "").strip()
            return self._apply_safety_defaults(json.loads(raw), quality, model_result)
        except Exception:
            return self._model_summary_without_llm(quality, model_result)

    def _model_summary_without_llm(self, quality: dict, model_result: dict) -> dict:
        validation = model_result.get("validation", {})
        urgent_flags = validation.get("urgent_flags", [])
        review_flags = validation.get("review_flags", [])
        return self._apply_safety_defaults(
            {
                "technique": "Chest radiograph image submitted",
                "findings": [
                    {
                        "region": "Overall",
                        "finding": f"Model review flag: {finding}",
                        "severity": "indeterminate",
                    }
                    for finding in urgent_flags + review_flags
                ] or [
                    {
                        "region": "Overall",
                        "finding": "No model threshold crossed; radiologist review still required.",
                        "severity": "indeterminate",
                    }
                ],
                "impression": "Specialized model probabilities require radiologist confirmation.",
                "differentialDx": [],
                "confidence": 50 if urgent_flags or review_flags else 30,
                "urgency": "emergent" if urgent_flags else "urgent" if review_flags else "routine",
                "recommendation": "Radiologist confirmation required before clinical use.",
                "criticalFindings": urgent_flags,
                "diagnostic_status": "model_screen_requires_review",
                "limitations": "External model screen is not a definitive radiology interpretation.",
            },
            quality,
            model_result,
        )

    def _apply_safety_defaults(self, result: dict, quality: dict, model_result: dict | None = None) -> dict:
        result.setdefault("ai_assisted", True)
        result.setdefault("diagnostic_status", "ai_assisted_requires_review")
        result.setdefault("requires_physician_review", True)
        result.setdefault("review_recommended_specialty", "radiology")
        result.setdefault("review_status", "pending_radiologist_review")
        result.setdefault("image_quality", quality)
        result.setdefault("model_result", model_result or {})
        result.setdefault("confidence", 0)
        result.setdefault("criticalFindings", [])
        result.setdefault("emergency_flags", [])
        result.setdefault("clinical_disclaimer", self._clinical_disclaimer())
        result.setdefault(
            "pipeline_trace",
            pipeline_trace(
                modality="radiology",
                deterministic_preprocessing="completed",
                specialized_model="external_validated_service_attempted",
                validation_layer="applied",
                llm_role="formatting_and_explanation_only",
                final_gate="requires_radiologist_review",
            ),
        )
        if result.get("confidence", 0) < 70:
            result["diagnostic_status"] = "uncertain_requires_review"
        for finding in result.get("criticalFindings", []):
            if any(term in finding.lower() for term in EMERGENCY_REVIEW_TERMS):
                result["emergency_flags"].append(finding)
                result["urgency"] = "emergent"
        return result

    def _unable_to_interpret(self, quality: dict, reason: str) -> dict:
        return {
            "ai_assisted": True,
            "diagnostic_status": "unable_to_interpret_safely",
            **review_required(reason, "radiologist"),
            "technique": "Chest radiograph image submitted",
            "findings": [
                {
                    "region": "Overall",
                    "finding": "Unable to provide safe AI-assisted radiology interpretation.",
                    "severity": "indeterminate",
                }
            ],
            "impression": "Insufficient validated data/service for radiology interpretation.",
            "differentialDx": [],
            "confidence": 0,
            "urgency": "urgent",
            "recommendation": (
                "Do not use this output for diagnosis. Obtain qualified radiologist review."
            ),
            "criticalFindings": [],
            "emergency_flags": [],
            "image_quality": quality,
            "heatmap_path": "",
            "pathology_probabilities": {},
            "limitations": reason,
            "clinical_disclaimer": self._clinical_disclaimer(),
            "pipeline_trace": pipeline_trace(
                modality="radiology",
                deterministic_preprocessing="completed",
                specialized_model="not_configured_or_unavailable",
                validation_layer="blocked_diagnostic_output",
                llm_role="not_used_for_raw_diagnosis",
                final_gate="unable_to_interpret_safely",
            ),
        }

    def _clinical_disclaimer(self) -> str:
        return CLINICAL_DISCLAIMER
