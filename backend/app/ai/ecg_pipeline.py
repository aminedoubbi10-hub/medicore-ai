"""Conservative ECG analysis pipeline.

This module deliberately avoids diagnostic ECG interpretation unless a validated
external interpretation service is configured and returns structured output.
Image-derived values are treated as non-diagnostic metadata only.
"""
import json
import time

import anthropic
import numpy as np

from app.config import settings
from app.ai.safety import CLINICAL_DISCLAIMER, pipeline_trace, review_required
from app.ai.ecg_signal import measure_ecg_signal, parse_waveform_file
from app.ai.ecg_image import load_ecg_document, screen_ecg_image
from app.ai.ecg_rules import build_ecg_screen_interpretation

SYSTEM_PROMPT = """You are an AI cardiology decision support assistant.
Analyze ECG data and produce structured clinical reports.
Rules:
- Do not fabricate findings or measurements.
- If data quality is insufficient, return unable_to_interpret_safely.
- Always state that output is AI-assisted and requires physician validation.
- Flag uncertainty and recommend cardiologist review.
- Never claim a definitive diagnosis.
Return only valid JSON."""


class ECGPipeline:
    def __init__(self):
        self.client = (
            anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
            if settings.ANTHROPIC_API_KEY
            else None
        )

    async def analyze(self, file_path: str, patient_context: str = "", clinical_notes: str = "") -> dict:
        start = time.time()
        try:
            features = self._extract_features(file_path)
            if (
                features.get("source") == "ecg_image_or_pdf_screen"
                and features["signal_quality"] >= 0.08
            ):
                result = self._image_screen_requires_review(features)
            elif features["signal_quality"] < 0.35:
                result = self._unable_to_interpret(
                    features,
                    "ECG image quality is too low for safe automated interpretation.",
                )
            else:
                result = await self._interpret(features, patient_context, clinical_notes)
            result["success"] = True
            result["processing_time_ms"] = int((time.time() - start) * 1000)
            return result
        except Exception as exc:
            result = self._unable_to_interpret({}, f"ECG pipeline failed: {exc}")
            result["success"] = True
            result["processing_time_ms"] = int((time.time() - start) * 1000)
            return result

    def _extract_features(self, file_path: str) -> dict:
        """Extract deterministic waveform measurements or non-diagnostic image metadata."""
        parsed = parse_waveform_file(file_path)
        if parsed:
            return measure_ecg_signal(parsed)

        try:
            img = load_ecg_document(file_path)
            if img is None:
                return {
                    "estimated_heart_rate_bpm": None,
                    "signal_quality": 0.0,
                    "source": "unreadable_or_missing_image_or_pdf",
                    "measurement_status": "unavailable",
                }

            image_screen = screen_ecg_image(img)
            image_quality = image_screen.get("image_quality", {})
            density = float(np.mean(img) / 255)
            variance = float(np.var(img) / (255**2))
            signal_quality = max(
                float(image_quality.get("quality_score", 0)),
                float(image_screen.get("digitization_quality", 0) or 0),
                float(image_screen.get("lead_segmentation_quality", 0) or 0),
            )
            estimated_hr = image_screen.get("estimated_heart_rate_bpm")
        except Exception:
            return {
                "estimated_heart_rate_bpm": None,
                "signal_quality": 0.0,
                "source": "feature_extraction_failed",
            }

        return {
            "estimated_heart_rate_bpm": estimated_hr,
            "signal_quality": signal_quality,
            "source": "ecg_image_or_pdf_screen",
            "measurement_status": "image_metadata_only",
            "image_density": round(density, 3),
            "image_variance": round(variance, 4),
            "image_waveform_screen": image_screen,
            "image_quality": image_quality,
            "preprocessing": image_screen.get("preprocessing", {}),
            "rr_regular": image_screen.get("rr_regular"),
            "rr_variability_ratio": image_screen.get("rr_variability_ratio"),
            "qrs_duration_ms_estimate": image_screen.get("qrs_duration_ms_estimate"),
            "st_screen": image_screen.get("st_screen"),
            "digitization_quality": image_screen.get("digitization_quality"),
        }

    def _image_screen_requires_review(self, features: dict) -> dict:
        estimated_hr = features.get("estimated_heart_rate_bpm")
        qrs_ms = features.get("qrs_duration_ms_estimate")
        rr_regular = features.get("rr_regular")
        st_screen = features.get("st_screen") or {}
        representative_lead = features.get("image_waveform_screen", {}).get("representative_lead")
        digitization_quality = features.get("digitization_quality")
        calibration = features.get("image_waveform_screen", {}).get("calibration", {})
        lead_segmentation_quality = features.get("image_waveform_screen", {}).get("lead_segmentation_quality")
        aggregate = features.get("image_waveform_screen", {}).get("aggregate_measurements", {})
        layout_detection = features.get("image_waveform_screen", {}).get("layout_detection", {})
        image_quality = features.get("image_quality", {})
        quality_warnings = image_quality.get("warnings", [])
        preprocessing = features.get("preprocessing", {})
        rate_flag = "unable_to_assess_rate"
        red_flags = []
        if estimated_hr:
            if estimated_hr > 120:
                rate_flag = "tachycardic_rate_screen"
                red_flags.append("high_rate_screen_requires_review")
            elif estimated_hr < 50:
                rate_flag = "bradycardic_rate_screen"
                red_flags.append("low_rate_screen_requires_review")
            else:
                rate_flag = "rate_within_screening_range"
        rule_result = build_ecg_screen_interpretation(features)
        red_flags = list(dict.fromkeys(red_flags + rule_result.get("redFlags", [])))

        return {
            "ai_assisted": True,
            "diagnostic_status": "preliminary_image_screen_requires_review",
            **review_required("ECG image/PDF screening is not a validated diagnostic interpretation.", "cardiologist"),
            "safety_flags": ["ecg_image_not_validated_for_diagnosis"],
            "rhythm": rule_result.get("rhythm", "Unable to determine rhythm safely from ECG image/PDF"),
            "heartRate": rule_result.get("heartRate") or "Unable to determine safely",
            "prInterval": "Unable to measure safely from image",
            "qrsDuration": rule_result.get("qrsDuration") or "Unable to measure safely from image",
            "qtInterval": "Unable to measure safely from image",
            "stChanges": rule_result.get("stChanges") or "Unable to assess ST changes safely from image",
            "axis": rule_result.get("axis") or "Unable to determine safely from image",
            "measurements": {
                **features,
                "rate_screen": rate_flag,
                "rule_engine": rule_result.get("rule_engine", {}),
                "measurement_warning": "Image/PDF-derived screening only; waveform digitization/lead calibration not validated.",
            },
            "primaryFindings": rule_result.get("primaryFindings", []) + [
                (
                    "Preliminary interpretation: the uploaded ECG image/PDF is readable enough "
                    "for basic automated screening."
                ),
                (
                    f"Estimated heart rate is approximately {estimated_hr} bpm from extracted ECG trace"
                    + (
                        f" using {aggregate.get('heart_rate_source', 'image trace')}."
                        if aggregate
                        else (f" in lead {representative_lead}." if representative_lead else ".")
                    )
                    if estimated_hr
                    else "Heart rate could not be estimated reliably from this image/PDF."
                ),
                (
                    f"RR regularity screen: {'regular' if rr_regular else 'irregular or indeterminate'}."
                    if rr_regular is not None
                    else "RR regularity could not be estimated reliably."
                ),
                (
                    f"Estimated QRS duration is approximately {qrs_ms} ms from image digitization."
                    if qrs_ms
                    else "QRS duration could not be estimated reliably from this image/PDF."
                ),
                (
                    "Possible ST elevation screen flag detected in contiguous lead territory - urgent physician review is required."
                    if st_screen.get("possible_st_elevation")
                    else "No possible ST elevation screen flag detected by the unvalidated image heuristic."
                    if st_screen
                    else "ST screening could not be performed reliably."
                ),
                (
                    "PR interval, QT/QTc, and axis cannot be confirmed safely from this ECG image/PDF."
                ),
                f"ECG grid calibration: {calibration.get('status', 'not detected')}.",
                (
                    f"Usable digitized leads: {aggregate.get('usable_lead_count')}; "
                    f"measurement consistency: {aggregate.get('measurement_consistency')}."
                    if aggregate
                    else "Aggregate lead measurements were unavailable."
                ),
                (
                    f"Detected ECG layout: {layout_detection.get('selected_layout')} "
                    f"(confidence {layout_detection.get('layout_confidence')})."
                    if layout_detection
                    else "ECG layout detection was unavailable."
                ),
                (
                    f"Preprocessing applied: contrast normalization, denoising, deskew angle "
                    f"{preprocessing.get('deskew_angle_degrees', 0)} degrees."
                    if preprocessing
                    else "Preprocessing metadata unavailable."
                ),
            ],
            "criticalFindings": rule_result.get("criticalFindings", []),
            "differentialDiagnosis": [],
            "confidence": rule_result.get("confidence", 0),
            "urgency": rule_result.get("urgency", "urgent" if red_flags else "routine"),
            "recommendation": (
                "Preliminary AI-assisted screening only. Please check this result with a physician/cardiologist. "
                "Upload native ECG waveform data when possible for more reliable measurement."
            ),
            "redFlags": red_flags,
            "limitations": (
                "ECG image digitization, calibration, lead segmentation, PR/QRS/QT measurement, "
                "and STEMI assessment are not validated in this MVP. PDF/image uploads can vary widely. "
                + rule_result.get("limitations", "")
            ),
            "clinical_disclaimer": CLINICAL_DISCLAIMER,
            "pipeline_trace": pipeline_trace(
                modality="ecg",
                deterministic_preprocessing="image_quality_and_density_screen_completed",
                specialized_model="not_configured_or_unavailable",
                validation_layer="blocked_definitive_ecg_diagnosis",
                llm_role="not_used_for_raw_diagnosis",
                final_gate="preliminary_image_screen_requires_cardiologist_review",
            ),
        }

    async def _interpret(self, features: dict, patient_context: str, clinical_notes: str) -> dict:
        if self.client is None:
            return self._unable_to_interpret(
                features,
                "No validated ECG interpretation service is configured.",
            )

        prompt = f"""Interpret the following ECG metadata conservatively.

Metadata:
{json.dumps(features, indent=2)}

Patient context: {patient_context or "Not provided"}
Clinical notes: {clinical_notes or "Not provided"}

Return JSON with:
diagnostic_status, rhythm, heartRate, prInterval, qrsDuration, qtInterval,
stChanges, axis, primaryFindings, criticalFindings, differentialDiagnosis,
confidence, urgency, recommendation, redFlags, limitations,
requires_physician_review, review_status, clinical_disclaimer.

If rhythm/interval/ST findings cannot be determined from source data, say so."""

        try:
            response = self.client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=1500,
                system=SYSTEM_PROMPT,
                messages=[{"role": "user", "content": prompt}],
            )
            raw = response.content[0].text.strip().replace("```json", "").replace("```", "").strip()
            result = json.loads(raw)
            return self._apply_safety_defaults(result, features)
        except Exception:
            return self._unable_to_interpret(
                features,
                "External ECG interpretation service failed.",
            )

    def _apply_safety_defaults(self, result: dict, features: dict) -> dict:
        result.setdefault("ai_assisted", True)
        result.setdefault("diagnostic_status", "ai_assisted_requires_review")
        result.setdefault("requires_physician_review", True)
        result.setdefault("review_recommended_specialty", "cardiology")
        result.setdefault("review_status", "pending_cardiologist_review")
        result.setdefault("safety_flags", [])
        result.setdefault("measurements", features)
        result.setdefault("confidence", 0)
        result.setdefault("clinical_disclaimer", CLINICAL_DISCLAIMER)
        result.setdefault(
            "pipeline_trace",
            pipeline_trace(
                modality="ecg",
                deterministic_preprocessing="completed",
                specialized_model="external_validated_service_attempted",
                validation_layer="applied",
                llm_role="formatting_and_explanation_only",
                final_gate="requires_cardiologist_review",
            ),
        )
        if result.get("confidence", 0) < 70:
            result["diagnostic_status"] = "uncertain_requires_review"
            result["safety_flags"].append("low_confidence")
        return result

    def _unable_to_interpret(self, features: dict, reason: str) -> dict:
        estimated_hr = features.get("estimated_heart_rate_bpm")
        st_screen = features.get("st_screen", {})
        critical = []
        red_flags = []
        urgency = "urgent"
        if st_screen.get("status") == "screen_positive_requires_immediate_physician_review":
            critical.append("Possible ST-elevation screen positive on waveform data; immediate physician review required.")
            red_flags.append("possible_st_elevation_screen_positive")
            urgency = "emergent"
        return {
            "ai_assisted": True,
            "diagnostic_status": "unable_to_interpret_safely",
            **review_required(reason, "cardiologist"),
            "safety_flags": ["insufficient_validated_ecg_interpretation"],
            "rhythm": "Unable to determine safely",
            "heartRate": f"{estimated_hr} bpm (non-diagnostic estimate)" if estimated_hr else "Unable to determine safely",
            "prInterval": "Unable to determine safely",
            "qrsDuration": "Unable to determine safely",
            "qtInterval": "Unable to determine safely",
            "stChanges": "Unable to assess safely",
            "axis": "Unable to determine safely",
            "measurements": features,
            "primaryFindings": [
                "Unable to provide a safe ECG interpretation from available data.",
                reason,
            ],
            "criticalFindings": critical,
            "differentialDiagnosis": [],
            "confidence": 0,
            "urgency": urgency,
            "recommendation": (
                "Do not use this output for diagnosis. Obtain clinician/cardiologist review "
                "and repeat ECG acquisition if source data is inadequate."
            ),
            "redFlags": red_flags,
            "limitations": (
                "This system has not validated ECG diagnostic performance. It must not "
                "fabricate rhythm, interval, ischemia, or infarction findings."
            ),
            "clinical_disclaimer": CLINICAL_DISCLAIMER,
            "pipeline_trace": pipeline_trace(
                modality="ecg",
                deterministic_preprocessing="completed",
                specialized_model="not_configured_or_unavailable",
                validation_layer="blocked_diagnostic_output",
                llm_role="not_used_for_raw_diagnosis",
                final_gate="unable_to_interpret_safely",
            ),
        }
