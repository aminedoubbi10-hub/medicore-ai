import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

const SYSTEM_PROMPT = `You are an ECG clinical decision-support verifier.
You are NOT a replacement for a cardiologist and you must not claim definitive diagnosis.
Use the ECG picture only to produce conservative, structured screening observations.
If the image is low quality, lead labels are unclear, calibration is absent, or measurements are not visible, return null values and low confidence.
Never fabricate PR/QRS/QT/QTc, rhythm, axis, or ST measurements.
Your entire response must be one JSON object. Do not include markdown, code fences, comments, explanations, or text before/after JSON.
Return ONLY valid JSON with this shape:
{
  "rate": { "ventricular_bpm": number_or_null, "atrial_bpm": number_or_null },
  "rhythm": { "classification": string, "regularity": "regular|irregular|regularly_irregular|irregularly_irregular|unknown", "origin": "sinus|atrial|junctional|ventricular|paced|unknown" },
  "axis": { "qrs_axis_degrees": number_or_null, "axis_label": "normal|left_deviation|right_deviation|extreme_right|indeterminate" },
  "intervals": { "PR_ms": number_or_null, "QRS_ms": number_or_null, "QT_ms": number_or_null, "QTc_ms": number_or_null },
  "waveform": {
    "p_wave": string,
    "qrs_complex": string,
    "st_segment": { "elevation_leads": [], "depression_leads": [], "description": string },
    "t_wave": string,
    "u_wave": string_or_null
  },
  "lead_findings": {
    "I": string, "II": string, "III": string,
    "aVR": string, "aVL": string, "aVF": string,
    "V1": string, "V2": string, "V3": string,
    "V4": string, "V5": string, "V6": string
  },
  "interpretation": string,
  "differential_diagnoses": [string],
  "critical_findings": [string],
  "confidence": "high|medium|low",
  "confidence_reason": string,
  "recommended_action": string,
  "image_quality": "good|acceptable|poor",
  "safety_note": string
}`;

const VERIFY_SYSTEM = `You are a second independent ECG clinical decision-support verifier.
Review conservatively, identify disagreements, and return ONLY valid JSON.
Do not provide definitive diagnosis; require physician validation.
Your entire response must be one JSON object. Do not include markdown, code fences, comments, explanations, or text before/after JSON.`;

export async function POST(req: NextRequest) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({
        enabled: false,
        error: "Gemini visual AI is not configured. Add GEMINI_API_KEY in Vercel.",
      });
    }

    const body = await req.json();
    const imageBase64 = String(body.imageBase64 || "");
    const mediaType = String(body.mediaType || "image/jpeg");
    const clinicalContext = String(body.clinicalContext || "").slice(0, 1000);

    if (!imageBase64) {
      return NextResponse.json({ error: "imageBase64 is required" }, { status: 400 });
    }
    if (!["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif"].includes(mediaType)) {
      return NextResponse.json({
        error: "Gemini visual verification supports ECG pictures only: JPG, PNG, WEBP, GIF, HEIC, or HEIF. PDFs still use the backend pipeline.",
      }, { status: 415 });
    }

    const pass1Prompt = `Perform a conservative ECG screening read from this ECG picture. Clinical context: ${clinicalContext || "not provided"}.
Estimate visible heart rate, rhythm regularity, QRS width, visible ST-segment concerns, lead-by-lead observations, and image quality only when the picture supports it.
If the picture does not support a measurement, return null or "unable to assess safely".
Return only JSON.`;

    const pass1 = await runGeminiJson(SYSTEM_PROMPT, imageBase64, mediaType, pass1Prompt, 1600);

    const pass2Prompt = `A first pass returned this JSON:\n${JSON.stringify(pass1, null, 2)}\n\nIndependently verify it and return ONLY JSON:
{
  "agreement": "full|partial|disagree",
  "verified_findings": [string],
  "corrections": [string],
  "additional_findings": [string],
  "final_confidence": "high|medium|low",
  "summary": string,
  "requires_physician_review": true
}`;

    const pass2 = await runGeminiJson(VERIFY_SYSTEM, imageBase64, mediaType, pass2Prompt, 900);

    return NextResponse.json({
      enabled: true,
      provider: "gemini",
      model: GEMINI_MODEL,
      pass1,
      pass2,
      safety: {
        ai_assisted: true,
        diagnostic_status: "visual_llm_screen_requires_cardiologist_review",
        requires_physician_review: true,
        limitation: "This route is a visual AI verifier only. It does not replace deterministic preprocessing, validated ECG software, or physician interpretation.",
      },
    });
  } catch (err: any) {
    return NextResponse.json({
      enabled: false,
      error: err?.message || "ECG visual verification failed safely.",
    }, { status: 200 });
  }
}

async function runGeminiJson(system: string, imageBase64: string, mediaType: string, prompt: string, maxTokens: number) {
  const response = await fetch(`${GEMINI_API_URL}/${GEMINI_MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: system }],
      },
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType: mediaType,
                data: imageBase64,
              },
            },
            { text: prompt },
          ],
        },
      ],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: maxTokens,
        responseMimeType: "application/json",
      },
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error?.message || "Gemini ECG verifier request failed");
  }

  const text = (payload.candidates?.[0]?.content?.parts || [])
    .map((part: any) => part.text || "")
    .join("")
    .replace(/```json|```/g, "")
    .trim();

  try {
    return parseJsonPayload(text);
  } catch {
    throw new Error("Gemini ECG verifier returned non-JSON output");
  }
}

function parseJsonPayload(text: string) {
  const cleaned = text
    .replace(/```json|```/g, "")
    .replace(/^\s*JSON\s*:/i, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const objectText = extractFirstJsonObject(cleaned);
    if (!objectText) throw new Error("No JSON object found");
    return JSON.parse(objectText);
  }
}

function extractFirstJsonObject(text: string) {
  const start = text.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const char = text[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;

    if (depth === 0) {
      return text.slice(start, index + 1);
    }
  }

  return null;
}
