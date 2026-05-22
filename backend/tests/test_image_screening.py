import asyncio

import cv2
import numpy as np

from app.ai.ecg_pipeline import ECGPipeline
from app.ai.xray_pipeline import XRayPipeline


def test_ecg_image_returns_preliminary_screen(tmp_path):
    img = np.full((400, 800), 245, dtype=np.uint8)
    for x in range(20, 780, 40):
        cv2.line(img, (x, 0), (x, 399), 220, 1)
    for y in range(20, 380, 40):
        cv2.line(img, (0, y), (799, y), 220, 1)
    points = np.array([[20, 200], [120, 200], [150, 80], [180, 320], [220, 200], [780, 200]])
    cv2.polylines(img, [points], False, 0, 3)
    path = tmp_path / "ecg.png"
    cv2.imwrite(str(path), img)

    result = asyncio.run(ECGPipeline().analyze(str(path)))

    assert result["diagnostic_status"] == "preliminary_image_screen_requires_review"
    assert result["requires_physician_review"] is True
    assert result["confidence"] == 25
    assert "estimated_heart_rate_bpm" in result["measurements"]
    assert "rr_regular" in result["measurements"]
    assert "qrs_duration_ms_estimate" in result["measurements"]
    assert "st_screen" in result["measurements"]
    assert "calibration" in result["measurements"]["image_waveform_screen"]
    assert "lead_segmentation_quality" in result["measurements"]["image_waveform_screen"]


def test_xray_image_returns_local_review_screen(tmp_path):
    img = np.full((512, 512, 3), 90, dtype=np.uint8)
    cv2.circle(img, (190, 260), 110, (150, 150, 150), -1)
    cv2.circle(img, (330, 260), 110, (120, 120, 120), -1)
    path = tmp_path / "xray.png"
    cv2.imwrite(str(path), img)

    result = asyncio.run(XRayPipeline().analyze(str(path)))

    assert result["diagnostic_status"] in {"model_screen_requires_review", "uncertain_requires_review"}
    assert result["requires_physician_review"] is True
    assert result["model_result"]["model_name"] == "local_unvalidated_cxr_image_screen"
