"""app/ai/lab_interpreter.py — Lab result AI interpretation."""
import json
import anthropic
from app.config import settings

REFERENCE_RANGES = {
    "wbc":          {"low": 4.0,  "high": 10.0,  "unit": "×10³/µL", "critical_high": 30.0, "critical_low": 2.0},
    "hemoglobin":   {"low": 12.0, "high": 17.5,  "unit": "g/dL",    "critical_low": 7.0},
    "platelets":    {"low": 150,  "high": 400,   "unit": "×10³/µL", "critical_low": 50,   "critical_high": 1000},
    "sodium":       {"low": 136,  "high": 145,   "unit": "mEq/L",   "critical_low": 120,  "critical_high": 160},
    "potassium":    {"low": 3.5,  "high": 5.0,   "unit": "mEq/L",   "critical_low": 2.8,  "critical_high": 6.5},
    "creatinine":   {"low": 0.6,  "high": 1.2,   "unit": "mg/dL",   "critical_high": 10.0},
    "glucose":      {"low": 70,   "high": 100,   "unit": "mg/dL",   "critical_low": 40,   "critical_high": 500},
    "troponin_i":   {"low": 0,    "high": 0.04,  "unit": "ng/mL",   "critical_high": 0.5},
    "troponin_t":   {"low": 0,    "high": 0.01,  "unit": "ng/mL",   "critical_high": 0.1},
    "bnp":          {"low": 0,    "high": 100,   "unit": "pg/mL",   "critical_high": 500},
    "inr":          {"low": 0.8,  "high": 1.2,   "unit": "",        "critical_high": 5.0},
    "crp":          {"low": 0,    "high": 5.0,   "unit": "mg/L",    "critical_high": 100},
    "ph":           {"low": 7.35, "high": 7.45,  "unit": "",        "critical_low": 7.2,  "critical_high": 7.6},
}


def classify_value(name: str, value: float) -> dict:
    ref = REFERENCE_RANGES.get(name.lower())
    if not ref:
        return {"status": "unknown", "flag": "?", "ref": None}
    if ref.get("critical_low") and value <= ref["critical_low"]:
        return {"status": "critical_low",  "flag": "↓↓ CRITICAL", "ref": ref}
    if ref.get("critical_high") and value >= ref["critical_high"]:
        return {"status": "critical_high", "flag": "↑↑ CRITICAL", "ref": ref}
    if value < ref["low"]:
        return {"status": "low",    "flag": "↓ LOW",    "ref": ref}
    if value > ref["high"]:
        return {"status": "high",   "flag": "↑ HIGH",   "ref": ref}
    return {"status": "normal", "flag": "NORMAL", "ref": ref}


async def interpret_labs(lab_values: dict, patient_context: str = "") -> dict:
    classified = {}
    critical_values = []
    abnormal_values = []

    for name, value in lab_values.items():
        if value is None:
            continue
        c = classify_value(name, float(value))
        classified[name] = {
            "value": value,
            "unit": c["ref"]["unit"] if c["ref"] else "",
            "status": c["status"],
            "flag": c["flag"],
        }
        if "critical" in c["status"]:
            critical_values.append(f"{name}: {value} ({c['flag']})")
        elif c["status"] != "normal" and c["status"] != "unknown":
            abnormal_values.append(f"{name}: {value} ({c['flag']})")

    summary = "\n".join(f"- {n}: {i['value']} {i['unit']} [{i['flag']}]" for n, i in classified.items())
    prompt = f"""Interpret these laboratory results for a physician.

LAB RESULTS:
{summary}

CRITICAL VALUES: {', '.join(critical_values) or 'None'}
ABNORMAL VALUES: {', '.join(abnormal_values) or 'None'}
PATIENT CONTEXT: {patient_context or 'Not provided'}

Return ONLY JSON:
{{
  "summary": "string",
  "criticalFlags": [],
  "interpretation": "string",
  "likelyCauses": [],
  "recommendations": [],
  "confidence": 0,
  "urgency": "routine|urgent|emergent"
}}"""

    try:
        client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1000,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = response.content[0].text.strip().replace("```json", "").replace("```", "").strip()
        ai = json.loads(raw)
    except Exception:
        ai = {
            "summary": "AI unavailable. Review flagged values manually.",
            "criticalFlags": critical_values,
            "interpretation": "Manual interpretation required.",
            "likelyCauses": [],
            "recommendations": ["Physician review of all flagged values required"],
            "confidence": 0,
            "urgency": "emergent" if critical_values else "routine",
        }

    return {
        "classified_values": classified,
        "critical_values": critical_values,
        "abnormal_values": abnormal_values,
        **ai,
        "disclaimer": "AI lab interpretation is a decision support tool only. All critical values require immediate physician notification.",
    }
