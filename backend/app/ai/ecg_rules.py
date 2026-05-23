"""Rule-based ECG screening interpretation.

These rules turn deterministic measurements into conservative screening text.
They do not diagnose; they create review flags and transparent reasoning.
"""
from __future__ import annotations


def build_ecg_screen_interpretation(features: dict) -> dict:
    image_screen = features.get("image_waveform_screen", {}) or {}
    image_quality = features.get("image_quality", {}) or {}
    st_screen = features.get("st_screen", {}) or {}
    estimated_hr = features.get("estimated_heart_rate_bpm")
    rr_regular = features.get("rr_regular")
    qrs_ms = features.get("qrs_duration_ms_estimate")
    digitization_quality = float(features.get("digitization_quality") or 0)
    lead_quality = float(image_screen.get("lead_segmentation_quality") or 0)
    image_quality_score = float(image_quality.get("quality_score") or 0)

    primary_findings: list[str] = []
    critical_findings: list[str] = []
    red_flags: list[str] = []
    limitations: list[str] = []
    urgency = "routine"

    rhythm_text, rhythm_findings, rhythm_flags = _rhythm_screen(rr_regular)
    primary_findings.extend(rhythm_findings)
    red_flags.extend(rhythm_flags)

    rate_text, rate_findings, rate_flags, rate_urgency = _rate_screen(estimated_hr)
    primary_findings.extend(rate_findings)
    red_flags.extend(rate_flags)
    urgency = _max_urgency(urgency, rate_urgency)

    qrs_text, qrs_findings, qrs_flags = _qrs_screen(qrs_ms)
    primary_findings.extend(qrs_findings)
    red_flags.extend(qrs_flags)

    st_text, st_findings, st_critical, st_flags, st_urgency = _st_screen(st_screen)
    primary_findings.extend(st_findings)
    critical_findings.extend(st_critical)
    red_flags.extend(st_flags)
    urgency = _max_urgency(urgency, st_urgency)

    quality_findings, quality_flags, quality_limitations = _quality_screen(
        image_quality=image_quality,
        digitization_quality=digitization_quality,
        lead_quality=lead_quality,
    )
    primary_findings.extend(quality_findings)
    red_flags.extend(quality_flags)
    limitations.extend(quality_limitations)

    if not primary_findings:
        primary_findings.append("No reliable ECG image-derived interpretation could be generated from available measurements.")

    confidence = _confidence_score(
        image_quality_score=image_quality_score,
        digitization_quality=digitization_quality,
        lead_quality=lead_quality,
        has_rate=estimated_hr is not None,
        has_qrs=qrs_ms is not None,
        has_rr=rr_regular is not None,
    )

    if confidence < 30:
        urgency = _max_urgency(urgency, "urgent")
        red_flags.append("low_confidence_ecg_image_screen")
        limitations.append("Low confidence: treat this result as a triage prompt, not an interpretation.")

    return {
        "rhythm": rhythm_text,
        "heartRate": rate_text,
        "qrsDuration": qrs_text,
        "stChanges": st_text,
        "primaryFindings": _dedupe(primary_findings),
        "criticalFindings": _dedupe(critical_findings),
        "redFlags": _dedupe(red_flags),
        "urgency": urgency,
        "confidence": confidence,
        "limitations": " ".join(_dedupe(limitations)),
        "rule_engine": {
            "version": "ecg_image_rules_v1",
            "inputs": {
                "estimated_heart_rate_bpm": estimated_hr,
                "rr_regular": rr_regular,
                "qrs_duration_ms_estimate": qrs_ms,
                "st_screen": st_screen,
                "image_quality_score": image_quality_score,
                "digitization_quality": digitization_quality,
                "lead_segmentation_quality": lead_quality,
            },
            "policy": "screening_flags_only_no_definitive_diagnosis",
        },
    }


def _rate_screen(estimated_hr: int | None) -> tuple[str, list[str], list[str], str]:
    if estimated_hr is None:
        return (
            "Unable to determine safely",
            ["Heart rate could not be estimated reliably from the uploaded ECG image/PDF."],
            ["heart_rate_unavailable"],
            "urgent",
        )
    text = f"{estimated_hr} bpm (image-derived estimate)"
    if estimated_hr >= 150:
        return (
            text,
            [f"Marked tachycardic rate screen: approximately {estimated_hr} bpm."],
            ["marked_tachycardia_screen"],
            "urgent",
        )
    if estimated_hr > 100:
        return (
            text,
            [f"Tachycardic rate screen: approximately {estimated_hr} bpm."],
            ["tachycardia_screen"],
            "routine",
        )
    if estimated_hr < 40:
        return (
            text,
            [f"Marked bradycardic rate screen: approximately {estimated_hr} bpm."],
            ["marked_bradycardia_screen"],
            "urgent",
        )
    if estimated_hr < 60:
        return (
            text,
            [f"Bradycardic rate screen: approximately {estimated_hr} bpm."],
            ["bradycardia_screen"],
            "routine",
        )
    return text, [f"Ventricular rate screen is approximately {estimated_hr} bpm."], [], "routine"


