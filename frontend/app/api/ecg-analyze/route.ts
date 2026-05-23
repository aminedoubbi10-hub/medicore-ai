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

    const pass1 = await runGeminiJson("pass1", SYSTEM_PROMPT, imageBase64, mediaType, pass1Prompt, 1600);

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

    const pass2 = await runGeminiJson("pass2", VERIFY_SYSTEM, imageBase64, mediaType, pass2Prompt, 900);

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

async function runGeminiJson(
  mode: "pass1" | "pass2",
  system: string,
  imageBase64: string,
  mediaType: string,
  prompt: string,
  maxTokens: number
) {
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
        responseSchema: mode === "pass1" ? PASS1_SCHEMA : PASS2_SCHEMA,
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
    const repaired = await repairGeminiJson(mode, text);
    if (repaired) return repaired;
    return mode === "pass1" ? safePass1FromText(text) : safePass2FromText(text);
  }
}

async function repairGeminiJson(mode: "pass1" | "pass2", rawText: string) {
  const schema = mode === "pass1" ? PASS1_SCHEMA : PASS2_SCHEMA;
  const target = mode === "pass1" ? "ECG pass 1 interpretation JSON" : "ECG pass 2 verification JSON";
  const response = await fetch(`${GEMINI_API_URL}/${GEMINI_MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      systemInstruction: {
        parts: [
          {
            text: "Convert the supplied ECG verifier text into the requested JSON object. Do not add measurements or findings that are not present. Use null, empty arrays, unknown, or low confidence when uncertain. Return JSON only.",
          },
        ],
      },
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Target: ${target}\n\nRaw Gemini ECG text:\n${compactGeminiText(rawText)}`,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: mode === "pass1" ? 1600 : 900,
        responseMimeType: "application/json",
        responseSchema: schema,
      },
    }),
  });

  if (!response.ok) return null;

  const payload = await response.json();
  const text = (payload.candidates?.[0]?.content?.parts || [])
    .map((part: any) => part.text || "")
    .join("")
    .replace(/```json|```/g, "")
    .trim();

  try {
    return parseJsonPayload(text);
  } catch {
    return null;
  }
}

function safePass1FromText(text: string) {
  const summary = compactGeminiText(text);
  return {
    rate: { ventricular_bpm: null, atrial_bpm: null },
    rhythm: {
      classification: "unable_to_confirm_from_picture",
      regularity: "unknown",
      origin: "unknown",
    },
    axis: { qrs_axis_degrees: null, axis_label: "indeterminate" },
    intervals: { PR_ms: null, QRS_ms: null, QT_ms: null, QTc_ms: null },
    waveform: {
      p_wave: "Unable to verify safely from Gemini non-JSON output.",
      qrs_complex: "Unable to measure safely from Gemini non-JSON output.",
      st_segment: {
        elevation_leads: [],
        depression_leads: [],
        description: "Unable to convert Gemini output into structured ST findings safely.",
      },
      t_wave: "Unable to verify safely from Gemini non-JSON output.",
      u_wave: null,
    },
    lead_findings: emptyLeadFindings("Not structured by Gemini; physician review required."),
    interpretation: summary || "Gemini reviewed the ECG picture but did not return structured JSON. Treat as unable to interpret safely.",
    differential_diagnoses: [],
    critical_findings: [],
    confidence: "low",
    confidence_reason: "Gemini returned non-JSON output, so measurements and findings were not accepted as structured clinical data.",
    recommended_action: "Review the uploaded ECG picture manually and confirm with a physician/cardiologist.",
    image_quality: "poor",
    safety_note: "AI-assisted picture review only. Not a definitive ECG diagnosis.",
    parser_status: "gemini_non_json_fallback",
    raw_gemini_text: summary,
  };
}

function safePass2FromText(text: string) {
  const summary = compactGeminiText(text);
  return {
    agreement: "partial",
    verified_findings: [],
    corrections: ["Gemini verification returned non-JSON text, so no structured corrections were accepted."],
    additional_findings: [],
    final_confidence: "low",
    summary: summary || "Gemini verification was not returned in structured format. Physician review is required.",
    requires_physician_review: true,
    parser_status: "gemini_non_json_fallback",
    raw_gemini_text: summary,
  };
}

