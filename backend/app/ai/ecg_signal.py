"""Deterministic ECG waveform parsing and measurement helpers.

This is signal-processing scaffolding, not a validated diagnostic algorithm.
It supports simple CSV/TXT/XML waveform inputs and returns conservative
measurements with quality metadata for physician review.
"""
from __future__ import annotations

import csv
import math
import re
import xml.etree.ElementTree as ET
from pathlib import Path

import numpy as np
from scipy.signal import find_peaks

DEFAULT_SAMPLING_RATE_HZ = 500


def parse_waveform_file(file_path: str) -> dict | None:
    path = Path(file_path)
    suffix = path.suffix.lower()
    if suffix in {".csv", ".txt"}:
        return _parse_delimited(path)
    if suffix == ".xml":
        return _parse_xml(path)
    return None


def measure_ecg_signal(parsed: dict) -> dict:
    leads = parsed["leads"]
    sampling_rate = parsed.get("sampling_rate_hz") or DEFAULT_SAMPLING_RATE_HZ
    primary_name, primary_signal = _select_primary_lead(leads)
    signal = _normalize(np.asarray(primary_signal, dtype=float))
    quality = _quality(signal, sampling_rate)

    if quality["quality_score"] < 0.35:
        return {
            "source": parsed.get("source", "waveform"),
            "sampling_rate_hz": sampling_rate,
            "primary_lead": primary_name,
            "signal_quality": quality["quality_score"],
            "quality": quality,
            "measurement_status": "poor_quality",
        }

    peaks, properties = find_peaks(
        signal,
        distance=max(1, int(0.28 * sampling_rate)),
        prominence=max(0.25, float(np.std(signal)) * 0.6),
    )
    duration_seconds = len(signal) / sampling_rate
    rr_intervals = np.diff(peaks) / sampling_rate if len(peaks) > 1 else np.array([])
    heart_rate = int(round(60 / float(np.median(rr_intervals)))) if len(rr_intervals) else None
    rhythm_regular = bool(np.std(rr_intervals) / np.mean(rr_intervals) < 0.12) if len(rr_intervals) > 2 else None
    qrs_ms = _estimate_qrs_duration_ms(signal, peaks, sampling_rate)
    st_screen = _screen_st_elevation(leads, sampling_rate, peaks)

    return {
        "source": parsed.get("source", "waveform"),
        "sampling_rate_hz": sampling_rate,
        "duration_seconds": round(duration_seconds, 2),
        "primary_lead": primary_name,
        "signal_quality": quality["quality_score"],
        "quality": quality,
        "measurement_status": "measured_with_unvalidated_algorithm",
        "r_peak_count": int(len(peaks)),
        "estimated_heart_rate_bpm": heart_rate,
        "rr_interval_ms_median": int(round(float(np.median(rr_intervals) * 1000))) if len(rr_intervals) else None,
        "rr_variability_ratio": round(float(np.std(rr_intervals) / np.mean(rr_intervals)), 3) if len(rr_intervals) else None,
        "rhythm_regular": rhythm_regular,
        "qrs_duration_ms_estimate": qrs_ms,
        "pr_interval_ms": None,
        "qt_interval_ms": None,
        "qtc_interval_ms": None,
        "st_screen": st_screen,
    }


def _parse_delimited(path: Path) -> dict | None:
    text = path.read_text(encoding="utf-8", errors="ignore").strip()
    if not text:
        return None
    first_line = text.splitlines()[0]
    sampling_rate = _sampling_rate_from_text(text) or DEFAULT_SAMPLING_RATE_HZ
    delimiter = "," if "," in first_line else None

    rows = []
    for row in csv.reader(text.splitlines(), delimiter=delimiter or " "):
        cleaned = [cell for cell in row if cell != ""]
        if cleaned:
            rows.append(cleaned)
    if not rows:
        return None

    has_header = any(not _is_number(cell) for cell in rows[0])
    header = rows[0] if has_header else None
    data_rows = rows[1:] if has_header else rows
    numeric = []
    for row in data_rows:
        values = []
        for cell in row:
            if _is_number(cell):
                values.append(float(cell))
        if values:
            numeric.append(values)
    if not numeric:
        return None

    max_cols = max(len(row) for row in numeric)
    columns = [[] for _ in range(max_cols)]
    for row in numeric:
        for idx, value in enumerate(row):
            columns[idx].append(value)

    leads = {}
    for idx, values in enumerate(columns):
        if len(values) < 10:
            continue
        name = header[idx] if header and idx < len(header) else f"lead_{idx + 1}"
        if name.lower() in {"time", "timestamp", "t"}:
            continue
        leads[name] = values

    return {"source": "csv_waveform", "sampling_rate_hz": sampling_rate, "leads": leads} if leads else None


