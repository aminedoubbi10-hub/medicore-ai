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

LEAD_ORDER = ["I", "II", "III", "aVR", "aVL", "aVF", "V1", "V2", "V3", "V4", "V5", "V6"]

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
    prepared = _prepare_ecg_image(image_gray)
    working_image = prepared["image"]
    quality_assessment = _assess_image_quality(working_image, prepared)
    calibration = _detect_grid_calibration(working_image)
    lead_regions, layout_detection = _detect_best_lead_layout(working_image, calibration)
    lead_screens = {}
    for lead_name, crop in lead_regions.items():
        lead_screens[lead_name] = _screen_single_trace(crop, calibration)

    usable = {
        lead: screen
        for lead, screen in lead_screens.items()
        if screen.get("image_screen_status") == "image_waveform_screen_completed"
    }
    representative_lead = "II" if "II" in usable else next(iter(usable), None)
    representative = usable.get(representative_lead) if representative_lead else None
    st_summary = _territory_st_summary(lead_screens)
    aggregate = _aggregate_lead_measurements(lead_screens)

    if not representative:
        return {
            "image_screen_status": "unable_to_digitize_trace",
            "estimated_heart_rate_bpm": None,
            "rr_regular": None,
            "qrs_duration_ms_estimate": None,
            "st_screen": {"status": "unable_to_screen", "possible_st_elevation": False},
            "digitization_quality": 0.0,
            "lead_screens": lead_screens,
            "lead_layout": layout_detection["selected_layout"],
            "layout_detection": layout_detection,
            "calibration": calibration,
            "image_quality": quality_assessment,
            "preprocessing": prepared["metadata"],
            "aggregate_measurements": aggregate,
            "lead_segmentation_quality": _lead_segmentation_quality(lead_screens),
        }

    return {
        **representative,
        "estimated_heart_rate_bpm": aggregate.get("estimated_heart_rate_bpm") or representative.get("estimated_heart_rate_bpm"),
        "rr_regular": aggregate.get("rr_regular") if aggregate.get("rr_regular") is not None else representative.get("rr_regular"),
        "rr_variability_ratio": aggregate.get("rr_variability_ratio") or representative.get("rr_variability_ratio"),
        "qrs_duration_ms_estimate": aggregate.get("qrs_duration_ms_estimate") or representative.get("qrs_duration_ms_estimate"),
        "representative_lead": representative_lead,
        "lead_screens": lead_screens,
        "lead_layout": layout_detection["selected_layout"],
        "layout_detection": layout_detection,
        "calibration": calibration,
        "image_quality": quality_assessment,
        "preprocessing": prepared["metadata"],
        "aggregate_measurements": aggregate,
        "lead_segmentation_quality": _lead_segmentation_quality(lead_screens),
        "st_screen": st_summary,
    }


def _screen_single_trace(image_gray: np.ndarray, calibration: dict | None = None) -> dict:
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
    peaks, polarity = _detect_qrs_candidates(signal, width)
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

    calibration = calibration or {}
    if calibration.get("pixels_per_second"):
        pixels_per_second = float(calibration["pixels_per_second"])
        timing_source = "detected_grid_spacing"
        assumed_seconds = round(width / pixels_per_second, 2)
    else:
        # Fallback for cropped lead panels where the grid cannot be detected.
        assumed_seconds = 2.5
        pixels_per_second = width / assumed_seconds
        timing_source = "assumed_2_5_second_lead_panel"
    rr_pixels = np.diff(peaks)
    rr_seconds = rr_pixels / pixels_per_second
    estimated_hr = int(round(60 / float(np.median(rr_seconds)))) if len(rr_seconds) else None
    rr_variability = float(np.std(rr_seconds) / np.mean(rr_seconds)) if len(rr_seconds) > 1 else None
    rr_regular = bool(rr_variability is not None and rr_variability < 0.12)
    qrs_ms = _estimate_qrs_ms(signal, peaks, pixels_per_second)
    st_screen = _st_screen(signal, peaks, pixels_per_second)
    pixels_per_mv = float(calibration["pixels_per_mv"]) if calibration.get("pixels_per_mv") else None
    median_beat = _median_beat_features(signal, peaks, pixels_per_second)
    morphology = _lead_morphology(signal, peaks, trace, pixels_per_mv)

    return {
        "image_screen_status": "image_waveform_screen_completed",
        "estimated_heart_rate_bpm": estimated_hr,
        "rr_regular": rr_regular,
        "rr_variability_ratio": round(rr_variability, 3) if rr_variability is not None else None,
        "qrs_duration_ms_estimate": qrs_ms,
        "st_screen": st_screen,
        "qrs_polarity": polarity,
        "median_beat": median_beat,
        "morphology": morphology,
        "digitization_quality": quality,
        "assumptions": {
            "visible_strip_seconds": assumed_seconds,
            "paper_speed": calibration.get("paper_speed", "assumed 25 mm/s"),
            "calibration": calibration.get("status", "not_detected"),
            "timing_source": timing_source,
            "lead": "single extracted trace; lead identity unknown",
        },
    }


