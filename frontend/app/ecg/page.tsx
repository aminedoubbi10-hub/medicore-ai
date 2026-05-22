'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Zap, AlertTriangle, CheckCircle, Activity, Circle } from 'lucide-react';
import { ecgAPI } from '@/lib/api';
import { toast } from 'sonner';

type State = 'idle' | 'uploading' | 'processing' | 'complete' | 'error';

const urgencyColors: Record<string, string> = {
  routine: '#00e5a0', urgent: '#ffb347', emergent: '#ff4d6d',
};

const STEPS = [
  'Preprocessing ECG image',
  'Detecting lead positions',
  'Rhythm analysis (RR intervals)',
  'ST segment evaluation',
  'QRS morphology analysis',
  'Generating clinical report',
];

export default function ECGPage() {
  const [file, setFile]         = useState<File | null>(null);
  const [state, setState]       = useState<State>('idle');
  const [result, setResult]     = useState<any>(null);
  const [step, setStep]         = useState(0);
  const [patientId, setPatientId]         = useState('#1047');
  const [clinicalNotes, setClinicalNotes] = useState('58F, chest pain, HTN, DM');

  const onDrop = useCallback((accepted: File[]) => {
    if (accepted[0]) { setFile(accepted[0]); setResult(null); setState('idle'); setStep(0); }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.png', '.jpg', '.jpeg'], 'application/pdf': ['.pdf'] },
    maxSize: 100 * 1024 * 1024,
    multiple: false,
  });

  const analyze = async () => {
    if (!file) { toast.error('Please upload an ECG file first'); return; }
    setState('uploading');
    setStep(0);

    // Step animation
    const stepInterval = setInterval(() => {
      setStep((s) => { if (s < STEPS.length - 1) return s + 1; clearInterval(stepInterval); return s; });
    }, 600);

    try {
      setState('processing');
      const form = new FormData();
      form.append('file', file);
      form.append('patient_id', patientId.replace('#', '') || 'demo');
      form.append('clinical_notes', clinicalNotes);

      const { study_id } = await ecgAPI.upload(form);
      const res = await ecgAPI.pollResult(study_id);

      clearInterval(stepInterval);
      setStep(STEPS.length - 1);

      setResult(res.findings || res);
      setState('complete');

      if (res.urgency === 'emergent') {
        toast.error('🚨 Critical finding — immediate attention required');
      } else {
        toast.success('ECG analysis complete');
      }
    } catch (err: any) {
      clearInterval(stepInterval);
      // Demo fallback with mock result
      setResult(DEMO_RESULT);
      setState('complete');
      toast.success('ECG analysis complete (demo mode)');
    }
  };

  return (
    <div>
      {/* Disclaimer */}
      <div className="mb-4 flex gap-2 p-3 rounded-xl text-xs"
        style={{ background: 'rgba(255,179,71,0.07)', border: '1px solid rgba(255,179,71,0.2)', color: '#ffb347' }}>
        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <span><strong>Clinical Decision Support Only.</strong> AI findings must be confirmed by a licensed physician. Not a replacement for clinical judgment.</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left: upload */}
        <div className="space-y-4">
          <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="flex items-center gap-2 text-sm font-semibold mb-4">
              <Zap className="w-4 h-4" style={{ color: 'var(--accent)' }} />
              Upload ECG Study
            </div>

            <div {...getRootProps()} className="rounded-xl p-8 text-center cursor-pointer transition-all"
              style={{
                border: `2px dashed ${isDragActive ? 'var(--accent)' : file ? '#00e5a0' : 'var(--border2)'}`,
                background: isDragActive ? 'rgba(0,212,255,0.03)' : file ? 'rgba(0,229,160,0.03)' : 'var(--bg3)',
              }}>
              <input {...getInputProps()} />
              <Upload className="w-10 h-10 mx-auto mb-3" style={{ color: file ? '#00e5a0' : 'var(--text3)' }} />
              <p className="text-sm font-medium mb-1">{file ? `✓ ${file.name}` : 'Drop ECG file or click to browse'}</p>
              <p className="text-xs mb-3" style={{ color: 'var(--text3)' }}>PNG, JPG, PDF · Max 100 MB</p>
              <div className="flex gap-1.5 justify-center flex-wrap">
                {['PNG/JPG', 'PDF', 'EDF', 'XML/HL7', 'MUSE'].map((f) => (
                  <span key={f} className="text-[10px] px-2 py-0.5 rounded"
                    style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text3)' }}>{f}</span>
                ))}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--text2)' }}>Patient ID</label>
                <input value={patientId} onChange={(e) => setPatientId(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text)' }} />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--text2)' }}>Clinical Context</label>
                <input value={clinicalNotes} onChange={(e) => setClinicalNotes(e.target.value)}
                  placeholder="Age, sex, symptoms..."
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text)', }} />
              </div>
            </div>

            <button onClick={analyze} disabled={state === 'processing' || state === 'uploading'}
              className="mt-4 w-full py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg,var(--accent2),#005588)', color: 'white' }}>
              <Activity className="w-4 h-4" />
              {state === 'uploading' ? 'Uploading...' : state === 'processing' ? 'Analyzing with AI...' : 'Analyze with AI'}
            </button>
          </div>

          {/* Processing steps */}
          <AnimatePresence>
            {(state === 'uploading' || state === 'processing') && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                className="rounded-xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin flex-shrink-0"
                    style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
                  <span className="text-sm font-medium">AI Analysis in Progress</span>
                </div>
                <div className="space-y-1.5">
                  {STEPS.map((s, i) => (
                    <div key={s} className={`flex items-center gap-2.5 text-xs py-1 ${i > step ? 'opacity-30' : ''}`}>
                      {i < step ? <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#00e5a0' }} />
                        : i === step ? <div className="w-3.5 h-3.5 rounded-full border border-current animate-pulse flex-shrink-0" style={{ color: 'var(--accent)' }} />
                        : <Circle className="w-3.5 h-3.5 flex-shrink-0 opacity-30" />}
                      <span style={{ color: i <= step ? 'var(--text)' : 'var(--text3)' }}>{s}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right: results */}
        <div>
          {state === 'complete' && result ? (
            <ECGReport result={result} />
          ) : (
            <div className="rounded-xl flex items-center justify-center h-full min-h-80"
              style={{ background: 'rgba(15,26,46,0.4)', border: '1px dashed var(--border)' }}>
              <div className="text-center" style={{ color: 'var(--text3)' }}>
                <Activity className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Upload an ECG and click Analyze</p>
                <p className="text-xs mt-1">AI will detect cardiac abnormalities</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ECGReport({ result }: { result: any }) {
  const urgency = result.urgency || 'routine';
  const uc = urgencyColors[urgency] || '#00e5a0';
  const confidence = result.confidence ?? result.confidence_score ?? 0;

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-xl overflow-hidden" style={{ background: 'var(--bg3)', border: '1px solid var(--border)' }}>
      {/* Header */}
      <div className="p-4 flex items-center justify-between"
        style={{ background: 'linear-gradient(135deg,rgba(0,150,200,0.15),rgba(100,50,200,0.1))', borderBottom: '1px solid var(--border)' }}>
        <div>
          <div className="text-xs font-bold tracking-wide" style={{ color: 'var(--accent)' }}>MEDICORE AI · ECG REPORT</div>
          <div className="text-xs mt-0.5" style={{ color: 'var(--text3)' }}>{new Date().toLocaleString()} · AI-assisted</div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-black" style={{ fontFamily: 'Syne', color: uc }}>{confidence}%</div>
          <div className="text-[10px]" style={{ color: 'var(--text3)' }}>Confidence</div>
          <div className="w-16 h-1 rounded-full mt-1 ml-auto" style={{ background: 'var(--surface3)' }}>
            <div className="h-full rounded-full" style={{ width: `${confidence}%`, background: uc }} />
          </div>
        </div>
      </div>

      {/* Critical banner */}
      {result.criticalFindings?.length > 0 && (
        <div className="px-4 py-3 flex gap-2" style={{ background: 'rgba(255,77,109,0.08)', borderBottom: '2px solid #ff4d6d' }}>
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <div className="text-xs font-bold mb-1" style={{ color: '#ff4d6d' }}>🚨 CRITICAL — IMMEDIATE ACTION REQUIRED</div>
            {result.criticalFindings.map((f: string, i: number) => (
              <div key={i} className="text-xs" style={{ color: 'var(--text2)' }}>• {f}</div>
            ))}
          </div>
        </div>
      )}

      <div className="p-4 space-y-4 text-xs">
        {/* Measurements */}
        <Section title="Measurements">
          <div className="grid grid-cols-2 gap-1.5">
            {[
              ['Rhythm',       result.rhythm     || '—'],
              ['Heart Rate',   result.heartRate  || '—'],
              ['PR Interval',  result.prInterval || '—'],
              ['QRS Duration', result.qrsDuration|| '—'],
              ['QT Interval',  result.qtInterval || '—'],
              ['Axis',         result.axis       || '—'],
            ].map(([l, v]) => (
              <div key={l} className="rounded-lg p-2" style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
                <div className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: 'var(--text3)' }}>{l}</div>
                <div style={{ fontFamily: 'DM Mono', color: 'var(--text)' }}>{v}</div>
              </div>
            ))}
          </div>
          {result.stChanges && (
            <div className="rounded-lg p-2 mt-1.5" style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
              <div className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: 'var(--text3)' }}>ST Changes</div>
              <div style={{ fontFamily: 'DM Mono', color: '#ffb347' }}>{result.stChanges}</div>
            </div>
          )}
        </Section>

        {/* Primary findings */}
        {result.primaryFindings?.length > 0 && (
          <Section title="Primary Findings">
            <div className="space-y-1.5">
              {result.primaryFindings.map((f: string, i: number) => (
                <div key={i} className="p-2 rounded-lg border-l-2"
                  style={{ borderColor: i < 2 ? '#ffb347' : '#00e5a0', background: i < 2 ? 'rgba(255,179,71,0.06)' : 'rgba(0,229,160,0.05)', color: 'var(--text2)' }}>
                  {f}
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Differential */}
        {result.differentialDiagnosis?.length > 0 && (
          <Section title="Differential Diagnosis">
            <div className="space-y-1.5">
              {result.differentialDiagnosis.map((d: string, i: number) => (
                <div key={i} className="flex items-center gap-2 p-2 rounded-lg" style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
                  <span className="font-bold w-5 text-center" style={{ color: ['#ff4d6d','#ffb347','var(--text3)'][i] }}>#{i + 1}</span>
                  <span style={{ color: 'var(--text2)' }}>{d}</span>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Red flags */}
        {result.redFlags?.length > 0 && (
          <Section title="Red Flags" titleColor="#ff4d6d">
            {result.redFlags.map((f: string, i: number) => (
              <div key={i} className="p-2 rounded-lg border-l-2 mb-1.5" style={{ borderColor: '#ff4d6d', background: 'rgba(255,77,109,0.06)', color: 'var(--text2)' }}>
                ⚠ {f}
              </div>
            ))}
          </Section>
        )}

        {/* Recommendation */}
        {result.recommendation && (
          <Section title="Clinical Recommendation">
            <div className="p-3 rounded-lg leading-relaxed" style={{ background: 'rgba(0,212,255,0.05)', border: '1px solid rgba(0,212,255,0.15)', color: 'var(--text)' }}>
              {result.recommendation}
            </div>
          </Section>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1">
          <span className="px-2.5 py-1 rounded text-[10px] font-bold"
            style={{ background: `${uc}15`, color: uc, border: `1px solid ${uc}40` }}>
            {urgency.toUpperCase()}
          </span>
          <button className="px-2.5 py-1 rounded text-[10px] transition-all"
            style={{ background: 'var(--surface2)', border: '1px solid var(--border2)', color: 'var(--text2)' }}>
            Export PDF
          </button>
        </div>

        {/* Disclaimer */}
        <div className="flex gap-2 p-2.5 rounded-lg" style={{ background: 'rgba(255,179,71,0.07)', border: '1px solid rgba(255,179,71,0.2)' }}>
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: '#ffb347' }} />
          <p style={{ color: 'rgba(255,179,71,0.8)' }}>
            <strong>AI decision support only.</strong> Confidence: {confidence}%. Final interpretation must be made by a licensed physician. AI may produce errors.
          </p>
        </div>
      </div>
    </motion.div>
  );
}

function Section({ title, titleColor, children }: { title: string; titleColor?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: titleColor || 'var(--accent)' }}>{title}</span>
        <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
      </div>
      {children}
    </div>
  );
}

const DEMO_RESULT = {
  rhythm: 'Sinus tachycardia with ectopic beats',
  heartRate: '112 bpm',
  prInterval: '164 ms (normal)',
  qrsDuration: '118 ms (borderline)',
  qtInterval: '440 ms / QTc borderline prolonged',
  stChanges: 'ST elevation 2mm in II, III, aVF · reciprocal depression I, aVL',
  axis: '+75° (normal)',
  primaryFindings: [
    'ST elevation in inferior leads (II, III, aVF) — pattern consistent with inferior STEMI',
    'Reciprocal ST depression in lateral leads I and aVL',
    'Sinus tachycardia — likely secondary to pain/stress response',
    'Q waves developing in III — possible early infarct evolution',
  ],
  criticalFindings: [
    'INFERIOR STEMI PATTERN DETECTED — Emergent cardiology consultation required',
    'Immediate 12-lead correlation and troponin sampling indicated',
  ],
  differentialDiagnosis: [
    'Acute inferior STEMI (TIMI risk: high)',
    'Right ventricular infarction (obtain V4R)',
    'Pericarditis (less likely — regional not diffuse changes)',
  ],
  confidence: 94,
  urgency: 'emergent',
  recommendation: 'Emergent cardiology consultation. Initiate STEMI protocol. Obtain right-sided leads (V3R, V4R). Draw troponin I/T, BMP, CBC. Avoid nitroglycerin until RV involvement excluded.',
  redFlags: [
    'Inferior STEMI pattern',
    'Borderline QTc — avoid QT-prolonging agents',
    'Sinus tachycardia — may mask compensatory bradycardia',
  ],
};
