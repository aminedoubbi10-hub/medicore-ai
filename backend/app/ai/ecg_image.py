"""ECG image digitization heuristics.

This extracts a rough waveform from dark ECG traces in uploaded images. It is
for preliminary screening only and is not a validated ECG measurement system.
"""
from __future__ import annotations

import numpy as np
from scipy.signal import find_peaks, savgol_filter

LEAD_LAYOUT = [
    ["I", "aVR", "V1", "V4"],
    ["II", "aVL", "V2", "V5"],
    ["III", "aVF", "V3", "V6"],
]

TERRITORIES = {
    "inferior": {"II", "III", "aVF"},
    "lateral": {"I", "aVL", "V5", "V6"},
    "septal_anterior": {"V1", "V2", "V3", "V4"},
}


def load_ecg_document(file_path: str) -> np.ndarray | None:
    """Load an ECG image or first page of a PDF as grayscale pixels."""
    path = str(file_path)
    if path.lower().endswith(".pdf"):
        try:
            import cv2
            import fitz

            doc = fitz.open(path)
            if len(doc) == 0:
                return None
            pix = doc[0].get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
            arr = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)
            return cv2.cvtColor(arr, cv2.COLOR_RGB2GRAY) if pix.n >= 3 else arr
        except Exception:
            return None

    try:
        import cv2

        return cv2.imread(path, cv2.IMREAD_GRAYSCALE)
    except Exception:
        return None


def screen_ecg_image(image_gray: np.ndarray) -> dict:
    lead_regions = _segment_leads(image_gray)
    lead_screens = {}
    for lead_name, crop in lead_regions.items():
        lead_screens[lead_name] = _screen_single_trace(crop)

    usable = {
        lead: screen
        for lead, screen in lead_screens.items()
        if screen.get("image_screen_status") == "image_waveform_screen_completed"
    }
    representative_lead = "II" if "II" in usable else next(iter(usable), None)
    representative = usable.get(representative_lead) if representative_lead else None
    st_summary = _territory_st_summary(lead_screens)

    if not representative:
        return {
            "image_screen_status": "unable_to_digitize_trace",
            "estimated_heart_rate_bpm": None,
            "rr_regular": None,
            "qrs_duration_ms_estimate": None,
            "st_screen": {"status": "unable_to_screen", "possible_st_elevation": False},
            "digitization_quality": 0.0,
            "lead_screens": lead_screens,
            "lead_layout": "attempted_3x4_standard_layout",
        }

    return {
        **representative,
        "representative_lead": representative_lead,
        "lead_screens": lead_screens,
        "lead_layout": "attempted_3x4_standard_layout",
        "st_screen": st_summary,
    }


