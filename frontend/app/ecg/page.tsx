'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Zap, AlertTriangle, CheckCircle, Activity, Circle } from 'lucide-react';
import { ecgAPI } from '@/lib/api';
import { applyCardioRules, ECGRuleAlerts } from '@/lib/ecg-rules';
import { toast } from 'sonner';

type State = 'idle' | 'uploading' | 'processing' | 'complete' | 'error';

const urgencyColors: Record<string, string> = {
  routine: '#00e5a0', urgent: '#ffb347', emergent: '#ff4d6d',
};

const LEAD_ORDER = ['I', 'II', 'III', 'aVR', 'aVL', 'aVF', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6'];

const STEPS = [
  'Preprocessing ECG image',
  'Detecting lead positions',
  'Rhythm analysis (RR intervals)',
  'ST segment evaluation',
  'QRS morphology analysis',
  'Running safety rule checks',
  'Gemini ECG picture verification',
];

function fileToBase64(file: File): Promise<{ base64: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const [header, base64] = result.split(',');
      resolve({
        base64,
        mediaType: header.replace('data:', '').replace(';base64', '') || file.type || 'image/jpeg',
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function runVisualVerifier(file: File, clinicalContext: string) {
  if (!file.type.startsWith('image/')) {
    return {
      enabled: false,
      error: 'Gemini ECG verification is picture-only right now; backend ECG screening still supports PDFs and waveform files.',
    };
  }

  const { base64, mediaType } = await fileToBase64(file);
  const res = await fetch('/api/ecg-analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64: base64, mediaType, clinicalContext }),
  });
  return res.json();
}

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
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg'],
      'application/pdf': ['.pdf'],
      'text/csv': ['.csv'],
      'text/plain': ['.txt'],
      'application/xml': ['.xml'],
      'text/xml': ['.xml'],
    },
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
      form.append('patient_id', patientId.replace('#', '') || 'unassigned');
      form.append('clinical_notes', clinicalNotes);

      const { study_id } = await ecgAPI.upload(form);
      const res = await ecgAPI.pollResult(study_id);

      clearInterval(stepInterval);
      setStep(STEPS.length - 1);

      const backendResult = {
        ...(res.findings || res),
        study_id: res.study_id,
        review_status: res.review_status,
        physician_review: res.physician_review,
      };
      const clientRuleAlerts = applyCardioRules(backendResult);
      let visualVerification: any = null;
      try {
        visualVerification = await runVisualVerifier(file, `${patientId} ${clinicalNotes}`.trim());
      } catch (verificationError: any) {
        visualVerification = {
          enabled: false,
          error: verificationError?.message || 'Gemini ECG picture verification unavailable.',
        };
      }

      const verifierRuleAlerts = visualVerification?.pass1 ? applyCardioRules(visualVerification.pass1) : null;

      setResult({
        ...backendResult,
        clientRuleAlerts,
        visualVerification,
        verifierRuleAlerts,
      });
      setState('complete');

      if (res.urgency === 'emergent') {
        toast.error('🚨 Critical finding — immediate attention required');
      } else {
        toast.success('ECG analysis complete');
      }
    } catch (err: any) {
      clearInterval(stepInterval);
      setResult({ ...SAFE_ECG_FALLBACK, primaryFindings: [err.message || SAFE_ECG_FALLBACK.primaryFindings[0]] });
      setState('complete');
      toast.error('ECG analysis could not complete safely');
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
              <p className="text-xs mb-3" style={{ color: 'var(--text3)' }}>PNG, JPG, WEBP, HEIC, PDF · Max 100 MB</p>
              <div className="flex gap-1.5 justify-center flex-wrap">
                {['Pictures', 'PDF', 'CSV', 'TXT', 'XML'].map((f) => (
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
              {state === 'uploading' ? 'Uploading...' : state === 'processing' ? 'Screening ECG...' : 'Screen ECG'}
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
                <p className="text-xs mt-1">Backend screen plus Gemini verification for ECG pictures</p>
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
  const studyId = result.study_id || result.measurements?.study_id;
  const imageQuality = result.measurements?.image_quality || result.measurements?.image_waveform_screen?.image_quality;
  const preprocessing = result.measurements?.preprocessing || result.measurements?.image_waveform_screen?.preprocessing;
  const leadQuality = result.measurements?.image_waveform_screen?.lead_segmentation_quality;
  const aggregate = result.measurements?.image_waveform_screen?.aggregate_measurements;
  const layoutDetection = result.measurements?.image_waveform_screen?.layout_detection;
  const axisScreen = aggregate?.axis_screen;
  const progressionScreen = aggregate?.r_wave_progression_screen;
  const voltageScreen = aggregate?.low_voltage_screen;
  const irregularityScreen = aggregate?.rhythm_irregularity_screen;
  const bbbScreen = aggregate?.bundle_branch_block_screen;
  const stPatternScreen = aggregate?.st_pattern_screen;
  const [review, setReview] = useState({
    final_impression: result.physician_review?.final_impression || '',
    rhythm: result.physician_review?.rhythm || '',
    intervals: result.physician_review?.intervals || '',
    st_t_changes: result.physician_review?.st_t_changes || '',
    reviewer_notes: result.physician_review?.reviewer_notes || '',
  });
  const [reviewStatus, setReviewStatus] = useState(result.review_status || 'pending_cardiologist_review');
  const [savingReview, setSavingReview] = useState(false);

  const submitReview = async () => {
    if (!studyId) {
      toast.error('Study ID unavailable for review');
      return;
    }
    if (!review.final_impression.trim()) {
      toast.error('Final impression is required');
      return;
    }
    setSavingReview(true);
    try {
      const saved = await ecgAPI.review(studyId, review);
      setReviewStatus(saved.review_status || 'reviewed');
      toast.success('Physician review saved');
    } catch (err: any) {
      toast.error(err.message || 'Unable to save review');
    } finally {
      setSavingReview(false);
    }
  };

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

        {(imageQuality || preprocessing || leadQuality !== undefined) && (
          <Section title="Image Quality">
            <div className="grid grid-cols-2 gap-1.5">
              {[
                ['Quality', imageQuality?.status || 'Unknown'],
                ['Score', imageQuality?.quality_score !== undefined ? `${Math.round(imageQuality.quality_score * 100)}%` : 'Unknown'],
                ['Grid', imageQuality?.grid_score !== undefined ? `${Math.round(imageQuality.grid_score * 100)}%` : 'Unknown'],
                ['Lead Split', leadQuality !== undefined ? `${Math.round(leadQuality * 100)}%` : 'Unknown'],
                ['Usable Leads', aggregate?.usable_lead_count !== undefined ? String(aggregate.usable_lead_count) : 'Unknown'],
                ['Rate Source', aggregate?.heart_rate_source || 'Unknown'],
                ['Layout', layoutDetection?.selected_layout || 'Unknown'],
                ['Layout Conf.', layoutDetection?.layout_confidence !== undefined ? `${Math.round(layoutDetection.layout_confidence * 100)}%` : 'Unknown'],
              ].map(([l, v]) => (
                <div key={l} className="rounded-lg p-2" style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
                  <div className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: 'var(--text3)' }}>{l}</div>
                  <div style={{ fontFamily: 'DM Mono', color: 'var(--text)' }}>{v}</div>
                </div>
              ))}
            </div>
            {imageQuality?.warnings?.length > 0 && (
              <div className="mt-2 p-2 rounded-lg" style={{ background: 'rgba(255,179,71,0.06)', border: '1px solid rgba(255,179,71,0.18)', color: 'var(--text2)' }}>
                {imageQuality.warnings.join(', ')}
              </div>
            )}
            {preprocessing && (
              <div className="mt-2 text-[11px]" style={{ color: 'var(--text3)' }}>
                Deskew {preprocessing.deskew_angle_degrees ?? 0} degrees · processed {preprocessing.processed_shape?.join(' x ') || 'image'}
              </div>
            )}
            {aggregate?.measurement_consistency && (
              <div className="mt-1 text-[11px]" style={{ color: 'var(--text3)' }}>
                Cross-lead consistency: {aggregate.measurement_consistency}
              </div>
            )}
          </Section>
        )}

        {(axisScreen || progressionScreen || voltageScreen) && (
          <Section title="Advanced Screens">
            <div className="grid grid-cols-1 gap-1.5">
              {[
                ['Axis', axisScreen?.status || 'Unavailable'],
                ['R-Wave Progression', progressionScreen?.status || 'Unavailable'],
                ['Low Voltage', voltageScreen?.status || 'Unavailable'],
                ['RR Pattern', irregularityScreen?.status || 'Unavailable'],
                ['Wide QRS Pattern', bbbScreen?.status || 'Unavailable'],
                ['ST Pattern', stPatternScreen?.status || 'Unavailable'],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg p-2" style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
                  <div className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: 'var(--text3)' }}>{label}</div>
                  <div style={{ fontFamily: 'DM Mono', color: 'var(--text)' }}>{value}</div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {result.clientRuleAlerts && (
          <RuleAlertSection title="Client Safety Rule Engine" alerts={result.clientRuleAlerts} />
        )}

        {result.visualVerification && (
          <VisualVerificationSection
            verification={result.visualVerification}
            ruleAlerts={result.verifierRuleAlerts}
          />
        )}

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

        <Section title="Physician Review" titleColor="#00e5a0">
          <div className="space-y-2">
            <div className="text-[11px]" style={{ color: 'var(--text3)' }}>
              Status: {reviewStatus}
            </div>
            <textarea
              value={review.final_impression}
              onChange={(e) => setReview((current) => ({ ...current, final_impression: e.target.value }))}
              rows={3}
              placeholder="Final cardiologist impression..."
              className="w-full rounded-lg px-3 py-2 text-xs outline-none resize-none"
              style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)' }}
            />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {[
                ['rhythm', 'Rhythm'],
                ['intervals', 'Intervals'],
                ['st_t_changes', 'ST-T Changes'],
              ].map(([key, label]) => (
                <input
                  key={key}
                  value={(review as any)[key]}
                  onChange={(e) => setReview((current) => ({ ...current, [key]: e.target.value }))}
                  placeholder={label}
                  className="rounded-lg px-3 py-2 text-xs outline-none"
                  style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)' }}
                />
              ))}
            </div>
            <textarea
              value={review.reviewer_notes}
              onChange={(e) => setReview((current) => ({ ...current, reviewer_notes: e.target.value }))}
              rows={2}
              placeholder="Optional reviewer notes..."
              className="w-full rounded-lg px-3 py-2 text-xs outline-none resize-none"
              style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)' }}
            />
            <button
              onClick={submitReview}
              disabled={savingReview}
              className="px-3 py-2 rounded-lg text-xs font-semibold disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg,var(--accent2),#005588)', color: 'white' }}>
              {savingReview ? 'Saving review...' : 'Save Physician Review'}
            </button>
          </div>
        </Section>

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

function RuleAlertSection({ title, alerts }: { title: string; alerts: ECGRuleAlerts }) {
  const rows = [
    ...alerts.critical.map((text) => ({ text, color: '#ff4d6d', label: 'Critical' })),
    ...alerts.warning.map((text) => ({ text, color: '#ffb347', label: 'Warning' })),
    ...alerts.info.map((text) => ({ text, color: '#00e5a0', label: 'Info' })),
  ];

  if (!rows.length) return null;

  return (
    <Section title={title} titleColor="#ffb347">
      <div className="space-y-1.5">
        {rows.map((row, index) => (
          <div
            key={`${row.label}-${index}`}
            className="p-2 rounded-lg border-l-2"
            style={{ borderColor: row.color, background: `${row.color}12`, color: 'var(--text2)' }}
          >
            <span className="font-bold" style={{ color: row.color }}>{row.label}: </span>
            {row.text}
          </div>
        ))}
      </div>
    </Section>
  );
}

function VisualVerificationSection({
  verification,
  ruleAlerts,
}: {
  verification: any;
  ruleAlerts: ECGRuleAlerts | null;
}) {
  if (!verification.enabled) {
    return (
      <Section title="Gemini ECG Picture Verification">
        <div className="p-2 rounded-lg" style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text3)' }}>
          {verification.error || 'Gemini verification unavailable. Backend deterministic screening still completed.'}
        </div>
      </Section>
    );
  }

  const p = verification.pass1 || {};
  const pass2 = verification.pass2 || {};

  return (
    <Section title="Gemini Two-Pass ECG Picture Verification" titleColor="#00d4ff">
      <div className="space-y-2">
        <div className="text-[11px]" style={{ color: 'var(--text3)' }}>
          Provider: Gemini{verification.model ? ` (${verification.model})` : ''}. This verifies ECG pictures only; PDFs continue through the backend pipeline.
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {[
            ['Rate', p.rate?.ventricular_bpm ? `${Math.round(p.rate.ventricular_bpm)} bpm` : 'Not safely measured'],
            ['Rhythm', p.rhythm?.classification || 'Uncertain'],
            ['PR', p.intervals?.PR_ms ? `${Math.round(p.intervals.PR_ms)} ms` : 'Not safely measured'],
            ['QRS', p.intervals?.QRS_ms ? `${Math.round(p.intervals.QRS_ms)} ms` : 'Not safely measured'],
            ['QTc', p.intervals?.QTc_ms ? `${Math.round(p.intervals.QTc_ms)} ms` : 'Not safely measured'],
            ['Quality', p.image_quality || 'Unknown'],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg p-2" style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
              <div className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: 'var(--text3)' }}>{label}</div>
              <div style={{ fontFamily: 'DM Mono', color: 'var(--text)' }}>{value}</div>
            </div>
          ))}
        </div>

        {ruleAlerts && <RuleAlertSection title="Verifier Rule Flags" alerts={ruleAlerts} />}

        {p.lead_findings && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
            {LEAD_ORDER.map((lead) => (
              <div key={lead} className="rounded-lg p-2" style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
                <div className="text-[10px] font-bold mb-0.5" style={{ color: 'var(--accent)' }}>{lead}</div>
                <div className="leading-snug" style={{ color: 'var(--text2)' }}>{p.lead_findings?.[lead] || 'Not reported'}</div>
              </div>
            ))}
          </div>
        )}

        <div className="p-2 rounded-lg" style={{ background: 'rgba(0,212,255,0.05)', border: '1px solid rgba(0,212,255,0.15)', color: 'var(--text2)' }}>
          <div className="font-semibold mb-1">Pass 1 impression</div>
          <div>{p.interpretation || 'No visual verifier impression returned.'}</div>
          <div className="mt-1" style={{ color: 'var(--text3)' }}>
            Confidence: {p.confidence || 'low/unknown'}{p.confidence_reason ? ` - ${p.confidence_reason}` : ''}
          </div>
        </div>

        {pass2.summary && (
          <div className="p-2 rounded-lg" style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text2)' }}>
            <div className="font-semibold mb-1">Pass 2 verification: {pass2.agreement || 'unknown'}</div>
            <div>{pass2.summary}</div>
            {pass2.corrections?.length > 0 && (
              <div className="mt-1" style={{ color: '#ffb347' }}>Corrections: {pass2.corrections.join('; ')}</div>
            )}
          </div>
        )}

        <div className="text-[11px]" style={{ color: 'var(--text3)' }}>
          Gemini verification is an assistant layer only. Final ECG interpretation must be confirmed by a cardiologist.
        </div>
      </div>
    </Section>
  );
}

const SAFE_ECG_FALLBACK = {
  diagnostic_status: 'unable_to_interpret_safely',
  rhythm: 'Unable to determine safely',
  heartRate: 'Unable to determine safely',
  prInterval: 'Unable to measure safely',
  qrsDuration: 'Unable to measure safely',
  qtInterval: 'Unable to measure safely',
  stChanges: 'Unable to assess safely',
  axis: 'Unable to determine safely',
  primaryFindings: [
    'Unable to complete ECG analysis safely.',
    'Please check the ECG with a physician/cardiologist.',
  ],
  criticalFindings: [],
  differentialDiagnosis: [],
  confidence: 0,
  urgency: 'urgent',
  recommendation: 'Preliminary AI-assisted screening only. Please check this ECG with a physician/cardiologist.',
  redFlags: [],
};
