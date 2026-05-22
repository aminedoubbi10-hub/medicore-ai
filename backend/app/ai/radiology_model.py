"""Radiology model interface.

This wraps an optional external specialized model service. The service is
expected to return calibrated probabilities; this module applies conservative
thresholds and never treats probabilities as definitive diagnosis.
"""
import base64
from pathlib import Path

import httpx

from app.config import settings

SUPPORTED_FINDINGS = {
    "pneumonia": {"review_threshold": 0.75, "urgent_threshold": 0.9},
    "pneumothorax": {"review_threshold": 0.55, "urgent_threshold": 0.75},
    "nodule": {"review_threshold": 0.7, "urgent_threshold": 0.9},
    "pulmonary_edema": {"review_threshold": 0.75, "urgent_threshold": 0.9},
    "pleural_effusion": {"review_threshold": 0.75, "urgent_threshold": 0.9},
}


async def run_radiology_model(file_path: str) -> dict:
    if not settings.RADIOLOGY_MODEL_URL:
        return {
            "available": False,
            "reason": "No specialized radiology model endpoint configured.",
            "probabilities": {},
        }

    payload = {
        "image_base64": base64.b64encode(Path(file_path).read_bytes()).decode("ascii"),
        "requested_findings": list(SUPPORTED_FINDINGS),
    }
    async with httpx.AsyncClient(timeout=settings.RADIOLOGY_MODEL_TIMEOUT_SECONDS) as client:
        response = await client.post(settings.RADIOLOGY_MODEL_URL, json=payload)
        response.raise_for_status()
        data = response.json()

    probabilities = {
        name: float(data.get("probabilities", {}).get(name, 0))
        for name in SUPPORTED_FINDINGS
    }
    return {
        "available": True,
        "model_name": data.get("model_name", "external_radiology_model"),
        "model_version": data.get("model_version", "unknown"),
        "calibration": data.get("calibration", "unknown"),
        "probabilities": probabilities,
        "validation": validate_probabilities(probabilities),
    }


def validate_probabilities(probabilities: dict[str, float]) -> dict:
    review_flags = []
    urgent_flags = []
    for finding, probability in probabilities.items():
        thresholds = SUPPORTED_FINDINGS.get(finding)
        if not thresholds:
            continue
        if probability >= thresholds["urgent_threshold"]:
            urgent_flags.append(finding)
        elif probability >= thresholds["review_threshold"]:
            review_flags.append(finding)
    return {
        "review_flags": review_flags,
        "urgent_flags": urgent_flags,
        "rule": "thresholds trigger review, not definitive diagnosis",
    }
