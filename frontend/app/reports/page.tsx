'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Clipboard, FileImage, FileText, Loader2, Upload, Wand2 } from 'lucide-react';
import { toast } from 'sonner';

type ComposerFile = {
  file: File;
  preview: string | null;
  base64?: string;
  mediaType?: string;
};

const DOCUMENT_TYPES = [
  ['mixed', 'Any report'],
  ['ecg', 'ECG'],
  ['labs', 'Lab results'],
  ['xray', 'X-ray'],
  ['scanner', 'Scanner / CT / MRI'],
  ['consultation', 'Consultation note'],
];

export default function ReportsPage() {
  const [files, setFiles] = useState<ComposerFile[]>([]);
  const [documentType, setDocumentType] = useState('mixed');
  const [language, setLanguage] = useState('English');
  const [clinicalContext, setClinicalContext] = useState('');
  const [labsText, setLabsText] = useState('');
  const [extractedText, setExtractedText] = useState('');
  const [reportText, setReportText] = useState('');
  const [model, setModel] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [generating, setGenerating] = useState(false);

  const onDrop = useCallback(async (accepted: File[]) => {
    const prepared = await Promise.all(
      accepted.slice(0, 4).map(async (file) => ({
        file,
        preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
        ...(await fileToBase64(file)),
      }))
    );
    setFiles(prepared);
    setExtractedText('');
    setReportText('');
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.webp', '.heic', '.heif'],
      'application/pdf': ['.pdf'],
    },
    maxSize: 25 * 1024 * 1024,
    multiple: true,
  });

  const extract = async () => {
    if (!files.length) {
      toast.error('Upload a report, ECG, lab image, or scanner image first');
      return;
    }
    setExtracting(true);
    try {
      const data = await callReportRoute({
        mode: 'extract',
        files: files.map(toPayloadFile),
        documentType,
      });
      if (!data.success) throw new Error(data.error || 'OCR extraction failed');
      setExtractedText(data.extractedText || '');
      setModel(data.model || '');
      toast.success('Text extracted');
    } catch (err: any) {
      toast.error(err.message || 'Unable to extract text');
    } finally {
      setExtracting(false);
    }
  };

  const generate = async () => {
    if (!files.length && !extractedText.trim() && !labsText.trim()) {
      toast.error('Upload a file, paste extracted text, or enter lab results');
      return;
    }
    setGenerating(true);
    try {
      const data = await callReportRoute({
        mode: 'generate',
        files: files.map(toPayloadFile),
        extractedText,
        labsText,
        clinicalContext,
        documentType,
        language,
      });
      if (!data.success) throw new Error(data.error || 'Report generation failed');
      setReportText(data.reportText || '');
      setModel(data.model || model);
      toast.success('Medical report draft generated');
    } catch (err: any) {
      toast.error(err.message || 'Unable to generate report');
    } finally {
      setGenerating(false);
    }
  };

  const copyReport = async () => {
    if (!reportText.trim()) {
      toast.error('No report to copy yet');
      return;
    }
    await navigator.clipboard.writeText(reportText);
    toast.success('Report copied');
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest font-bold" style={{ color: 'var(--accent)' }}>
            <FileText className="w-3.5 h-3.5" />
            AI medical report composer
          </div>
          <h2 className="mt-1 text-2xl font-black" style={{ fontFamily: 'Syne' }}>
            Upload, extract, interpret, and draft
          </h2>
          <p className="mt-1 text-sm max-w-3xl" style={{ color: 'var(--text2)' }}>
            Works with ECG pictures, lab result images, scanner/radiology reports, PDFs, and pasted values. The final report is editable and copyable.
          </p>
        </div>
        {model && (
          <div className="text-[11px] px-3 py-1.5 rounded-full" style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text3)' }}>
            Gemini model: {model}
          </div>
        )}
      </div>

      <div className="flex gap-2 p-3 rounded-xl text-xs"
        style={{ background: 'rgba(255,179,71,0.07)', border: '1px solid rgba(255,179,71,0.2)', color: '#ffb347' }}>
        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <span><strong>Draft only.</strong> AI can misread OCR, ECG, lab units, and imaging findings. Review and edit before sharing or signing.</span>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[430px_minmax(0,1fr)] gap-5">
        <div className="space-y-4">
          <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="flex items-center gap-2 text-sm font-semibold mb-4">
              <Upload className="w-4 h-4" style={{ color: 'var(--accent)' }} />
              Upload clinical file
            </div>

            <div {...getRootProps()} className="rounded-xl p-8 text-center cursor-pointer transition-all"
              style={{
                border: `2px dashed ${isDragActive ? 'var(--accent)' : files.length ? '#00e5a0' : 'var(--border2)'}`,
                background: isDragActive ? 'rgba(0,212,255,0.03)' : files.length ? 'rgba(0,229,160,0.03)' : 'var(--bg3)',
              }}>
              <input {...getInputProps()} />
              <Upload className="w-10 h-10 mx-auto mb-3" style={{ color: files.length ? '#00e5a0' : 'var(--text3)' }} />
              <p className="text-sm font-medium mb-1">{files.length ? `${files.length} file(s) ready` : 'Drop files or click to browse'}</p>
              <p className="text-xs" style={{ color: 'var(--text3)' }}>Images or PDF · ECG, labs, radiology, scanner reports</p>
            </div>

            {files.length > 0 && (
              <div className="mt-4 space-y-2">
                {files.map((item) => (
                  <div key={item.file.name} className="rounded-lg overflow-hidden" style={{ background: 'var(--bg3)', border: '1px solid var(--border)' }}>
                    <div className="px-3 py-2 flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 truncate">
                        {item.preview ? <FileImage className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
                        {item.file.name}
                      </span>
                      <span style={{ color: 'var(--text3)' }}>{Math.round(item.file.size / 1024)} KB</span>
                    </div>
                    {item.preview && <img src={item.preview} alt={item.file.name} className="w-full max-h-56 object-contain" style={{ background: '#07101f' }} />}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl p-5 space-y-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Document type">
                <select value={documentType} onChange={(e) => setDocumentType(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text)' }}>
                  {DOCUMENT_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </Field>
              <Field label="Language">
                <select value={language} onChange={(e) => setLanguage(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text)' }}>
                  {['English', 'French', 'Arabic'].map((item) => <option key={item}>{item}</option>)}
                </select>
              </Field>
            </div>

            <Field label="Clinical context">
              <textarea value={clinicalContext} onChange={(e) => setClinicalContext(e.target.value)} rows={3}
                placeholder="Age, symptoms, reason for exam, relevant history..."
                className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none"
                style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text)' }} />
            </Field>

            <Field label="Lab results / values paragraph">
              <textarea value={labsText} onChange={(e) => setLabsText(e.target.value)} rows={4}
                placeholder="Example: Hb 10.2 g/dL, WBC 14k, CRP 85, creatinine 1.8, troponin negative..."
                className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none"
                style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text)' }} />
            </Field>

            <div className="grid grid-cols-2 gap-2">
              <button onClick={extract} disabled={extracting || !files.length}
                className="py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                style={{ background: 'var(--surface2)', border: '1px solid var(--border2)', color: 'var(--text)' }}>
                {extracting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                OCR extraction
              </button>
              <button onClick={generate} disabled={generating}
                className="py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg,var(--accent2),#005588)', color: 'white' }}>
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                Generate medical report
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <Panel title="OCR / extracted clinical text">
            <textarea value={extractedText} onChange={(e) => setExtractedText(e.target.value)} rows={10}
              placeholder="OCR text and extracted findings will appear here. You can edit before generating the report."
              className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-y"
              style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text)', fontFamily: 'DM Mono' }} />
          </Panel>

          <Panel title="Editable final medical report">
            <AnimatePresence mode="wait">
              {(extracting || generating) && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="mb-3 flex items-center gap-2 text-sm" style={{ color: 'var(--accent)' }}>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {generating ? 'Generating physician-facing draft...' : 'Extracting readable clinical text...'}
                </motion.div>
              )}
            </AnimatePresence>
            <textarea value={reportText} onChange={(e) => setReportText(e.target.value)} rows={18}
              placeholder="Generated medical report will appear here and remains fully editable."
              className="w-full rounded-lg px-3 py-3 text-sm outline-none resize-y leading-relaxed"
              style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text)' }} />
            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={copyReport}
                className="px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5"
                style={{ background: 'var(--surface2)', border: '1px solid var(--border2)', color: 'var(--text2)' }}>
                <Clipboard className="w-3.5 h-3.5" />
                Copy report
              </button>
              <button onClick={generate} disabled={generating}
                className="px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg,var(--accent2),#005588)', color: 'white' }}>
                <Wand2 className="w-3.5 h-3.5" />
                Regenerate
              </button>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs mb-1.5" style={{ color: 'var(--text2)' }}>{label}</label>
      {children}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="flex items-center gap-2 text-sm font-semibold mb-4">
        <FileText className="w-4 h-4" style={{ color: 'var(--accent)' }} />
        {title}
      </div>
      {children}
    </div>
  );
}

async function callReportRoute(payload: any) {
  const res = await fetch('/api/medical-report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
}

function toPayloadFile(item: ComposerFile) {
  return {
    name: item.file.name,
    mediaType: item.mediaType || item.file.type || 'application/octet-stream',
    base64: item.base64 || '',
  };
}

function fileToBase64(file: File): Promise<{ base64: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const [header, base64] = result.split(',');
      resolve({
        base64,
        mediaType: header.replace('data:', '').replace(';base64', '') || file.type,
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