function emptyLeadFindings(value: string) {
  return {
    I: value,
    II: value,
    III: value,
    aVR: value,
    aVL: value,
    aVF: value,
    V1: value,
    V2: value,
    V3: value,
    V4: value,
    V5: value,
    V6: value,
  };
}

function compactGeminiText(text: string) {
  return text.replace(/\s+/g, " ").trim().slice(0, 1200);
}

const PASS1_SCHEMA = {
  type: "object",
  properties: {
    rate: {
      type: "object",
      properties: {
        ventricular_bpm: { type: "number", nullable: true },
        atrial_bpm: { type: "number", nullable: true },
      },
      required: ["ventricular_bpm", "atrial_bpm"],
    },
    rhythm: {
      type: "object",
      properties: {
        classification: { type: "string" },
        regularity: {
          type: "string",
          enum: ["regular", "irregular", "regularly_irregular", "irregularly_irregular", "unknown"],
        },
        origin: {
          type: "string",
          enum: ["sinus", "atrial", "junctional", "ventricular", "paced", "unknown"],
        },
      },
      required: ["classification", "regularity", "origin"],
    },
    axis: {
      type: "object",
      properties: {
        qrs_axis_degrees: { type: "number", nullable: true },
        axis_label: {
          type: "string",
          enum: ["normal", "left_deviation", "right_deviation", "extreme_right", "indeterminate"],
        },
      },
      required: ["qrs_axis_degrees", "axis_label"],
    },
    intervals: {
      type: "object",
      properties: {
        PR_ms: { type: "number", nullable: true },
        QRS_ms: { type: "number", nullable: true },
        QT_ms: { type: "number", nullable: true },
        QTc_ms: { type: "number", nullable: true },
      },
      required: ["PR_ms", "QRS_ms", "QT_ms", "QTc_ms"],
    },
    waveform: {
      type: "object",
      properties: {
        p_wave: { type: "string" },
        qrs_complex: { type: "string" },
        st_segment: {
          type: "object",
          properties: {
            elevation_leads: { type: "array", items: { type: "string" } },
            depression_leads: { type: "array", items: { type: "string" } },
            description: { type: "string" },
          },
          required: ["elevation_leads", "depression_leads", "description"],
        },
        t_wave: { type: "string" },
        u_wave: { type: "string", nullable: true },
      },
      required: ["p_wave", "qrs_complex", "st_segment", "t_wave", "u_wave"],
    },
    lead_findings: {
      type: "object",
      properties: {
        I: { type: "string" },
        II: { type: "string" },
        III: { type: "string" },
        aVR: { type: "string" },
        aVL: { type: "string" },
        aVF: { type: "string" },
        V1: { type: "string" },
        V2: { type: "string" },
        V3: { type: "string" },
        V4: { type: "string" },
        V5: { type: "string" },
        V6: { type: "string" },
      },
      required: ["I", "II", "III", "aVR", "aVL", "aVF", "V1", "V2", "V3", "V4", "V5", "V6"],
    },
    interpretation: { type: "string" },
    differential_diagnoses: { type: "array", items: { type: "string" } },
    critical_findings: { type: "array", items: { type: "string" } },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
    confidence_reason: { type: "string" },
    recommended_action: { type: "string" },
    image_quality: { type: "string", enum: ["good", "acceptable", "poor"] },
    safety_note: { type: "string" },
  },
  required: [
    "rate",
    "rhythm",
    "axis",
    "intervals",
    "waveform",
    "lead_findings",
    "interpretation",
    "differential_diagnoses",
    "critical_findings",
    "confidence",
    "confidence_reason",
    "recommended_action",
    "image_quality",
    "safety_note",
  ],
};

const PASS2_SCHEMA = {
  type: "object",
  properties: {
    agreement: { type: "string", enum: ["full", "partial", "disagree"] },
    verified_findings: { type: "array", items: { type: "string" } },
    corrections: { type: "array", items: { type: "string" } },
    additional_findings: { type: "array", items: { type: "string" } },
    final_confidence: { type: "string", enum: ["high", "medium", "low"] },
    summary: { type: "string" },
    requires_physician_review: { type: "boolean" },
  },
  required: [
    "agreement",
    "verified_findings",
    "corrections",
    "additional_findings",
    "final_confidence",
    "summary",
    "requires_physician_review",
  ],
};

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
