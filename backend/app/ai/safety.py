"""Shared medical AI safety metadata and guards."""

CLINICAL_DISCLAIMER = (
    "AI-assisted decision support only; not a definitive diagnosis. "
    "Requires validation by a licensed physician."
)

LLM_ALLOWED_ROLES = ["explanation", "summarization", "report_formatting", "educational_reasoning"]
LLM_PROHIBITED_ROLES = ["raw_diagnosis_generation", "definitive_diagnosis_from_unvalidated_input"]


def pipeline_trace(
    *,
    modality: str,
    deterministic_preprocessing: str,
    specialized_model: str,
    validation_layer: str,
    llm_role: str,
    final_gate: str,
) -> dict:
    return {
        "modality": modality,
        "stages": [
            {"name": "deterministic_preprocessing", "status": deterministic_preprocessing},
            {"name": "specialized_medical_model", "status": specialized_model},
            {"name": "rule_based_validation", "status": validation_layer},
            {"name": "llm_role", "status": llm_role},
            {"name": "clinical_safety_gate", "status": final_gate},
        ],
        "llm_allowed_roles": LLM_ALLOWED_ROLES,
        "llm_prohibited_roles": LLM_PROHIBITED_ROLES,
    }


def review_required(reason: str, specialty: str) -> dict:
    return {
        "requires_physician_review": True,
        "review_recommended_specialty": specialty,
        "review_status": f"pending_{specialty}_review",
        "review_reason": reason,
    }