def _detect_best_lead_layout(image_gray: np.ndarray, calibration: dict) -> tuple[dict[str, np.ndarray], dict]:
    candidates = [
        ("standard_3x4_with_optional_rhythm_strip", _segment_3x4(image_gray)),
        ("six_by_two", _segment_grid(image_gray, rows=6, cols=2, labels=LEAD_ORDER)),
        ("stacked_12_lead", _segment_grid(image_gray, rows=12, cols=1, labels=LEAD_ORDER)),
    ]

    scored = []
    best_name = candidates[0][0]
    best_regions = candidates[0][1]
    best_score = -1.0
    for name, regions in candidates:
        score = _layout_candidate_score(regions, calibration)
        scored.append({"layout": name, **score})
        numeric_score = float(score["score"])
        if numeric_score > best_score:
            best_score = numeric_score
            best_name = name
            best_regions = regions

    return best_regions, {
        "selected_layout": best_name,
        "layout_confidence": round(max(0.0, min(1.0, best_score)), 3),
        "candidates": scored,
    }


def _segment_3x4(image_gray: np.ndarray) -> dict[str, np.ndarray]:
    height, width = image_gray.shape[:2]
    y0, y1 = int(height * 0.08), int(height * 0.78)
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
    rhythm_y0 = int(height * 0.78)
    rhythm_y1 = int(height * 0.96)
    rhythm = image_gray[rhythm_y0:rhythm_y1, x0:x1]
    if rhythm.size and rhythm.shape[0] > 40 and rhythm.shape[1] > 400:
        regions["rhythm_strip"] = rhythm
    return regions


def _segment_grid(image_gray: np.ndarray, *, rows: int, cols: int, labels: list[str]) -> dict[str, np.ndarray]:
    height, width = image_gray.shape[:2]
    y0, y1 = int(height * 0.06), int(height * 0.94)
    x0, x1 = int(width * 0.04), int(width * 0.96)
    usable = image_gray[y0:y1, x0:x1]
    h, w = usable.shape[:2]
    row_h = h // rows
    col_w = w // cols
    regions = {}
    label_idx = 0
    for row_idx in range(rows):
        for col_idx in range(cols):
            if label_idx >= len(labels):
                break
            ys = row_idx * row_h
            ye = h if row_idx == rows - 1 else (row_idx + 1) * row_h
            xs = col_idx * col_w
            xe = w if col_idx == cols - 1 else (col_idx + 1) * col_w
            crop = usable[ys:ye, xs:xe]
            if crop.size:
                regions[labels[label_idx]] = crop
            label_idx += 1
    return regions


def _layout_candidate_score(regions: dict[str, np.ndarray], calibration: dict) -> dict:
    usable = 0
    qualities = []
    for crop in regions.values():
        screen = _screen_single_trace(crop, calibration)
        quality = float(screen.get("digitization_quality", 0) or 0)
        qualities.append(quality)
        if screen.get("image_screen_status") == "image_waveform_screen_completed":
            usable += 1
    expected = len([lead for lead in regions if lead != "rhythm_strip"]) or 1
    usable_ratio = usable / expected
    mean_quality = float(np.mean(qualities)) if qualities else 0.0
    score = 0.65 * usable_ratio + 0.35 * mean_quality
    return {
        "score": round(float(score), 3),
        "usable_lead_count": int(usable),
        "region_count": int(len(regions)),
        "mean_digitization_quality": round(mean_quality, 3),
    }


def _prepare_ecg_image(image_gray: np.ndarray) -> dict:
    """Normalize ECG image for downstream grid/trace extraction."""
    import cv2

    img = image_gray
    if img.ndim == 3:
        img = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    img = img.astype(np.uint8)

    height, width = img.shape[:2]
    scale = 1.0
    target_width = 1800
    if width < target_width:
        scale = target_width / max(width, 1)
        img = cv2.resize(img, (target_width, int(height * scale)), interpolation=cv2.INTER_CUBIC)
    elif width > 2600:
        scale = 2600 / width
        img = cv2.resize(img, (2600, int(height * scale)), interpolation=cv2.INTER_AREA)

    normalized = cv2.normalize(img, None, 0, 255, cv2.NORM_MINMAX)
    denoised = cv2.bilateralFilter(normalized, 5, 35, 35)
    deskewed, angle = _deskew_image(denoised)
    cropped = _crop_content(deskewed)

    return {
        "image": cropped,
        "metadata": {
            "original_shape": [int(height), int(width)],
            "processed_shape": [int(cropped.shape[0]), int(cropped.shape[1])],
            "resize_scale": round(float(scale), 3),
            "deskew_angle_degrees": round(float(angle), 2),
            "contrast_normalized": True,
            "denoised": True,
        },
    }


