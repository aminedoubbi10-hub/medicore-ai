"""
tests/test_labs.py — Lab interpreter unit tests.
"""
import pytest
from app.ai.lab_interpreter import classify_value


def test_normal_wbc():
    result = classify_value("wbc", 7.0)
    assert result["status"] == "normal"


def test_high_wbc():
    result = classify_value("wbc", 15.0)
    assert result["status"] == "high"


def test_critical_high_wbc():
    result = classify_value("wbc", 35.0)
    assert result["status"] == "critical_high"


def test_critical_high_troponin():
    result = classify_value("troponin_i", 8.4)
    assert result["status"] == "critical_high"
    assert "CRITICAL" in result["flag"]


def test_normal_troponin():
    result = classify_value("troponin_i", 0.02)
    assert result["status"] == "normal"


def test_low_hemoglobin():
    result = classify_value("hemoglobin", 10.0)
    assert result["status"] == "low"


def test_critical_low_hemoglobin():
    result = classify_value("hemoglobin", 5.0)
    assert result["status"] == "critical_low"


def test_unknown_lab():
    result = classify_value("unknown_test", 100.0)
    assert result["status"] == "unknown"


def test_critical_potassium_high():
    result = classify_value("potassium", 7.0)
    assert result["status"] == "critical_high"


def test_normal_inr():
    result = classify_value("inr", 1.0)
    assert result["status"] == "normal"
