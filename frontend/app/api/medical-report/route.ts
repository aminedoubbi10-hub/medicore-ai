import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const REQUESTED_GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const GEMINI_MODEL_FALLBACKS = Array.from(new Set([REQUESTED_GEMINI_MODEL, "gemini-2.5-flash", "gemini-2.0-flash"]));
const REPORT_PROMPT_VERSION = "medical_report_composer_v1.1";

type UploadedFile = {
  name: string;
  mediaType: string;
  base64: string;
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const mode = String(body.mode || "generate");
    const files = Array.isArray(body.files) ? body.files as UploadedFile[] : [];
    const extractedText = String(body.extractedText || "");
    const labsText = String(body.labsText || "");
    const clinicalContext = String(body.clinicalContext || "");
    const documentType = String(body.documentType || "mixed");
    const language = String(body.language || "en");

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({
        success: false,
        error: "GEMINI_API_KEY is not configured in Vercel.",
      }, { status: 200 });
    }

    if (mode === "extract") {
      if (!files.length) {
        return NextResponse.json({ success: false, error: "Upload at least one file." }, { status: 400 });
      }
      const result = await runGeminiText({
        system: OCR_SYSTEM,
        prompt: extractionPrompt(documentType),
        files,
        maxTokens: 2200,
      });
      return NextResponse.json({
        success: true,
        model: result.model,
        extractedText: result.text,
        trace: buildTrace({ model: result.model, documentType, files, mode: "extract" }),
      });
    }

    const result = await runGeminiText({
      system: REPORT_SYSTEM,
      prompt: reportPrompt({ extractedText, labsText, clinicalContext, documentType, language }),
      files,
      maxTokens: 2800,
    });

    return NextResponse.json({
      success: true,
      model: result.model,
      reportText: cleanReportText(result.text),
      trace: buildTrace({ model: result.model, documentType, files, mode: "generate" }),
    });
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: err?.message || "Unable to generate medical report safely.",
    }, { status: 200 });
  }
}

async function runGeminiText({
  system,
  prompt,
  files,
  maxTokens,
}: {
  system: string;
  prompt: string;
  files: UploadedFile[];
  maxTokens: number;
}) {
  const errors: string[] = [];

  for (const model of GEMINI_MODEL_FALLBACKS) {
    try {
      const response = await fetch(`${GEMINI_API_URL}/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [
            {
              role: "user",
              parts: [
                ...files.slice(0, 4).map((file) => ({
                  inlineData: {
                    mimeType: file.mediaType,
                    data: file.base64,
                  },
                })),
                { text: prompt },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: maxTokens,
          },
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error?.message || "Gemini request failed");
      }

      const text = (payload.candidates?.[0]?.content?.parts || [])
        .map((part: any) => part.text || "")
        .join("\n")
        .trim();

      if (!text) throw new Error("Gemini returned empty output");
      return { model, text };
    } catch (err: any) {
      errors.push(`${model}: ${err?.message || "request failed"}`);
      if (!/quota|rate.?limit|free_tier|limit: 0|not found|not supported|model/i.test(err?.message || "")) {
        break;
      }
    }
  }

  throw new Error(errors.join(" | ") || "Gemini request failed");
}

function extractionPrompt(documentType: string) {
  return `Extract clinically relevant readable text and visible findings from the uploaded ${documentType} document.

Tasks:
- OCR visible text, measurements, dates, labels, lab values, ECG/radiology phrases, and impression sections.
- For ECG/radiology images, describe only visible high-level observations; do not invent measurements.
- If unreadable, state exactly what is unreadable.
- Return plain text only with short headings.`;
}

function reportPrompt({
  extractedText,
  labsText,
  clinicalContext,
  documentType,
  language,
}: {
  extractedText: string;
  labsText: string;
  clinicalContext: string;
  documentType: string;
  language: string;
}) {
  return `Create an editable physician-facing medical report draft in ${language}.

Document type: ${documentType}
Clinical context:
${clinicalContext || "Not provided"}

Extracted document/OCR text:
${extractedText || "No OCR text provided. If files are attached, inspect them directly."}

Lab results text:
${labsText || "No lab values provided."}

Use this report template and keep these headings:
${templateFor(documentType)}

Requirements:
- Write a concise structured report with professional headings.
- Include ECG, lab, radiology/scanner/report interpretation paragraphs when information is present.
- Interpret lab values with units and reference-range caution if supplied; flag critical values conservatively.
- For ECG: include rhythm/rate/interval/ST-T only if visible or supplied; otherwise say unable to assess safely.
- For scanner/radiology: distinguish findings, impression, and recommendation; require radiologist confirmation.
- Add one short integrated conclusion paragraph.
- Be medically conservative.
- State uncertainty clearly.
- Do not invent findings, measurements, diagnoses, or normality.
- Mention physician/radiologist/cardiologist confirmation when relevant.
- If the source is insufficient, say "insufficient data for safe interpretation".
- Do not claim FDA/CE validation.
- Return plain text only, no markdown table.`;
}

function templateFor(documentType: string) {
  if (documentType === "ecg") {
    return `AI-ASSISTED ECG REPORT DRAFT
Clinical context
Source quality / limitations
ECG interpretation
Safety flags / urgent review considerations
Conclusion
Required physician validation`;
  }
  if (documentType === "labs") {
    return `AI-ASSISTED LAB INTERPRETATION DRAFT
Clinical context
Reported laboratory values
Abnormal / critical values
Interpretive paragraph
Conclusion
Required physician validation`;
  }
  if (documentType === "xray" || documentType === "scanner") {
    return `AI-ASSISTED RADIOLOGY / SCANNER REPORT DRAFT
Clinical context
Technique / source quality
Findings
Impression
Recommendation
Conclusion
Required radiologist validation`;
  }
  return `AI-ASSISTED MEDICAL REPORT DRAFT
Clinical context
Source documents reviewed
Extracted findings
ECG paragraph, if present
Laboratory paragraph, if present
Radiology / scanner paragraph, if present
Integrated conclusion
Required physician validation`;
}

function buildTrace({
  model,
  documentType,
  files,
  mode,
}: {
  model: string;
  documentType: string;
  files: UploadedFile[];
  mode: string;
}) {
  return {
    request_id: crypto.randomUUID(),
    generated_at: new Date().toISOString(),
    mode,
    prompt_version: REPORT_PROMPT_VERSION,
    requested_model: REQUESTED_GEMINI_MODEL,
    model_used: model,
    document_type: documentType,
    file_count: files.length,
    file_names: files.map((file) => file.name),
    safety_policy: "draft_only_requires_physician_validation_no_fabricated_findings",
  };
}

function cleanReportText(text: string) {
  return text
    .replace(/```[\s\S]*?```/g, (match) => match.replace(/```/g, ""))
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const OCR_SYSTEM = `You are a medical OCR and document extraction assistant.
Extract readable clinical text and visible findings without inventing missing details.
You are not making a definitive diagnosis.`;

const REPORT_SYSTEM = `You are a medical report drafting assistant for clinicians.
Use only the supplied uploaded document content, OCR text, lab text, and clinical context.
Never fabricate clinical findings. Prefer uncertainty over false confidence.
All outputs are draft clinical decision-support text requiring physician validation.`;
