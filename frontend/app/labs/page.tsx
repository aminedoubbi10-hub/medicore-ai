'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { FlaskConical, AlertTriangle } from 'lucide-react';
import { labsAPI } from '@/lib/api';
import { toast } from 'sonner';

const LAB_FIELDS = [
  { key: 'wbc', label: 'WBC', unit: '10^3/uL', ref: '4.0-10.0' },
  { key: 'hemoglobin', label: 'Hemoglobin', unit: 'g/dL', ref: '12-17.5' },
  { key: 'platelets', label: 'Platelets', unit: '10^3/uL', ref: '150-400' },
  { key: 'sodium', label: 'Sodium', unit: 'mEq/L', ref: '136-145' },
  { key: 'potassium', label: 'Potassium', unit: 'mEq/L', ref: '3.5-5.0' },
  { key: 'creatinine', label: 'Creatinine', unit: 'mg/dL', ref: '0.6-1.2' },
  { key: 'glucose', label: 'Glucose', unit: 'mg/dL', ref: '70-100' },
  { key: 'troponin_i', label: 'Troponin I', unit: 'ng/mL', ref: '<0.04' },
  { key: 'troponin_t', label: 'Troponin T', unit: 'ng/mL', ref: '<0.01' },
  { key: 'bnp', label: 'BNP', unit: 'pg/mL', ref: '<100' },
  { key: 'crp', label: 'CRP', unit: 'mg/L', ref: '<5.0' },
  { key: 'inr', label: 'INR', unit: '', ref: '0.8-1.2' },
];

const STATUS_COLORS: Record<string, string> = {
  critical_high: '#ff4d6d',
  critical_low: '#ff4d6d',
  invalid: '#ff4d6d',
  high: '#ffb347',
  low: '#00d4ff',
  normal: '#00e5a0',
  unknown: '#8eb4cc',
};

export default function LabsPage() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [context, setContext] = useState('');
  const [patientId, setPatientId] = useState('unassigned');

  const analyze = async () => {
    const numericValues = Object.fromEntries(
      Object.entries(values)
        .filter(([, value]) => value !== '')
        .map(([key, value]) => [key, Number(value)])
    );
    if (Object.keys(numericValues).length === 0) {
      toast.error('Enter at least one lab value');
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      const res = await labsAPI.interpret(patientId || 'unassigned', numericValues, context);
      setResult(res);
      toast.success('Lab screening complete');
    } catch (err: any) {
      toast.error(err.message || 'Unable to interpret labs safely');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-4 flex gap-2 p-3 rounded-xl text-xs"
        style={{ background: 'rgba(255,179,71,0.07)', border: '1px solid rgba(255,179,71,0.2)', color: '#ffb347' }}>
        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <span><strong>Clinical Decision Support.</strong> This screen flags reference-range and critical-value issues only. It does not diagnose.</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2 text-sm font-semibold mb-4">
            <FlaskConical className="w-4 h-4" style={{ color: 'var(--amber)' }} />
            Enter Lab Values
          </div>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text2)' }}>Patient ID</label>
              <input value={patientId} onChange={(e) => setPatientId(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text)' }} />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text2)' }}>Clinical Context</label>
              <input value={context} onChange={(e) => setContext(e.target.value)}
                placeholder="Age, symptoms, timing..."
                className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text)' }} />
            </div>
          </div>

          <div className="space-y-2">
            {LAB_FIELDS.map((field) => (
              <div key={field.key} className="flex items-center gap-3">
                <label className="text-xs w-24 flex-shrink-0" style={{ color: 'var(--text2)' }}>{field.label}</label>
                <input
                  type="number"
                  step="any"
                  value={values[field.key] || ''}
                  onChange={(e) => setValues((current) => ({ ...current, [field.key]: e.target.value }))}
                  className="flex-1 rounded-lg px-3 py-1.5 text-sm outline-none"
                  style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text)', fontFamily: 'DM Mono' }}
                />
                <span className="text-[10px] w-16 text-right" style={{ color: 'var(--text3)' }}>{field.unit}</span>
                <span className="text-[10px] w-20 text-right hidden md:block" style={{ color: 'var(--text3)' }}>{field.ref}</span>
              </div>
            ))}
          </div>

          <button onClick={analyze} disabled={loading}
            className="mt-5 w-full py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg,#cc6600,#994400)', color: 'white' }}>
            {loading ? 'Screening...' : 'Screen Lab Values'}
          </button>
        </div>

        <div>
          {result ? (
            <LabResult result={result} />
          ) : (
            <div className="rounded-xl flex items-center justify-center h-full min-h-80"
              style={{ background: 'rgba(15,26,46,0.4)', border: '1px dashed var(--border)' }}>
              <div className="text-center" style={{ color: 'var(--text3)' }}>
                <FlaskConical className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Enter live lab values and screen</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function LabResult({ result }: { result: any }) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-xl overflow-hidden" style={{ background: 'var(--bg3)', border: '1px solid var(--border)' }}>
      <div className="p-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)', background: 'linear-gradient(135deg,rgba(200,100,0,0.1),rgba(100,50,0,0.05))' }}>
        <div className="text-xs font-bold" style={{ color: '#ffb347' }}>MEDICORE AI · LAB SCREEN</div>
        <div className="text-xs px-2 py-1 rounded" style={{ background: 'var(--surface2)', color: 'var(--text2)' }}>
          {(result.urgency || 'routine').toUpperCase()}
        </div>
      </div>

      <div className="p-4 space-y-4 text-xs">
        {result.summary && (
          <div className="p-3 rounded-lg leading-relaxed" style={{ background: 'var(--surface2)', color: 'var(--text)' }}>
            {result.summary}
          </div>
        )}

        {result.classified_values && (
          <table className="w-full">
            <thead>
              <tr className="text-left">
                {['Test', 'Result', 'Status'].map((heading) => (
                  <th key={heading} className="pb-1.5 text-[10px] uppercase tracking-wider" style={{ color: 'var(--text3)' }}>{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(result.classified_values).map(([name, info]: any) => (
                <tr key={name} style={{ borderTop: '1px solid rgba(30,48,80,0.4)' }}>
                  <td className="py-1.5 capitalize">{name.replace('_', ' ')}</td>
                  <td className="py-1.5" style={{ fontFamily: 'DM Mono', color: STATUS_COLORS[info.status] || 'var(--text)' }}>
                    {info.value} {info.unit}
                  </td>
                  <td className="py-1.5">
                    <span className="px-1.5 py-0.5 rounded text-[10px]"
                      style={{ background: `${STATUS_COLORS[info.status] || 'var(--text3)'}15`, color: STATUS_COLORS[info.status] || 'var(--text3)' }}>
                      {info.flag}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {result.recommendations?.length > 0 && (
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: '#00e5a0' }}>Recommendations</div>
            {result.recommendations.map((recommendation: string, index: number) => (
              <div key={index} className="p-2 rounded mb-1 border-l-2" style={{ borderColor: '#00e5a0', background: 'rgba(0,229,160,0.05)', color: 'var(--text2)' }}>
                {recommendation}
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2 p-2.5 rounded-lg" style={{ background: 'rgba(255,179,71,0.07)', border: '1px solid rgba(255,179,71,0.2)' }}>
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: '#ffb347' }} />
          <p style={{ color: 'rgba(255,179,71,0.8)' }}>Reference-range screening only. Physician validation is required.</p>
        </div>
      </div>
    </motion.div>
  );
}