def _deskew_image(image_gray: np.ndarray) -> tuple[np.ndarray, float]:
    import cv2

    edges = cv2.Canny(image_gray, 60, 180)
    lines = cv2.HoughLinesP(
        edges,
        rho=1,
        theta=np.pi / 180,
        threshold=max(80, image_gray.shape[1] // 25),
        minLineLength=max(80, image_gray.shape[1] // 8),
        maxLineGap=12,
    )
    if lines is None:
        return image_gray, 0.0

    angles = []
    for line in lines[:, 0]:
        x1, y1, x2, y2 = line
        angle = np.degrees(np.arctan2(y2 - y1, x2 - x1))
        if -12 <= angle <= 12:
            angles.append(angle)
    if not angles:
        return image_gray, 0.0

    angle = float(np.median(angles))
    if abs(angle) < 0.4:
        return image_gray, angle

    h, w = image_gray.shape[:2]
    matrix = cv2.getRotationMatrix2D((w / 2, h / 2), angle, 1.0)
    rotated = cv2.warpAffine(
        image_gray,
        matrix,
        (w, h),
        flags=cv2.INTER_LINEAR,
        borderMode=cv2.BORDER_REPLICATE,
    )
    return rotated, angle


def _crop_content(image_gray: np.ndarray) -> np.ndarray:
    img = image_gray.astype(np.uint8)
    threshold = min(245, int(np.percentile(img, 96)))
    mask = img < threshold
    rows = np.where(mask.mean(axis=1) > 0.01)[0]
    cols = np.where(mask.mean(axis=0) > 0.01)[0]
    if len(rows) < 20 or len(cols) < 20:
        return image_gray
    y0, y1 = max(0, rows[0] - 12), min(img.shape[0], rows[-1] + 13)
    x0, x1 = max(0, cols[0] - 12), min(img.shape[1], cols[-1] + 13)
    return image_gray[y0:y1, x0:x1]


def _assess_image_quality(image_gray: np.ndarray, prepared: dict) -> dict:
    import cv2

    h, w = image_gray.shape[:2]
    laplacian_var = float(cv2.Laplacian(image_gray, cv2.CV_64F).var())
    darkness = 255 - image_gray.astype(np.float32)
    dark_pixel_ratio = float((image_gray < np.percentile(image_gray, 12)).mean())
    contrast = float(np.std(image_gray) / 255)
    grid = _detect_grid_calibration(image_gray)
    lead_label_score = _lead_label_presence_score(image_gray)

    resolution_score = min(1.0, (w * h) / (1400 * 900))
    blur_score = min(1.0, laplacian_var / 140)
    contrast_score = min(1.0, contrast * 5)
    trace_density_score = 1.0 if 0.01 <= dark_pixel_ratio <= 0.22 else max(0.0, 1.0 - abs(dark_pixel_ratio - 0.08) * 8)
    grid_score = 1.0 if grid.get("status") == "detected_grid_spacing" else 0.35
    rotation_penalty = min(0.35, abs(float(prepared["metadata"].get("deskew_angle_degrees", 0))) / 35)

    score = (
        0.24 * resolution_score
        + 0.18 * blur_score
        + 0.18 * contrast_score
        + 0.18 * trace_density_score
        + 0.14 * grid_score
        + 0.08 * lead_label_score
        - rotation_penalty
    )
    score = round(max(0.0, min(1.0, score)), 3)

    warnings = []
    if resolution_score < 0.45:
        warnings.append("low_resolution")
    if blur_score < 0.35:
        warnings.append("blur_or_soft_focus")
    if grid.get("status") != "detected_grid_spacing":
        warnings.append("grid_not_reliably_detected")
    if lead_label_score < 0.25:
        warnings.append("lead_labels_not_reliably_detected")
    if trace_density_score < 0.35:
        warnings.append("trace_density_outside_expected_range")

    if score >= 0.72:
        status = "good_for_preliminary_image_screening"
    elif score >= 0.45:
        status = "limited_but_screenable"
    else:
        status = "poor_quality_interpret_with_caution"

    return {
        "status": status,
        "quality_score": score,
        "resolution_score": round(float(resolution_score), 3),
        "blur_score": round(float(blur_score), 3),
        "contrast_score": round(float(contrast_score), 3),
        "trace_density_score": round(float(trace_density_score), 3),
        "grid_score": round(float(grid_score), 3),
        "lead_label_score": round(float(lead_label_score), 3),
        "warnings": warnings,
    }


def _lead_label_presence_score(image_gray: np.ndarray) -> float:
    # Lightweight OCR-free proxy: lead labels create compact dark components near
    # the left edge of each expected panel. This avoids claiming label identity.
    import cv2

    h, w = image_gray.shape[:2]
    left_band = image_gray[:, : max(20, int(w * 0.18))]
    _, binary = cv2.threshold(left_band, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(binary, 8)
    components = 0
    for idx in range(1, num_labels):
        x, y, cw, ch, area = stats[idx]
        if 6 <= cw <= 80 and 8 <= ch <= 80 and 15 <= area <= 900:
            components += 1
    return round(float(min(1.0, components / 10)), 3)


def _detect_grid_calibration(image_gray: np.ndarray) -> dict:
    """Estimate ECG paper scale from recurring grid lines if visible."""
    img = image_gray.astype(np.float32)
    darkness = 255.0 - img
    vertical_projection = darkness.mean(axis=0)
    horizontal_projection = darkness.mean(axis=1)
    x_spacing = _dominant_grid_spacing(vertical_projection)
    y_spacing = _dominant_grid_spacing(horizontal_projection)

    if not x_spacing and not y_spacing:
        return {
            "status": "not_detected",
            "paper_speed": "assumed 25 mm/s",
            "pixels_per_second": None,
            "pixels_per_mv": None,
        }

    # ECG paper has small 1 mm boxes and large 5 mm boxes. If detected spacing
    # is large, infer small-box spacing by dividing by 5.
    small_x = _small_box_spacing(x_spacing) if x_spacing else None
    small_y = _small_box_spacing(y_spacing) if y_spacing else None
    pixels_per_second = small_x * 25 if small_x else None
    pixels_per_mv = small_y * 10 if small_y else None

    return {
        "status": "detected_grid_spacing",
        "paper_speed": "25 mm/s assumed after grid detection",
        "detected_x_spacing_px": round(float(x_spacing), 2) if x_spacing else None,
        "detected_y_spacing_px": round(float(y_spacing), 2) if y_spacing else None,
        "small_box_x_px": round(float(small_x), 2) if small_x else None,
        "small_box_y_px": round(float(small_y), 2) if small_y else None,
        "pixels_per_second": round(float(pixels_per_second), 2) if pixels_per_second else None,
        "pixels_per_mv": round(float(pixels_per_mv), 2) if pixels_per_mv else None,
    }


def _dominant_grid_spacing(projection: np.ndarray) -> float | None:
    projection = projection.astype(float)
    if len(projection) < 80:
        return None
    projection = (projection - np.mean(projection)) / (np.std(projection) + 1e-6)
    peaks, _ = find_peaks(projection, distance=5, prominence=0.2)
    if len(peaks) < 4:
        return None
    spacings = np.diff(peaks)
    spacings = spacings[(spacings >= 6) & (spacings <= 120)]
    if len(spacings) == 0:
        return None
    hist, edges = np.histogram(spacings, bins=30)
    idx = int(np.argmax(hist))
    if hist[idx] == 0:
        return None
    return float((edges[idx] + edges[idx + 1]) / 2)


def _small_box_spacing(spacing: float) -> float:
    return spacing / 5 if spacing >= 25 else spacing


def _lead_segmentation_quality(lead_screens: dict[str, dict]) -> float:
    if not lead_screens:
        return 0.0
    usable = [
        screen
        for screen in lead_screens.values()
        if screen.get("image_screen_status") == "image_waveform_screen_completed"
    ]
    digitization = [float(screen.get("digitization_quality", 0)) for screen in usable]
    usable_ratio = len(usable) / len(lead_screens)
    quality = usable_ratio * (float(np.mean(digitization)) if digitization else 0)
    return round(max(0.0, min(1.0, quality)), 3)


def _aggregate_lead_measurements(lead_screens: dict[str, dict]) -> dict:
    usable = {
        lead: screen
        for lead, screen in lead_screens.items()
        if screen.get("image_screen_status") == "image_waveform_screen_completed"
    }
    if not usable:
        return {
            "usable_lead_count": 0,
            "estimated_heart_rate_bpm": None,
            "rr_regular": None,
            "qrs_duration_ms_estimate": None,
            "axis_screen": {"status": "unable_to_screen"},
            "r_wave_progression_screen": {"status": "unable_to_screen"},
            "low_voltage_screen": {"status": "unable_to_screen"},
            "measurement_consistency": "no_usable_leads",
        }

    rate_values = [
        int(screen["estimated_heart_rate_bpm"])
        for screen in usable.values()
        if screen.get("estimated_heart_rate_bpm") is not None
    ]
    qrs_values = [
        int(screen["qrs_duration_ms_estimate"])
        for screen in usable.values()
        if screen.get("qrs_duration_ms_estimate") is not None
    ]
    rr_values = [
        bool(screen["rr_regular"])
        for screen in usable.values()
        if screen.get("rr_regular") is not None
    ]
    rr_variability_values = [
        float(screen["rr_variability_ratio"])
        for screen in usable.values()
        if screen.get("rr_variability_ratio") is not None
    ]

    rhythm_strip = usable.get("rhythm_strip", {})
    if rhythm_strip.get("estimated_heart_rate_bpm") is not None:
        rate = int(rhythm_strip["estimated_heart_rate_bpm"])
        rate_source = "rhythm_strip"
    elif rate_values:
        rate = int(round(float(np.median(rate_values))))
        rate_source = "median_usable_leads"
    else:
        rate = None
        rate_source = "unavailable"

    if rhythm_strip.get("rr_regular") is not None:
        rr_regular = bool(rhythm_strip["rr_regular"])
        rr_source = "rhythm_strip"
    elif rr_values:
        rr_regular = sum(rr_values) >= max(1, len(rr_values) / 2)
        rr_source = "majority_usable_leads"
    else:
        rr_regular = None
        rr_source = "unavailable"

    rate_spread = int(max(rate_values) - min(rate_values)) if len(rate_values) > 1 else 0
    qrs_spread = int(max(qrs_values) - min(qrs_values)) if len(qrs_values) > 1 else 0
    if rate_spread > 35 or qrs_spread > 60:
        consistency = "low_consistency_between_leads"
    elif len(usable) < 4:
        consistency = "limited_lead_count"
    else:
        consistency = "acceptable_screening_consistency"

    return {
        "usable_lead_count": len(usable),
        "usable_leads": sorted(usable.keys()),
        "estimated_heart_rate_bpm": rate,
        "heart_rate_source": rate_source,
        "heart_rate_range_bpm": [min(rate_values), max(rate_values)] if rate_values else None,
        "rr_regular": rr_regular,
        "rr_regular_source": rr_source,
        "rr_variability_ratio": round(float(np.median(rr_variability_values)), 3) if rr_variability_values else None,
        "rhythm_irregularity_screen": _rhythm_irregularity_screen(rr_variability_values, rr_regular),
        "qrs_duration_ms_estimate": int(round(float(np.median(qrs_values)))) if qrs_values else None,
        "qrs_duration_range_ms": [min(qrs_values), max(qrs_values)] if qrs_values else None,
        "bundle_branch_block_screen": _bundle_branch_block_screen(usable, qrs_values),
        "axis_screen": _axis_screen(usable),
        "r_wave_progression_screen": _r_wave_progression_screen(usable),
        "low_voltage_screen": _low_voltage_screen(usable),
        "st_pattern_screen": _st_pattern_screen(usable),
        "measurement_consistency": consistency,
    }


def _rhythm_irregularity_screen(rr_variability_values: list[float], rr_regular: bool | None) -> dict:
    if not rr_variability_values:
        return {"status": "unable_to_screen"}
    variability = float(np.median(rr_variability_values))
    if rr_regular is True and variability < 0.08:
        status = "regular_rr_pattern"
    elif variability >= 0.2:
        status = "markedly_irregular_rr_pattern"
    elif variability >= 0.12:
        status = "mildly_irregular_rr_pattern"
    else:
        status = "borderline_rr_variability"
    return {
        "status": status,
        "median_rr_variability_ratio": round(variability, 3),
        "method": "image-derived RR interval variability",
    }


def _bundle_branch_block_screen(usable: dict[str, dict], qrs_values: list[int]) -> dict:
    if not qrs_values:
        return {"status": "unable_to_screen"}
    qrs_ms = int(round(float(np.median(qrs_values))))
    v1 = _lead_net_deflection(usable.get("V1"))
    v6 = _lead_net_deflection(usable.get("V6"))
    if qrs_ms < 120:
        return {"status": "no_wide_qrs_screen_flag", "qrs_ms": qrs_ms}
    if v1 is None or v6 is None:
        return {
            "status": "wide_qrs_untyped",
            "qrs_ms": qrs_ms,
            "reason": "V1_or_V6_unavailable",
        }
    if v1 > 0 and v6 < 0:
        status = "possible_rbbb_pattern_screen"
    elif v1 < 0 and v6 > 0:
        status = "possible_lbbb_pattern_screen"
    else:
        status = "wide_qrs_non_specific_pattern_screen"
    return {
        "status": status,
        "qrs_ms": qrs_ms,
        "v1_net_deflection": round(float(v1), 3),
        "v6_net_deflection": round(float(v6), 3),
        "method": "wide QRS plus image-derived V1/V6 net deflection",
    }


def _st_pattern_screen(usable: dict[str, dict]) -> dict:
    deltas = {}
    for lead, screen in usable.items():
        value = screen.get("st_screen", {}).get("median_st_delta_screen")
        if value is not None and lead != "rhythm_strip":
            deltas[lead] = float(value)
    if not deltas:
        return {"status": "unable_to_screen"}

    elevated = {lead for lead, value in deltas.items() if value > 0.18}
    depressed = {lead for lead, value in deltas.items() if value < -0.18}
    reciprocal_pairs = []
    if elevated.intersection({"II", "III", "aVF"}) and depressed.intersection({"I", "aVL"}):
        reciprocal_pairs.append("inferior_elevation_with_lateral_depression")
    if elevated.intersection({"V1", "V2", "V3", "V4"}) and depressed.intersection({"II", "III", "aVF"}):
        reciprocal_pairs.append("anterior_elevation_with_inferior_depression")
    if elevated.intersection({"I", "aVL", "V5", "V6"}) and depressed.intersection({"II", "III", "aVF"}):
        reciprocal_pairs.append("lateral_elevation_with_inferior_depression")

    return {
        "status": "reciprocal_st_pattern_screen" if reciprocal_pairs else "no_reciprocal_st_pattern_screen",
        "elevated_leads": sorted(elevated),
        "depressed_leads": sorted(depressed),
        "reciprocal_patterns": reciprocal_pairs,
        "st_delta_by_lead": {lead: round(value, 3) for lead, value in deltas.items()},
        "method": "image-derived ST delta pattern comparison",
    }


def _territory_st_summary(lead_screens: dict[str, dict]) -> dict:
    possible_leads = {
        lead
        for lead, screen in lead_screens.items()
        if screen.get("st_screen", {}).get("possible_st_elevation")
    }
    depression_leads = {
        lead
        for lead, screen in lead_screens.items()
        if screen.get("st_screen", {}).get("possible_st_depression")
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
        "possible_st_depression_leads": sorted(depression_leads),
        "possible_territories": territories,
        "method": "unvalidated multi-lead image digitization ST screen",
    }


def _detect_qrs_candidates(signal: np.ndarray, width: int) -> tuple[np.ndarray, str]:
    distance = max(10, width // 14)
    positive_peaks, positive_props = find_peaks(signal, distance=distance, prominence=0.25)
    negative_peaks, negative_props = find_peaks(-signal, distance=distance, prominence=0.25)

    positive_score = float(np.sum(positive_props.get("prominences", []))) if len(positive_peaks) else 0.0
    negative_score = float(np.sum(negative_props.get("prominences", []))) if len(negative_peaks) else 0.0

    if negative_score > positive_score * 1.15:
        return negative_peaks, "predominantly_negative"
    if positive_score > 0:
        return positive_peaks, "predominantly_positive"
    return np.array([], dtype=int), "undetermined"


def _axis_screen(usable: dict[str, dict]) -> dict:
    lead_i = _lead_net_deflection(usable.get("I"))
    avf = _lead_net_deflection(usable.get("aVF"))
    if lead_i is None or avf is None:
        return {"status": "unable_to_screen", "reason": "lead_I_or_aVF_unavailable"}

    if lead_i >= 0 and avf >= 0:
        quadrant = "normal_axis_quadrant"
        flag = None
    elif lead_i >= 0 and avf < 0:
        quadrant = "possible_left_axis_deviation_quadrant"
        flag = "possible_left_axis_deviation_screen"
    elif lead_i < 0 and avf >= 0:
        quadrant = "possible_right_axis_deviation_quadrant"
        flag = "possible_right_axis_deviation_screen"
    else:
        quadrant = "extreme_axis_quadrant"
        flag = "possible_extreme_axis_screen"

    return {
        "status": quadrant,
        "lead_i_net_deflection": round(float(lead_i), 3),
        "avf_net_deflection": round(float(avf), 3),
        "flag": flag,
        "method": "image-derived net QRS deflection in I and aVF",
    }


def _r_wave_progression_screen(usable: dict[str, dict]) -> dict:
    values = []
    for lead in ["V1", "V2", "V3", "V4", "V5", "V6"]:
        amplitude = _lead_r_amplitude(usable.get(lead))
        if amplitude is not None:
            values.append((lead, amplitude))
    if len(values) < 4:
        return {"status": "unable_to_screen", "reason": "insufficient_precordial_leads", "values": values}

    lead_to_amp = dict(values)
    early = max(lead_to_amp.get("V1", 0), lead_to_amp.get("V2", 0))
    late = max(lead_to_amp.get("V5", 0), lead_to_amp.get("V6", 0))
    v3_v4 = max(lead_to_amp.get("V3", 0), lead_to_amp.get("V4", 0))
    poor = late <= early * 1.15 and v3_v4 <= early * 1.2
    return {
        "status": "possible_poor_r_wave_progression" if poor else "no_poor_r_wave_progression_screen_flag",
        "possible_poor_r_wave_progression": bool(poor),
        "r_amplitude_by_lead": {lead: round(float(value), 3) for lead, value in values},
        "method": "relative image-derived R amplitude trend V1-V6",
    }


def _low_voltage_screen(usable: dict[str, dict]) -> dict:
    limb = ["I", "II", "III", "aVR", "aVL", "aVF"]
    precordial = ["V1", "V2", "V3", "V4", "V5", "V6"]
    limb_values = [_lead_qrs_amplitude_mv(usable.get(lead)) for lead in limb]
    precordial_values = [_lead_qrs_amplitude_mv(usable.get(lead)) for lead in precordial]
    limb_values = [value for value in limb_values if value is not None]
    precordial_values = [value for value in precordial_values if value is not None]
    if len(limb_values) < 4 and len(precordial_values) < 4:
        return {"status": "unable_to_screen", "reason": "calibrated_amplitudes_unavailable"}

    limb_low = len(limb_values) >= 4 and max(limb_values) < 0.5
    precordial_low = len(precordial_values) >= 4 and max(precordial_values) < 1.0
    possible = limb_low or precordial_low
    return {
        "status": "possible_low_voltage" if possible else "no_low_voltage_screen_flag",
        "possible_low_voltage": bool(possible),
        "max_limb_qrs_mv": round(max(limb_values), 3) if limb_values else None,
        "max_precordial_qrs_mv": round(max(precordial_values), 3) if precordial_values else None,
        "method": "image-derived amplitude with detected grid calibration",
    }


def _lead_net_deflection(screen: dict | None) -> float | None:
    if not screen:
        return None
    morphology = screen.get("morphology") or {}
    value = morphology.get("median_qrs_amplitude")
    return float(value) if value is not None else None


def _lead_r_amplitude(screen: dict | None) -> float | None:
    if not screen:
        return None
    morphology = screen.get("morphology") or {}
    value = morphology.get("median_positive_qrs_amplitude")
    return float(value) if value is not None else None


def _lead_qrs_amplitude_mv(screen: dict | None) -> float | None:
    if not screen:
        return None
    morphology = screen.get("morphology") or {}
    value = morphology.get("qrs_peak_to_peak_mv")
    return float(value) if value is not None else None


def _lead_morphology(signal: np.ndarray, peaks: np.ndarray, raw_trace: np.ndarray, pixels_per_mv: float | None) -> dict:
    if len(peaks) == 0:
        return {
            "net_qrs_deflection": None,
            "median_qrs_amplitude": None,
            "baseline_wander_score": None,
        }

    amplitudes = []
    positive_amplitudes = []
    peak_to_peak_pixels = []
    local_baselines = []
    for peak in peaks[:12]:
        left = max(0, peak - 20)
        right = min(len(signal), peak + 21)
        baseline_left = max(0, peak - 70)
        baseline_right = max(0, peak - 35)
        local = signal[left:right]
        baseline_region = signal[baseline_left:baseline_right]
        if len(local) and len(baseline_region):
            baseline = float(np.median(baseline_region))
            amplitudes.append(float(signal[peak] - baseline))
            positive_amplitudes.append(float(max(0, np.max(local) - baseline)))
            raw_local = raw_trace[left:right]
            if len(raw_local):
                peak_to_peak_pixels.append(float(np.percentile(raw_local, 95) - np.percentile(raw_local, 5)))
            local_baselines.append(baseline)

    if not amplitudes:
        return {
            "net_qrs_deflection": None,
            "median_qrs_amplitude": None,
            "baseline_wander_score": None,
        }

    median_amp = float(np.median(amplitudes))
    if median_amp > 0.12:
        net = "positive"
    elif median_amp < -0.12:
        net = "negative"
    else:
        net = "isoelectric_or_low_amplitude"

    wander = float(np.std(local_baselines)) if local_baselines else None
    qrs_ptp_px = float(np.median(peak_to_peak_pixels)) if peak_to_peak_pixels else None
    qrs_ptp_mv = (qrs_ptp_px / pixels_per_mv) if qrs_ptp_px is not None and pixels_per_mv else None
    return {
        "net_qrs_deflection": net,
        "median_qrs_amplitude": round(median_amp, 3),
        "median_positive_qrs_amplitude": round(float(np.median(positive_amplitudes)), 3) if positive_amplitudes else None,
        "qrs_peak_to_peak_px": round(qrs_ptp_px, 3) if qrs_ptp_px is not None else None,
        "qrs_peak_to_peak_mv": round(qrs_ptp_mv, 3) if qrs_ptp_mv is not None else None,
        "baseline_wander_score": round(wander, 3) if wander is not None else None,
    }


def _median_beat_features(signal: np.ndarray, peaks: np.ndarray, pixels_per_second: float) -> dict:
    pre = int(0.24 * pixels_per_second)
    post = int(0.44 * pixels_per_second)
    beats = []
    for peak in peaks[:16]:
        start = peak - pre
        end = peak + post
        if start >= 0 and end <= len(signal):
            beats.append(signal[start:end])
    if len(beats) < 2:
        return {"status": "insufficient_beats"}

    beat_matrix = np.vstack(beats)
    median = np.median(beat_matrix, axis=0)
    qrs_center = pre
    baseline_start = max(0, qrs_center - int(0.2 * pixels_per_second))
    baseline_end = max(1, qrs_center - int(0.12 * pixels_per_second))
    baseline = float(np.median(median[baseline_start:baseline_end]))

    p_window = median[max(0, qrs_center - int(0.22 * pixels_per_second)):max(1, qrs_center - int(0.08 * pixels_per_second))]
    t_window = median[
        min(len(median), qrs_center + int(0.12 * pixels_per_second)):
        min(len(median), qrs_center + int(0.4 * pixels_per_second))
    ]
    p_amp = float(np.max(p_window) - baseline) if len(p_window) else None
    t_amp = float(np.max(t_window) - baseline) if len(t_window) else None
    t_inversion = bool(t_amp is not None and abs(float(np.min(t_window) - baseline)) > max(0.12, (t_amp or 0) * 1.2)) if len(t_window) else None

    return {
        "status": "median_beat_computed",
        "beat_count": len(beats),
        "p_wave_visible_screen": bool(p_amp is not None and p_amp > 0.08),
        "t_wave_visible_screen": bool(t_amp is not None and abs(t_amp) > 0.08),
        "possible_t_wave_inversion_screen": t_inversion,
        "median_p_amplitude": round(p_amp, 3) if p_amp is not None else None,
        "median_t_amplitude": round(t_amp, 3) if t_amp is not None else None,
        "method": "median beat from image-derived QRS candidates",
    }


def _extract_trace(image_gray: np.ndarray) -> np.ndarray | None:
    import cv2

    img = image_gray.astype(np.uint8)
    enhanced = cv2.equalizeHist(img)
    threshold = min(135, int(np.percentile(enhanced, 10)))
    mask = enhanced < threshold
    kernel = np.ones((2, 2), np.uint8)
    mask = cv2.morphologyEx(mask.astype(np.uint8), cv2.MORPH_OPEN, kernel).astype(bool)
    height, width = img.shape[:2]
    ys = np.full(width, np.nan)
    previous_y = None
    for x in range(width):
        candidates = np.where(mask[:, x])[0]
        if len(candidates) == 0:
            continue
        # Prefer continuity once a trace has been found; otherwise use the
        # central band to avoid labels and panel borders.
        center = previous_y if previous_y is not None else height / 2
        y = candidates[np.argmin(np.abs(candidates - center))]
        ys[x] = y
        previous_y = y
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
    possible_depression = median_delta < -0.18
    return {
        "status": (
            "possible_st_elevation_requires_physician_review"
            if possible
            else "possible_st_depression_requires_physician_review"
            if possible_depression
            else "no_st_screen_flag"
        ),
        "possible_st_elevation": possible,
        "possible_st_depression": possible_depression,
        "median_st_delta_screen": round(median_delta, 3),
        "method": "unvalidated image digitization ST screen",
    }
