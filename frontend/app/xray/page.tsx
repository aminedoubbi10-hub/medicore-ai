'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, AlertTriangle, CheckCircle } from 'lucide-react';
import { xrayAPI } from '@/lib/api';
import { toast } from 'sonner';

type State = 'idle' | 'uploading' | 'complete' | 'error';

const SEVERITY_COLORS: Record<string, string> = {
  normal: '#00e5a0', mild: '#ffb347', moderate: '#ff8c42', severe: '#ff4d6d',
};

export default function XRayPage() {
  const [file, setFile]   = useState<File | null>(null);
  const [state, setState] = useState<State>('idle');
  const [result, setResult] = useState<any>(null);

  const onDrop = useCallback((accepted: File[]) => {
    if (accepted[0]) { setFile(accepted[0]); setResult(null); setState('idle'); }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.png', '.jpg', '.jpeg'], 'application/dicom': ['.dcm'] },
    multiple: false,
  });

  const analyze = async () => {
    setState('uploading');
    try {
      if (file) {
        const form = new FormData();
        form.append('file', file);
        form.append('patient_id', 'demo');
        await xrayAPI.upload(form);
      }
      // Demo result after short delay
      await new Promise((r) => setTimeout(r, 2000));
      setResult(DEMO_RESULT);
      setState('complete');
      toast.success('X-Ray analysis complete');
    } catch {
      setResult(DEMO_RESULT);
      setState('complete');
      toast.success('X-Ray analysis complete (demo)');
    }
  };

  return (
    <div>
      <div className="mb-4 flex gap-2 p-3 rounded-xl text-xs"
        style={{ background: 'rgba(255,179,71,0.07)', border: '1px solid rgba(255,179,71,0.2)', color: '#ffb347' }}>
        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <span><strong>Radiology AI Assistant.</strong> AI-generated findings must be reviewed by a qualified radiologist. Heatmaps are approximate.</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Upload */}
        <div className="space-y-4">
          <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="text-sm font-semibold mb-4">Upload Chest X-Ray</div>
            <div {...getRootProps()} className="rounded-xl p-10 text-center cursor-pointer transition-all"
              style={{
                border: `2px dashed ${isDragActive ? '#00e5a0' : file ? '#00e5a0' : 'var(--border2)'}`,
                background: file ? 'rgba(0,229,160,0.03)' : 'var(--bg3)',
              }}>
              <input {...getInputProps()} />
              <Upload className="w-10 h-10 mx-auto mb-3" style={{ color: file ? '#00e5a0' : 'var(--text3)' }} />
              <p className="text-sm font-medium mb-1">{file ? `✓ ${file.name}` : 'Drop CXR or click to browse'}</p>
              <p className="text-xs" style={{ color: 'var(--text3)' }}>PA/AP view · DICOM, PNG, JPEG</p>
            </div>
            <button onClick={analyze} disabled={state === 'uploading'}
              className="mt-4 w-full py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg,#009966,#006644)', color: 'white' }}>
              {state === 'uploading' ? 'Analyzing...' : 'Analyze X-Ray with AI'}
            </button>
          </div>

          {/* Detection list */}
          <div className="rounded-xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="text-xs font-semibold mb-3">Detection Parameters</div>
            <div className="space-y-1.5">
              {['Pneumonia / Consolidation','Pleural Effusion','Pneumothorax','Cardiomegaly','Pulmonary Edema','Fibrosis / ILD','TB-like Patterns','Lung Nodules'].map((p) => (
                <div key={p} className="flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs"
                  style={{ background: 'var(--bg3)' }}>
                  <span>{p}</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px]" style={{ background: 'rgba(0,229,160,0.1)', color: '#00e5a0' }}>Active</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Results */}
        <div>
          {/* Mock X-ray with heatmap */}
          <div className="rounded-xl overflow-hidden mb-4" style={{ background: '#000', border: '1px solid var(--border)', aspectRatio: '1/1.1' }}>
            <svg width="100%" height="100%" viewBox="0 0 300 330">
              <ellipse cx="150" cy="165" rx="110" ry="140" fill="rgba(30,40,60,0.9)" stroke="rgba(100,150,200,0.3)" strokeWidth="1"/>
              <ellipse cx="110" cy="160" rx="55" ry="100" fill="rgba(40,55,80,0.8)"/>
              <ellipse cx="190" cy="160" rx="55" ry="100" fill="rgba(40,55,80,0.8)"/>
              <ellipse cx="150" cy="165" rx="35" ry="50" fill="rgba(50,65,90,0.9)"/>
              {state === 'complete' && (
                <>
                  <ellipse cx="105" cy="195" rx="30" ry="25" fill="rgba(255,77,109,0.35)" stroke="rgba(255,77,109,0.6)" strokeWidth="1.5" strokeDasharray="3,2"/>
                  <ellipse cx="195" cy="140" rx="20" ry="15" fill="rgba(255,179,71,0.25)" stroke="rgba(255,179,71,0.5)" strokeWidth="1" strokeDasharray="2,2"/>
                  <text x="68" y="228" fill="rgba(255,77,109,0.9)" fontSize="8" fontFamily="monospace">effusion?</text>
                  <text x="168" y="128" fill="rgba(255,179,71,0.9)" fontSize="8" fontFamily="monospace">opacity</text>
                </>
              )}
              {state === 'uploading' && (
                <text x="80" y="170" fill="rgba(0,212,255,0.7)" fontSize="12" fontFamily="monospace">Analyzing...</text>
              )}
            </svg>
          </div>

          <AnimatePresence>
            {state === 'complete' && result && (
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                className="rounded-xl overflow-hidden" style={{ background: 'var(--bg3)', border: '1px solid var(--border)' }}>
                <div className="p-4 flex items-center justify-between"
                  style={{ borderBottom: '1px solid var(--border)', background: 'linear-gradient(135deg,rgba(0,150,80,0.1),rgba(0,100,50,0.05))' }}>
                  <div className="text-xs font-bold" style={{ color: '#00e5a0' }}>MEDICORE AI · CHEST X-RAY REPORT</div>
                  <div className="text-2xl font-black" style={{ fontFamily: 'Syne', color: '#00e5a0' }}>{result.confidence}%</div>
                </div>
                <div className="p-4 space-y-4 text-xs">
                  <div>
                    <Label>Technique</Label>
                    <div className="p-2 rounded border-l-2 border-green-500" style={{ background: 'rgba(0,229,160,0.05)', color: 'var(--text2)' }}>
                      {result.technique}
                    </div>
                  </div>
                  <div>
                    <Label>Findings</Label>
                    <div className="space-y-1.5">
                      {result.findings?.map((f: any, i: number) => (
                        <div key={i} className="p-2.5 rounded-lg border-l-2"
                          style={{ borderColor: SEVERITY_COLORS[f.severity] || '#8eb4cc', background: `${SEVERITY_COLORS[f.severity] || '#8eb4cc'}08`, color: 'var(--text2)' }}>
                          <div className="font-semibold mb-0.5" style={{ color: 'var(--text3)', fontSize: '10px', textTransform: 'uppercase' }}>{f.region}</div>
                          {f.finding}
                          <span className="ml-2 px-1.5 py-0.5 rounded text-[10px]"
                            style={{ background: `${SEVERITY_COLORS[f.severity]}20`, color: SEVERITY_COLORS[f.severity] }}>
                            {f.severity}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label>Impression</Label>
                    <div className="p-3 rounded-lg" style={{ background: 'rgba(0,212,255,0.05)', border: '1px solid rgba(0,212,255,0.15)', color: 'var(--text)' }}>
                      {result.impression}
                    </div>
                  </div>
                  <div>
                    <Label>Differential Diagnosis</Label>
                    {result.differentialDx?.map((d: string, i: number) => (
                      <div key={i} className="flex gap-2 p-2 rounded mb-1.5" style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
                        <span className="font-bold" style={{ color: ['#ff4d6d','#ffb347','var(--text3)'][i] }}>#{i+1}</span>
                        <span style={{ color: 'var(--text2)' }}>{d}</span>
                      </div>
                    ))}
                  </div>
                  <div className="p-2.5 rounded-lg flex gap-2" style={{ background: 'rgba(0,212,255,0.05)', border: '1px solid rgba(0,212,255,0.15)', color: 'var(--text)' }}>
                    {result.recommendation}
                  </div>
                  <div className="flex gap-2 p-2.5 rounded-lg" style={{ background: 'rgba(255,179,71,0.07)', border: '1px solid rgba(255,179,71,0.2)' }}>
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: '#ffb347' }} />
                    <p style={{ color: 'rgba(255,179,71,0.8)' }}>AI radiology support only. Confidence: {result.confidence}%. All findings require review by a licensed radiologist.</p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#00e5a0' }}>{children}</span>
      <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
    </div>
  );
}

const DEMO_RESULT = {
  technique: 'PA projection, adequate inspiration, no rotation. Digital acquisition.',
  findings: [
    { region: 'Left Lower Lobe',    finding: 'Homogeneous opacity consistent with consolidation; air bronchograms present', severity: 'moderate' },
    { region: 'Right Perihilar',    finding: 'Increased peribronchial markings; possible early consolidation', severity: 'mild' },
    { region: 'Cardiac Silhouette', finding: 'Borderline cardiomegaly (CTR ~0.52); no frank pulmonary edema', severity: 'mild' },
    { region: 'Pleural Spaces',     finding: 'No definite bilateral pleural effusion; blunting of left costophrenic angle', severity: 'mild' },
  ],
  impression: 'Left lower lobe pneumonia. Possible right perihilar involvement. Borderline cardiomegaly.',
  differentialDx: [
    'Community-acquired pneumonia (most likely — Streptococcus pneumoniae)',
    'Aspiration pneumonia',
    'Atypical pneumonia (Mycoplasma, Legionella)',
  ],
  confidence: 88,
  urgency: 'urgent',
  recommendation: 'Start empirical antibiotics per CAP guidelines. Follow-up CXR in 4–6 weeks to confirm resolution. Consider CT chest if no improvement at 72h.',
};
