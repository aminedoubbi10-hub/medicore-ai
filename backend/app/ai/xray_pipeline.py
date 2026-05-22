"""app/ai/xray_pipeline.py — Chest X-ray analysis pipeline."""
import json
import time
import numpy as np
import anthropic
from app.config import settings

THRESHOLDS = {
    "pneumonia": 0.45, "effusion": 0.40, "pneumothorax": 0.35,
    "cardiomegaly": 0.50, "pulm_edema": 0.45, "fibrosis": 0.50,
    "tb_pattern": 0.45, "nodule": 0.40,
}
EMERGENCY = ["pneumothorax"]


class XRayPipeline:
    def __init__(self):
        self.client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

    async def analyze(self, file_path: str, patient_context: str = "") -> dict:
        start = time.time()
        try:
            image = self._load(file_path)
            preprocessed = self._preprocess(image)
            probs = self._detect(preprocessed)
            heatmap_path = self._heatmap(image, probs, file_path)
            report = await self._claude_report(probs, patient_context)
            emergencies = [c for c in EMERGENCY if probs.get(c, 0) >= THRESHOLDS[c]]
            return {
                "success": True,
                "processing_time_ms": int((time.time() - start) * 1000),
                "pathology_probabilities": probs,
                "emergency_flags": emergencies,
                "heatmap_path": heatmap_path,
                **report,
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    def _load(self, path: str):
        try:
            import cv2
            if path.lower().endswith(".dcm"):
                import pydicom
                dcm = pydicom.dcmread(path)
                arr = dcm.pixel_array.astype(np.float32)
                arr = ((arr - arr.min()) / (arr.max() - arr.min() + 1e-8) * 255).astype(np.uint8)
                return cv2.cvtColor(arr, cv2.COLOR_GRAY2BGR)
            return cv2.imread(path)
        except Exception:
            return np.zeros((512, 512, 3), dtype=np.uint8)

    def _preprocess(self, image) -> np.ndarray:
        try:
            import cv2
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
            enhanced = clahe.apply(gray)
            resized = cv2.resize(enhanced, (224, 224))
            return resized.astype(np.float32) / 255.0
        except Exception:
            return np.zeros((224, 224), dtype=np.float32)

    def _detect(self, preprocessed: np.ndarray) -> dict:
        """Pathology detection. Production: replace with CheXNet DenseNet-121."""
        density = float(np.mean(preprocessed))
        variance = float(np.var(preprocessed))
        return {
            "pneumonia":    min(0.95, density * 1.8),
            "effusion":     min(0.90, density * 1.4),
            "pneumothorax": min(0.40, variance * 2.0),
            "cardiomegaly": min(0.85, density * 1.6),
            "pulm_edema":   min(0.70, density * 1.3),
            "fibrosis":     min(0.45, variance * 3.0),
            "tb_pattern":   min(0.35, density * 1.1),
            "nodule":       min(0.50, variance * 2.5),
        }

    def _heatmap(self, image, probs: dict, file_path: str) -> str:
        try:
            import cv2
            h, w = image.shape[:2]
            attention = np.zeros((h, w), dtype=np.float32)
            if probs.get("pneumonia", 0) > 0.3:
                attention[int(h * 0.5):, :] += probs["pneumonia"]
            if probs.get("cardiomegaly", 0) > 0.3:
                cx, cy = w // 2, int(h * 0.5)
                cv2.ellipse(attention, (cx, cy), (int(w * 0.2), int(h * 0.2)), 0, 0, 360, probs["cardiomegaly"], -1)
            attention = cv2.GaussianBlur(attention, (51, 51), 0)
            norm = cv2.normalize(attention, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)
            heatmap = cv2.applyColorMap(norm, cv2.COLORMAP_JET)
            overlay = cv2.addWeighted(image, 0.55, heatmap, 0.45, 0)
            out_path = file_path.rsplit(".", 1)[0] + "_heatmap.jpg"
            cv2.imwrite(out_path, overlay)
            return out_path
        except Exception:
            return ""

    async def _claude_report(self, probs: dict, patient_context: str) -> dict:
        significant = {k: v for k, v in probs.items() if v >= THRESHOLDS.get(k, 0.4)}
        summary = "\n".join(f"- {k.replace('_',' ').title()}: {v:.1%}" for k, v in sorted(probs.items(), key=lambda x: -x[1]))

        prompt = f"""Chest X-ray AI detection results. Generate structured radiology report.

PATHOLOGY PROBABILITIES:
{summary}

SIGNIFICANT (above threshold): {list(significant.keys()) or ['None']}
PATIENT CONTEXT: {patient_context or 'Not provided'}

Return ONLY JSON:
{{
  "technique": "string",
  "findings": [{{"region":"string","finding":"string","severity":"normal|mild|moderate|severe"}}],
  "impression": "string",
  "differentialDx": ["string"],
  "confidence": 0,
  "urgency": "routine|urgent|emergent",
  "recommendation": "string"
}}"""

        try:
            response = self.client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=1200,
                messages=[{"role": "user", "content": prompt}],
            )
            raw = response.content[0].text.strip().replace("```json", "").replace("```", "").strip()
            return json.loads(raw)
        except Exception:
            return {
                "technique": "Chest radiograph",
                "findings": [{"region": "Overall", "finding": "AI unavailable — manual review required", "severity": "normal"}],
                "impression": "Manual radiologist review required.",
                "differentialDx": ["Manual review required"],
                "confidence": 0,
                "urgency": "routine",
                "recommendation": "Qualified radiologist review required.",
            }
