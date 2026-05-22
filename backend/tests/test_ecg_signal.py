import math

import numpy as np

from app.ai.ecg_signal import measure_ecg_signal, parse_waveform_file


def test_parse_csv_waveform_and_measure_rate(tmp_path):
    sampling_rate = 500
    seconds = 10
    t = np.arange(0, seconds, 1 / sampling_rate)
    signal = np.zeros_like(t)
    for beat_time in np.arange(0.5, seconds, 1.0):
        signal += np.exp(-((t - beat_time) ** 2) / (2 * 0.01**2))

    path = tmp_path / "ecg.csv"
    path.write_text("lead_II\n" + "\n".join(f"{v:.6f}" for v in signal))

    parsed = parse_waveform_file(str(path))
    result = measure_ecg_signal(parsed)

    assert result["measurement_status"] == "measured_with_unvalidated_algorithm"
    assert 55 <= result["estimated_heart_rate_bpm"] <= 65
    assert result["r_peak_count"] >= 8
    assert result["rhythm_regular"] is True


def test_missing_waveform_returns_none(tmp_path):
    path = tmp_path / "empty.csv"
    path.write_text("")
    assert parse_waveform_file(str(path)) is None