def _rhythm_screen(rr_regular: bool | None) -> tuple[str, list[str], list[str]]:
    if rr_regular is True:
        return (
            "Regular RR pattern by image screen",
            ["RR interval pattern appears regular on the extracted trace."],
            [],
        )
    if rr_regular is False:
        return (
            "Irregular RR pattern by image screen",
            ["Irregular RR interval pattern detected; correlate clinically and review the source ECG."],
            ["irregular_rr_screen"],
        )
    return (
        "Unable to determine rhythm safely from image",
        ["RR regularity could not be estimated reliably from the uploaded ECG image/PDF."],
        ["rr_regular_unavailable"],
    )


def _qrs_screen(qrs_ms: int | None) -> tuple[str, list[str], list[str]]:
    if qrs_ms is None:
        return (
            "Unable to measure safely from image",
            ["QRS duration could not be measured reliably from image digitization."],
            ["qrs_duration_unavailable"],
        )
    text = f"{qrs_ms} ms (image-derived estimate)"
    if qrs_ms >= 140:
        return (
            text,
            [f"Wide QRS screen: estimated QRS duration approximately {qrs_ms} ms."],
            ["wide_qrs_screen"],
        )
    if qrs_ms >= 120:
        return (
            text,
            [f"Borderline/wide QRS screen: estimated QRS duration approximately {qrs_ms} ms."],
            ["borderline_wide_qrs_screen"],
        )
    return text, [f"QRS duration screen is approximately {qrs_ms} ms."], []


def _st_screen(st_screen: dict) -> tuple[str, list[str], list[str], list[str], str]:
    if not st_screen or st_screen.get("status") == "unable_to_screen":
        return (
            "Unable to assess safely",
            ["ST segment screening could not be performed reliably from this image."],
            [],
            ["st_screen_unavailable"],
            "urgent",
        )

    if st_screen.get("possible_st_elevation"):
        territories = st_screen.get("possible_territories") or []
        leads = st_screen.get("possible_st_elevation_leads") or []
        territory_text = ", ".join(territories) if territories else "unspecified territory"
        lead_text = ", ".join(leads) if leads else "contiguous leads"
        finding = (
            "Possible ST elevation screen flag in "
            f"{territory_text} ({lead_text}); urgent physician/cardiologist review is required."
        )
        return (
            "Possible ST elevation screen flag - urgent review required",
            [finding],
            [finding],
            ["possible_st_elevation_screen"],
            "emergent",
        )

    return (
        "No ST elevation screen flag by image heuristic",
        ["No possible ST elevation screen flag was detected by the image heuristic."],
        [],
        [],
        "routine",
    )


def _quality_screen(image_quality: dict, digitization_quality: float, lead_quality: float) -> tuple[list[str], list[str], list[str]]:
    findings = []
    flags = []
    limitations = []

    if image_quality:
        score = image_quality.get("quality_score")
        status = image_quality.get("status", "unknown")
        findings.append(f"ECG image quality status: {status} (score {score}).")
        warnings = image_quality.get("warnings") or []
        if warnings:
            flags.extend([f"image_quality_{warning}" for warning in warnings])
            limitations.append("Image quality warnings: " + ", ".join(warnings) + ".")

    findings.append(f"Digitization quality score: {round(digitization_quality, 3)}.")
    findings.append(f"Lead segmentation quality score: {round(lead_quality, 3)}.")

    if digitization_quality < 0.25:
        flags.append("low_digitization_quality")
        limitations.append("Low digitization quality limits rhythm, interval, and ST assessment.")
    if lead_quality < 0.2:
        flags.append("low_lead_segmentation_quality")
        limitations.append("Low lead segmentation quality limits multi-lead territory interpretation.")

    return findings, flags, limitations


def _confidence_score(
    *,
    image_quality_score: float,
    digitization_quality: float,
    lead_quality: float,
    has_rate: bool,
    has_qrs: bool,
    has_rr: bool,
) -> int:
    measurement_bonus = 0
    measurement_bonus += 8 if has_rate else 0
    measurement_bonus += 6 if has_qrs else 0
    measurement_bonus += 5 if has_rr else 0
    score = 12 + 22 * image_quality_score + 18 * digitization_quality + 14 * lead_quality + measurement_bonus
    return int(max(5, min(65, round(score))))


def _max_urgency(current: str, candidate: str) -> str:
    rank = {"routine": 0, "urgent": 1, "emergent": 2}
    return candidate if rank.get(candidate, 0) > rank.get(current, 0) else current


def _dedupe(values: list[str]) -> list[str]:
    seen = set()
    deduped = []
    for value in values:
        if value and value not in seen:
            seen.add(value)
            deduped.append(value)
    return deduped
