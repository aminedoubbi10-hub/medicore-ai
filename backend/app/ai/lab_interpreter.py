"""Conservative lab result interpretation.

Lab handling is deterministic and reference-range based. It flags abnormal and
critical values, but does not infer diagnoses without physician review.
"""
import math

from app.ai.safety import CLINICAL_DISCLAIMER, pipeline_trace, review_required

REFERENCE_RANGES = {
    "wbc": {"low": 4.0, "high": 10.0, "unit": "10^3/uL", "critical_high": 30.0, "critical_low": 2.0, "plausible": (0, 500)},
    "hemoglobin": {"low": 12.0, "high": 17.5, "unit": "g/dL", "critical_low": 7.0, "plausible": (0, 30)},
    "platelets": {"low": 150, "high": 400, "unit": "10^3/uL", "critical_low": 50, "critical_high": 1000, "plausible": (0, 3000)},
    "sodium": {"low": 136, "high": 145, "unit": "mEq/L", "critical_low": 120, "critical_high": 160, "plausible": (80, 200)},
    "potassium": {"low": 3.5, "high": 5.0, "unit": "mEq/L", "critical_low": 2.8, "critical_high": 6.5, "plausible": (1, 10)},
    "creatinine": {"low": 0.6, "high": 1.2, "unit": "mg/dL", "critical_high": 10.0, "plausible": (0, 30)},
    "glucose": {"low": 70, "high": 100, "unit": "mg/dL", "critical_low": 40, "critical_high": 500, "plausible": (0, 1500)},
    "troponin_i": {"low": 0, "high": 0.04, "unit": "ng/mL", "critical_high": 0.5, "plausible": (0, 100)},
    "troponin_t": {"low": 0, "high": 0.01, "unit": "ng/mL", "critical_high": 0.1, "plausible": (0, 100)},
    "bnp": {"low": 0, "high": 100, "unit": "pg/mL", "critical_high": 500, "plausible": (0, 100000)},
    "inr": {"low": 0.8, "high": 1.2, "unit": "", "critical_high": 5.0, "plausible": (0, 20)},
    "crp": {"low": 0, "high": 5.0, "unit": "mg/L", "critical_high": 100, "plausible": (0, 1000)},
    "ph": {"low": 7.35, "high": 7.45, "unit": "", "critical_low": 7.2, "critical_high": 7.6, "plausible": (6.5, 8.2)},
}


def classify_value(name: str, value: float) -> dict:
    ref = REFERENCE_RANGES.get(name.lower())
    if not ref:
        return {"status": "unknown", "flag": "UNKNOWN_TEST", "ref": None}
    if not math.isfinite(value):
        return {"status": "invalid", "flag": "INVALID_VALUE", "ref": ref}
    low_possible, high_possible = ref["plausible"]
    if value < low_possible or value > high_possible:
        return {"status": "invalid", "flag": "IMPLAUSIBLE_VALUE_VERIFY_UNITS", "ref": ref}
    if "critical_low" in ref and value <= ref["critical_low"]:
        return {"status": "critical_low", "flag": "CRITICAL_LOW", "ref": ref}
    if "critical_high" in ref and value >= ref["critical_high"]:
        return {"status": "critical_high", "flag": "CRITICAL_HIGH", "ref": ref}
    if value < ref["low"]:
        return {"status": "low", "flag": "LOW", "ref": ref}
    if value > ref["high"]:
        return {"status": "high", "flag": "HIGH", "ref": ref}
    return {"status": "normal", "flag": "NORMAL", "ref": ref}


async def interpret_labs(lab_values: dict, patient_context: str = "") -> dict:
    classified = {}
    critical_values = []
    abnormal_values = []
    invalid_values = []
    unknown_values = []

    for name, value in lab_values.items():
        if value is None:
            continue
        normalized_name = name.lower()
        numeric_value = float(value)
        c = classify_value(normalized_name, numeric_value)
        ref = c["ref"]
        classified[normalized_name] = {
            "value": numeric_value,
            "unit": ref["unit"] if ref else "",
            "status": c["status"],
            "flag": c["flag"],
            "reference_range": {"low": ref["low"], "high": ref["high"]} if ref else None,
            "requires_review": c["status"] in {"critical_low", "critical_high", "invalid", "unknown"},
        }
        if c["status"] in {"critical_low", "critical_high"}:
            critical_values.append(f"{normalized_name}: {numeric_value} {ref['unit']} ({c['flag']})")
        elif c["status"] == "invalid":
            invalid_values.append(f"{normalized_name}: {numeric_value} ({c['flag']})")
        elif c["status"] == "unknown":
            unknown_values.append(normalized_name)
        elif c["status"] != "normal":
            abnormal_values.append(f"{normalized_name}: {numeric_value} {ref['unit']} ({c['flag']})")

    if critical_values:
        urgency = "emergent"
    elif invalid_values:
        urgency = "urgent"
    elif abnormal_values:
        urgency = "routine"
    else:
        urgency = "routine"

    recommendations = [
        "Physician review required before clinical action.",
        "Verify units, specimen timing, and patient context.",
    ]
    if critical_values:
        recommendations.insert(0, "Immediately notify responsible clinician per local critical-value policy.")
    if invalid_values:
        recommendations.insert(0, "Do not interpret implausible values until units/source data are verified.")

    return {
        "ai_assisted": True,
        "diagnostic_status": "decision_support_requires_review",
        **review_required("Lab values require clinician validation before action.", "physician"),
        "classified_values": classified,
        "critical_values": critical_values,
        "abnormal_values": abnormal_values,
        "invalid_values": invalid_values,
        "unknown_values": unknown_values,
        "summary": _summary(critical_values, abnormal_values, invalid_values, unknown_values),
        "criticalFlags": critical_values,
        "interpretation": (
            "Reference-range screening only. This output flags values for review and does not provide a diagnosis."
        ),
        "likelyCauses": [],
        "recommendations": recommendations,
        "confidence": 0 if invalid_values or unknown_values else 85,
        "urgency": urgency,
        "safety_flags": _safety_flags(critical_values, invalid_values, unknown_values),
        "clinical_disclaimer": (
            f"{CLINICAL_DISCLAIMER} Critical values require immediate escalation according to institutional policy."
        ),
        "pipeline_trace": pipeline_trace(
            modality="laboratory",
            deterministic_preprocessing="completed",
            specialized_model="not_required_for_reference_range_screening",
            validation_layer="reference_ranges_plausibility_and_critical_rules_applied",
            llm_role="not_used_for_diagnosis",
            final_gate="requires_physician_review",
        ),
        "patient_context_used": bool(patient_context),
    }


def _summary(critical_values: list[str], abnormal_values: list[str], invalid_values: list[str], unknown_values: list[str]) -> str:
    if invalid_values:
        return "One or more lab values are implausible or unit-inconsistent; verify before interpretation."
    if critical_values:
        return "Critical lab values detected; immediate clinical escalation is required."
    if abnormal_values:
        return "Abnormal lab values detected; physician review is required."
    if unknown_values:
        return "Some submitted tests are not recognized by the reference-range table."
    return "No abnormal values detected in the supported reference-range table."


def _safety_flags(critical_values: list[str], invalid_values: list[str], unknown_values: list[str]) -> list[str]:
    flags = []
    if critical_values:
        flags.append("critical_value_escalation_required")
    if invalid_values:
        flags.append("verify_units_or_source_data")
    if unknown_values:
        flags.append("unsupported_lab_test_present")
    return flags