def _screen_single_trace(image_gray: np.ndarray) -> dict:
    height, width = image_gray.shape[:2]
    trace = _extract_trace(image_gray)
    if trace is None or len(trace) < 100:
        return {
            "image_screen_status": "unable_to_digitize_trace",
            "estimated_heart_rate_bpm": None,
            "rr_regular": None,
            "qrs_duration_ms_estimate": None,
            "st_screen": {"status": "unable_to_screen", "possible_st_elevation": False},
            "digitization_quality": 0.0,
        }

    signal = _normalize_trace(trace)
    peaks, _ = find_peaks(signal, distance=max(10, width // 14), prominence=0.25)
    quality = _digitization_quality(signal, peaks)

    if len(peaks) < 2:
        return {
            "image_screen_status": "insufficient_qrs_candidates",
            "estimated_heart_rate_bpm": None,
            "rr_regular": None,
            "qrs_duration_ms_estimate": None,
            "st_screen": {"status": "insufficient_beats", "possible_st_elevation": False},
            "digitization_quality": quality,
        }

    # Standard ECG paper is commonly 25 mm/s. Without calibration detection,
    # assume the visible strip is roughly 10 seconds if width is typical.
    assumed_seconds = 10.0
    pixels_per_second = width / assumed_seconds
    rr_pixels = np.diff(peaks)
    rr_seconds = rr_pixels / pixels_per_second
    estimated_hr = int(round(60 / float(np.median(rr_seconds)))) if len(rr_seconds) else None
    rr_variability = float(np.std(rr_seconds) / np.mean(rr_seconds)) if len(rr_seconds) > 1 else None
    rr_regular = bool(rr_variability is not None and rr_variability < 0.12)
    qrs_ms = _estimate_qrs_ms(signal, peaks, pixels_per_second)
    st_screen = _st_screen(signal, peaks, pixels_per_second)

    return {
        "image_screen_status": "image_waveform_screen_completed",
        "estimated_heart_rate_bpm": estimated_hr,
        "rr_regular": rr_regular,
        "rr_variability_ratio": round(rr_variability, 3) if rr_variability is not None else None,
        "qrs_duration_ms_estimate": qrs_ms,
        "st_screen": st_screen,
        "digitization_quality": quality,
        "assumptions": {
            "visible_strip_seconds": assumed_seconds,
            "paper_speed": "assumed 25 mm/s; not detected",
            "calibration": "not detected",
            "lead": "single extracted trace; lead identity unknown",
        },
    }


def _segment_leads(image_gray: np.ndarray) -> dict[str, np.ndarray]:
    height, width = image_gray.shape[:2]
    y0, y1 = int(height * 0.08), int(height * 0.86)
    x0, x1 = int(width * 0.04), int(width * 0.96)
    usable = image_gray[y0:y1, x0:x1]
    h, w = usable.shape[:2]
    row_h = h // 3
    col_w = w // 4
    regions = {}
    for row_idx, row in enumerate(LEAD_LAYOUT):
        for col_idx, lead_name in enumerate(row):
            ys = row_idx * row_h
            ye = h if row_idx == 2 else (row_idx + 1) * row_h
            xs = col_idx * col_w
            xe = w if col_idx == 3 else (col_idx + 1) * col_w
            crop = usable[ys:ye, xs:xe]
            if crop.size:
                regions[lead_name] = crop
    if not regions:
        regions["unknown"] = image_gray
    return regions


def _territory_st_summary(lead_screens: dict[str, dict]) -> dict:
    possible_leads = {
        lead
        for lead, screen in lead_screens.items()
        if screen.get("st_screen", {}).get("possible_st_elevation")
    }
    territories = [
        territory
        for territory, leads in TERRITORIES.items()
        if len(possible_leads.intersection(leads)) >= 2
    ]
    possible = bool(territories)
    return {
        "status": "possible_st_elevation_requires_physician_review" if possible else "no_st_screen_flag",
        "possible_st_elevation": possible,
        "possible_st_elevation_leads": sorted(possible_leads),
        "possible_territories": territories,
        "method": "unvalidated multi-lead image digitization ST screen",
    }


def _extract_trace(image_gray: np.ndarray) -> np.ndarray | None:
    img = image_gray.astype(np.uint8)
    # Dark pixels are likely trace/text/grid. Use a conservative percentile and
    # prefer the darkest point per column near the central signal band.
    threshold = min(120, int(np.percentile(img, 12)))
    mask = img < threshold
    height, width = img.shape[:2]
    ys = np.full(width, np.nan)
    for x in range(width):
        candidates = np.where(mask[:, x])[0]
        if len(candidates) == 0:
            continue
        # Prefer central candidates to avoid labels and borders.
        center = height / 2
        y = candidates[np.argmin(np.abs(candidates - center))]
        ys[x] = y
    valid = np.isfinite(ys)
    if valid.mean() < 0.2:
        return None
    xs = np.arange(width)
    ys = np.interp(xs, xs[valid], ys[valid])
    window = min(51, width - 1 if (width - 1) % 2 == 1 else width - 2)
    if window >= 7:
        ys = savgol_filter(ys, window_length=window, polyorder=2)
    # Invert y so upward deflection is positive.
    return -(ys - np.median(ys))


def _normalize_trace(trace: np.ndarray) -> np.ndarray:
    spread = np.percentile(trace, 95) - np.percentile(trace, 5)
    if spread <= 1e-6:
        return trace * 0
    return (trace - np.median(trace)) / spread


def _digitization_quality(signal: np.ndarray, peaks: np.ndarray) -> float:
    amplitude = float(np.percentile(signal, 95) - np.percentile(signal, 5))
    noise = float(np.std(np.diff(signal)))
    peak_score = min(1.0, len(peaks) / 6)
    return round(max(0.0, min(1.0, amplitude / (1 + noise) * peak_score)), 3)


def _estimate_qrs_ms(signal: np.ndarray, peaks: np.ndarray, pixels_per_second: float) -> int | None:
    durations = []
    threshold = 0.18
    window = int(0.16 * pixels_per_second)
    for peak in peaks[:12]:
        left = peak
        while left > max(0, peak - window) and abs(signal[left]) > threshold:
            left -= 1
        right = peak
        while right < min(len(signal) - 1, peak + window) and abs(signal[right]) > threshold:
            right += 1
        duration_ms = (right - left) / pixels_per_second * 1000
        if 40 <= duration_ms <= 220:
            durations.append(duration_ms)
    return int(round(float(np.median(durations)))) if durations else None


def _st_screen(signal: np.ndarray, peaks: np.ndarray, pixels_per_second: float) -> dict:
    values = []
    j_offset = int(0.08 * pixels_per_second)
    baseline_offset = int(0.16 * pixels_per_second)
    for peak in peaks[:12]:
        st_idx = peak + j_offset
        base_idx = peak - baseline_offset
        if 0 <= base_idx < len(signal) and 0 <= st_idx < len(signal):
            values.append(float(signal[st_idx] - signal[base_idx]))
    if not values:
        return {"status": "insufficient_beats", "possible_st_elevation": False}
    median_delta = float(np.median(values))
    possible = median_delta > 0.18
    return {
        "status": "possible_st_elevation_requires_physician_review" if possible else "no_st_screen_flag",
        "possible_st_elevation": possible,
        "median_st_delta_screen": round(median_delta, 3),
        "method": "unvalidated image digitization ST screen",
    }
