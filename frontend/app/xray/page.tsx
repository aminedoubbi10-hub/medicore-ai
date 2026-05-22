'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, AlertTriangle } from 'lucide-react';
import { xrayAPI } from '@/lib/api';
import { toast } from 'sonner';

type State = 'idle' | 'uploading' | 'complete' | 'error';

const SEVERITY_COLORS: Record<string, string> = {
  normal: '#00e5a0',
  mild: '#ffb347',
  moderate: '#ff8c42',
  severe: '#ff4d6d',
  indeterminate: '#8eb4cc',
};

export default function XRayPage() {
  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState<State>('idle');
  const [result, setResult] = useState<any>(null);

  const onDrop = useCallback((accepted: File[]) => {
    if (accepted[0]) {
      setFile(accepted[0]);
      setResult(null);
      setState('idle');
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.png', '.jpg', '.jpeg'], 'application/dicom': ['.dcm'] },
    multiple: false,
  });

  const analyze = async () => {
    setState('uploading');
    try {
      if (!file) {
        setResult(SAFE_EMPTY_RESULT);
      } else {
        const form = new FormData();
        form.append('file', file);
        form.append('patient_id', 'demo');
        const { study_id } = await xrayAPI.upload(form);
        const res = await xrayAPI.pollResult(study_id);
        setResult(res.findings || res);
      }
      setState('complete');
      toast.success('X-Ray preliminary screen complete');
    } catch (err: any) {
      setResult({ ...SAFE_EMPTY_RESULT, impression: err.message || SAFE_EMPTY_RESULT.impression });
      setState('complete');
      toast.error('X-Ray analysis could not complete safely');
    }
  };

  return (
    <div>
      <div
        className="mb-4 flex gap-2 p-3 rounded-xl text-xs"
        style={{ background: 'rgba(255,179,71,0.07)', border: '1px solid rgba(255,179,71,0.2)', color: '#ffb347' }}
      >
        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <span>
          <strong>Radiology AI Assistant.</strong> Preliminary AI-assisted screening only. Check all results with a
          physician or radiologist.
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="space-y-4">
          <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="text-sm font-semibold mb-4">Upload Chest X-Ray</div>
            <div
              {...getRootProps()}
              className="rounded-xl p-10 text-center cursor-pointer transition-all"
              style={{
                border: `2px dashed ${isDragActive ? '#00e5a0' : file ? '#00e5a0' : 'var(--border2)'}`,
                background: file ? 'rgba(0,229,160,0.03)' : 'var(--bg3)',
              }}
            >
              <input {...getInputProps()} />
              <Upload className="w-10 h-10 mx-auto mb-3" style={{ color: file ? '#00e5a0' : 'var(--text3)' }} />
              <p className="text-sm font-medium mb-1">{file ? file.name : 'Drop CXR or click to browse'}</p>
              <p className="text-xs" style={{ color: 'var(--text3)' }}>DICOM, PNG, JPEG</p>
            </div>
            <button
              onClick={analyze}
              disabled={state === 'uploading'}
              className="mt-4 w-full py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg,#009966,#006644)', color: 'white' }}
            >
              {state === 'uploading' ? 'Analyzing...' : 'Analyze X-Ray with AI'}
            </button>
          </div>

          <div className="rounded-xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="text-xs font-semibold mb-3">Screening Parameters</div>
            <div className="space-y-1.5">
              {['Pneumonia / opacity screen', 'Pleural effusion screen', 'Pneumothorax screen', 'Nodule screen', 'Pulmonary edema screen'].map((p) => (
                <div key={p} className="flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs" style={{ background: 'var(--bg3)' }}>
                  <span>{p}</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px]" style={{ background: 'rgba(255,179,71,0.1)', color: '#ffb347' }}>
                    review
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div>
          <AnimatePresence>
            {state === 'complete' && result && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl overflow-hidden"
                style={{ background: 'var(--bg3)', border: '1px solid var(--border)' }}
              >
                <div
                  className="p-4 flex items-center justify-between"
                  style={{ borderBottom: '1px solid var(--border)', background: 'linear-gradient(135deg,rgba(0,150,80,0.1),rgba(0,100,50,0.05))' }}
                >
                  <div>
                    <div className="text-xs font-bold" style={{ color: '#00e5a0' }}>MEDICORE AI - CHEST X-RAY SCREEN</div>
                    <div className="text-[10px] mt-1" style={{ color: 'var(--text3)' }}>
                      {result.diagnostic_status || 'preliminary_screen_requires_review'}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-black" style={{ fontFamily: 'Syne', color: '#00e5a0' }}>{result.confidence ?? 0}%</div>
                    <div className="text-[10px]" style={{ color: 'var(--text3)' }}>screen confidence</div>
                  </div>
                </div>

                <div className="p-4 space-y-4 text-xs">
                  <Block label="Technique">{result.technique}</Block>

                  <div>
                    <Label>Preliminary Findings</Label>
                    <div className="space-y-1.5">
                      {result.findings?.map((f: any, i: number) => {
                        const color = SEVERITY_COLORS[f.severity] || '#8eb4cc';
                        return (
                          <div key={i} className="p-2.5 rounded-lg border-l-2" style={{ borderColor: color, background: `${color}08`, color: 'var(--text2)' }}>
                            <div className="font-semibold mb-0.5" style={{ color: 'var(--text3)', fontSize: '10px', textTransform: 'uppercase' }}>{f.region}</div>
                            {f.finding}
                            <span className="ml-2 px-1.5 py-0.5 rounded text-[10px]" style={{ background: `${color}20`, color }}>{f.severity}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <Block label="Impression">{result.impression}</Block>
                  <Block label="Recommendation">{result.recommendation}</Block>

                  <div className="flex gap-2 p-2.5 rounded-lg" style={{ background: 'rgba(255,179,71,0.07)', border: '1px solid rgba(255,179,71,0.2)' }}>
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: '#ffb347' }} />
                    <p style={{ color: 'rgba(255,179,71,0.8)' }}>
                      Preliminary AI-assisted screening only. Not a diagnosis. Check with a physician/radiologist.
                    </p>
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

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="p-3 rounded-lg" style={{ background: 'rgba(0,212,255,0.05)', border: '1px solid rgba(0,212,255,0.15)', color: 'var(--text)' }}>
        {children}
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

const SAFE_EMPTY_RESULT = {
  technique: 'Chest radiograph image submitted',
  findings: [
    { region: 'Overall', finding: 'No image was analyzed. Upload a chest X-ray image to generate a preliminary AI-assisted screen.', severity: 'indeterminate' },
  ],
  impression: 'Unable to provide a safe preliminary interpretation without an uploaded image.',
  differentialDx: [],
  confidence: 0,
  urgency: 'routine',
  recommendation: 'Please upload an image and check any AI-assisted result with a physician/radiologist.',
};