def _parse_xml(path: Path) -> dict | None:
    root = ET.parse(path).getroot()
    text = ET.tostring(root, encoding="unicode", method="text")
    sampling_rate = _sampling_rate_from_text(ET.tostring(root, encoding="unicode")) or DEFAULT_SAMPLING_RATE_HZ
    leads = {}
    for elem in root.iter():
        tag = elem.tag.lower()
        if any(key in tag for key in ["waveform", "lead", "digits", "samples"]):
            values = [float(v) for v in re.findall(r"[-+]?\d+(?:\.\d+)?", elem.text or "")]
            if len(values) > 50:
                leads[elem.attrib.get("name") or elem.attrib.get("lead") or elem.tag.split("}")[-1]] = values
    if not leads:
        values = [float(v) for v in re.findall(r"[-+]?\d+(?:\.\d+)?", text)]
        if len(values) > 50:
            leads["lead_1"] = values
    return {"source": "xml_waveform", "sampling_rate_hz": sampling_rate, "leads": leads} if leads else None


def _select_primary_lead(leads: dict) -> tuple[str, list[float]]:
    for preferred in ["II", "lead_2", "LeadII", "MDC_ECG_LEAD_II"]:
        if preferred in leads:
            return preferred, leads[preferred]
    return next(iter(leads.items()))


def _normalize(signal: np.ndarray) -> np.ndarray:
    signal = signal - np.median(signal)
    spread = np.percentile(signal, 95) - np.percentile(signal, 5)
    if spread <= 0:
        return signal
    return signal / spread


def _quality(signal: np.ndarray, sampling_rate: int) -> dict:
    finite_ratio = float(np.isfinite(signal).mean())
    if finite_ratio < 0.99 or len(signal) < sampling_rate * 2:
        return {"quality_score": 0.0, "reason": "Insufficient finite waveform duration."}
    baseline_wander = float(abs(np.median(signal[:sampling_rate]) - np.median(signal[-sampling_rate:])))
    amplitude = float(np.percentile(signal, 95) - np.percentile(signal, 5))
    noise = float(np.std(np.diff(signal)))
    quality_score = max(0.0, min(1.0, amplitude / (1 + noise + baseline_wander)))
    return {
        "quality_score": round(quality_score, 3),
        "amplitude": round(amplitude, 3),
        "noise": round(noise, 3),
        "baseline_wander": round(baseline_wander, 3),
        "reason": "Deterministic signal quality heuristic; not clinical validation.",
    }


def _estimate_qrs_duration_ms(signal: np.ndarray, peaks: np.ndarray, sampling_rate: int) -> int | None:
    if len(peaks) == 0:
        return None
    durations = []
    window = int(0.12 * sampling_rate)
    threshold = 0.18
    for peak in peaks[:20]:
        left = peak
        while left > max(0, peak - window) and abs(signal[left]) > threshold:
            left -= 1
        right = peak
        while right < min(len(signal) - 1, peak + window) and abs(signal[right]) > threshold:
            right += 1
        duration_ms = (right - left) / sampling_rate * 1000
        if 40 <= duration_ms <= 200:
            durations.append(duration_ms)
    return int(round(float(np.median(durations)))) if durations else None


def _screen_st_elevation(leads: dict, sampling_rate: int, peaks: np.ndarray) -> dict:
    if len(peaks) < 3:
        return {"status": "insufficient_beats", "possible_st_elevation_leads": []}
    possible = []
    j_offset = int(0.08 * sampling_rate)
    baseline_offset = int(0.16 * sampling_rate)
    for name, raw in leads.items():
        signal = _normalize(np.asarray(raw, dtype=float))
        values = []
        for peak in peaks[:20]:
            st_idx = peak + j_offset
            base_idx = peak - baseline_offset
            if 0 <= base_idx < len(signal) and 0 <= st_idx < len(signal):
                values.append(float(signal[st_idx] - signal[base_idx]))
        if values and float(np.median(values)) > 0.18:
            possible.append(name)
    return {
        "status": "screen_positive_requires_immediate_physician_review" if possible else "no_screen_positive_leads",
        "possible_st_elevation_leads": possible,
        "method": "unvalidated ST deviation screening from waveform baseline",
    }


def _sampling_rate_from_text(text: str) -> int | None:
    match = re.search(r"(?:sampling[_\s-]?rate|sample[_\s-]?rate|frequency|hz)\D{0,20}(\d{2,5})", text, re.I)
    if not match:
        return None
    value = int(match.group(1))
    return value if 100 <= value <= 2000 else None


def _is_number(value: str) -> bool:
    try:
        numeric = float(value)
    except ValueError:
        return False
    return math.isfinite(numeric)
