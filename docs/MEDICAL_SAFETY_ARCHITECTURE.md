# Medical Safety Architecture

MediCore AI is an AI-assisted clinical decision-support prototype. It is not a
validated diagnostic device and must not present unreviewed AI output as a
definitive diagnosis.

## Required Pipeline Order

1. Deterministic preprocessing
2. Specialized medical model or deterministic medical rules
3. Rule-based validation and plausibility checks
4. Confidence and quality assessment
5. Conservative interpretation gate
6. Physician review workflow
7. LLM explanation/report formatting only

## LLM Boundary

Allowed:
- Explanation
- Summarization
- Report formatting
- Educational reasoning from already validated structured findings

Prohibited:
- Raw diagnosis generation from unvalidated images or lab values
- Fabricating measurements, findings, or confidence
- Claiming definitive diagnosis, FDA approval, CE approval, or clinical validation

## Failure Mode

If input quality, model availability, units, measurements, or validation status
are uncertain, the system must return:

- `diagnostic_status: unable_to_interpret_safely` or `uncertain_requires_review`
- `confidence: 0` for unsafe interpretation
- `requires_physician_review: true`
- clear clinical disclaimer
- explicit pipeline trace

## Current Modality Behavior

ECG:
- Does not diagnose rhythm, ischemia, infarction, or intervals from image heuristics.
- Returns cardiologist-review state unless a validated ECG interpretation service is configured.
- Supports deterministic waveform measurement scaffolding for CSV/TXT/XML inputs:
  - R-peak detection
  - estimated heart rate
  - rhythm regularity estimate
  - QRS duration estimate
  - ST-elevation screening flag
- These measurements are marked `measured_with_unvalidated_algorithm` and still require cardiologist review.

Radiology:
- Does not overcall pathology from image heuristics.
- Returns radiologist-review state unless a validated radiology interpretation service is configured.
- Optional specialized model endpoint can be configured with `RADIOLOGY_MODEL_URL`.
- Model outputs are thresholded into review flags, not definitive diagnoses.
- Expected endpoint response:

```json
{
  "model_name": "cxr-model-name",
  "model_version": "version",
  "calibration": "calibration method or unknown",
  "probabilities": {
    "pneumonia": 0.0,
    "pneumothorax": 0.0,
    "nodule": 0.0,
    "pulmonary_edema": 0.0,
    "pleural_effusion": 0.0
  }
}
```

Labs:
- Uses deterministic reference ranges, plausible-value checks, and critical-value rules.
- Does not infer diagnoses or likely causes automatically.
