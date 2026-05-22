"""Shared Claude API client for report generation."""
import json

import anthropic

from app.config import settings

_client: anthropic.Anthropic | None = None


def get_claude() -> anthropic.Anthropic:
    global _client
    if _client is None:
        _client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    return _client


async def generate_report(
    study_type: str,
    ai_findings: dict,
    language: str = "en",
    clinical_notes: str = "",
) -> str:
    """Generate a conservative AI-assisted draft report."""
    lang_names = {"en": "English", "fr": "French", "ar": "Arabic"}
    lang_name = lang_names.get(language, "English")

    prompt = f"""Generate a conservative AI-assisted {study_type.upper()} draft report in {lang_name}.

AI FINDINGS:
{json.dumps(ai_findings, indent=2)}

ADDITIONAL CLINICAL NOTES: {clinical_notes or 'None provided'}

Rules:
- Do not add diagnoses or findings absent from the supplied AI findings.
- Preserve uncertainty, low-confidence, review-pending, and unable-to-interpret states.
- State that this is AI-assisted, not definitive, and requires physician validation.
- If confidence is low or review is pending, make that prominent.

Structure: Patient info placeholder, Clinical history, Findings, Impression, Recommendations.
End with: "AI-ASSISTED DRAFT - Requires review and countersignature by attending physician."

Return only the report text, no JSON wrapper."""

    try:
        client = get_claude()
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1500,
            messages=[{"role": "user", "content": prompt}],
        )
        return response.content[0].text.strip()
    except Exception as exc:
        return (
            f"[AI-ASSISTED DRAFT - {study_type.upper()}]\n\n"
            f"AI findings summary:\n{json.dumps(ai_findings, indent=2)}\n\n"
            f"Additional notes: {clinical_notes}\n\n"
            "This report is not a definitive diagnosis. It requires review and countersignature by "
            "the attending physician before clinical use.\n"
            f"(Report generation error: {str(exc)})"
        )
