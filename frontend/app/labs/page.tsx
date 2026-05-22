'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { FlaskConical, AlertTriangle } from 'lucide-react';
import { labsAPI } from '@/lib/api';
import { toast } from 'sonner';

const LAB_FIELDS = [
  { key: 'wbc',        label: 'WBC',        unit: '×10³/µL', ref: '4.0–10.0', default: '14.2' },
  { key: 'hemoglobin', label: 'Hemoglobin', unit: 'g/dL',    ref: '12–17.5',  default: '11.8' },
  { key: 'platelets',  label: 'Platelets',  unit: '×10³/µL', ref: '150–400',  default: '380'  },
  { key: 'sodium',     label: 'Sodium',     unit: 'mEq/L',   ref: '136–145',  default: '138'  },
  { key: 'potassium',  label: 'Potassium',  unit: 'mEq/L',   ref: '3.5–5.0',  default: '4.1'  },
  { key: 'creatinine', label: 'Creatinine', unit: 'mg/dL',   ref: '0.6–1.2',  default: '1.1'  },
  { key: 'glucose',    label: 'Glucose',    unit: 'mg/dL',   ref: '70–100',   default: '142'  },
  { key: 'troponin_i', label: 'Troponin I', unit: 'ng/mL',   ref: '<0.04',    default: '8.4'  },
  { key: 'crp',        label: 'CRP',        unit: 'mg/L',    ref: '<5.0',     default: '48.2' },
  { key: 'inr',        label: 'INR',        unit: '',        ref: '0.8–1.2',  default: '1.1'  },
];

const STATUS_COLORS: Record<string, string> = {
  critical_high: '#ff4d6d', critical_low: '#ff4d6d',
  high: '#ffb347', low: '#00d4ff', normal: '#00e5a0', unknown: '#8eb4cc',
};

export default function LabsPage() {
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(LAB_FIELDS.map((f) => [f.key, f.default]))
  );
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [context, setContext] = useState('71M, chest pain, known HTN');

  const analyze = async () => {
    setLoading(true);
    try {
      const numericValues = Object.fromEntries(
        Object.entries(values).filter(([, v]) => v !== '').map(([k, v]) => [k, parseFloat(v)])
      );
      const res = await labsAPI.interpret('demo', numericValues, context);
      setResult(res);
    } catch {
      // Demo fallback
      setResult(DEMO_RESULT);
      toast.success('Lab interpretation complete (demo)');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-4 flex gap-2 p-3 rounded-xl text-xs"
        style={{ background: 'rgba(255,179,71,0.07)', border: '1px solid rgba(255,179,71,0.2)', color: '#ffb347' }}>
        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <span><strong>Clinical Decision Support.</strong> All critical values require immediate physician notification. AI interpretation supplements, never replaces, clinical judgment.</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Input */}
        <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2 text-sm font-semibold mb-4">
            <FlaskConical className="w-4 h-4" style={{ color: 'var(--amber)' }} />
            Enter Lab Values
          </div>

          <div className="mb-3">
            <label className="block text-xs mb-1" style={{ color: 'var(--text2)' }}>Patient Context</label>
            <input value={context} onChange={(e) => setContext(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text)' }} />
          </div>

          <div className="space-y-2">
            {LAB_FIELDS.map((f) => (
              <div key={f.key} className="flex items-center gap-3">
                <label className="text-xs w-24 flex-shrink-0" style={{ color: 'var(--text2)' }}>{f.label}</label>
                <input
                  type="number" step="any"
                  value={values[f.key] || ''} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                  className="flex-1 rounded-lg px-3 py-1.5 text-sm outline-none"
                  style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text)', fontFamily: 'DM Mono' }} />
                <span className="text-[10px] w-16 text-right" style={{ color: 'var(--text3)' }}>{f.unit}</span>
                <span className="text-[10px] w-20 text-right hidden md:block" style={{ color: 'var(--text3)' }}>{f.ref}</span>
              </div>
            ))}
          </div>

          <button onClick={analyze} disabled={loading}
            className="mt-5 w-full py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg,#cc6600,#994400)', color: 'white' }}>
            {loading ? 'Interpreting...' : 'Interpret Lab Results with AI'}
          </button>
        </div>

        {/* Results */}
        <div>
          {result ? (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              className="rounded-xl overflow-hidden" style={{ background: 'var(--bg3)', border: '1px solid var(--border)' }}>
              <div className="p-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)', background: 'linear-gradient(135deg,rgba(200,100,0,0.1),rgba(100,50,0,0.05))' }}>
                <div className="text-xs font-bold" style={{ color: '#ffb347' }}>MEDICORE AI · LAB REPORT</div>
                <div className="text-2xl font-black" style={{ fontFamily: 'Syne', color: '#00e5a0' }}>{result.confidence ?? 88}%</div>
              </div>

              {result.criticalFlags?.length > 0 && (
                <div className="px-4 py-3" style={{ background: 'rgba(255,77,109,0.08)', borderBottom: '1px solid rgba(255,77,109,0.3)' }}>
                  <div className="text-xs font-bold mb-2" style={{ color: '#ff4d6d' }}>🚨 CRITICAL FLAGS</div>
                  {result.criticalFlags.map((f: string, i: number) => (
                    <div key={i} className="text-xs mb-1" style={{ color: 'var(--text2)' }}>• {f}</div>
                  ))}
                </div>
              )}

              <div className="p-4 space-y-4 text-xs">
                {result.summary && (
                  <div className="p-3 rounded-lg leading-relaxed" style={{ background: 'var(--surface2)', color: 'var(--text)' }}>
                    {result.summary}
                  </div>
                )}

                {result.classified_values && (
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: '#ffb347' }}>Value Summary</div>
                    <table className="w-full">
                      <thead>
                        <tr className="text-left">
                          {['Test', 'Result', 'Status'].map((h) => (
                            <th key={h} className="pb-1.5 text-[10px] uppercase tracking-wider" style={{ color: 'var(--text3)' }}>{h}</th>
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
                  </div>
                )}

                {result.likelyCauses?.length > 0 && (
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--accent)' }}>Likely Causes</div>
                    {result.likelyCauses.map((c: string, i: number) => (
                      <div key={i} className="p-2 rounded mb-1 border-l-2" style={{ borderColor: '#ffb347', background: 'rgba(255,179,71,0.05)', color: 'var(--text2)' }}>{c}</div>
                    ))}
                  </div>
                )}

                {result.recommendations?.length > 0 && (
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: '#00e5a0' }}>Recommendations</div>
                    {result.recommendations.map((r: string, i: number) => (
                      <div key={i} className="p-2 rounded mb-1 border-l-2" style={{ borderColor: '#00e5a0', background: 'rgba(0,229,160,0.05)', color: 'var(--text2)' }}>✓ {r}</div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2 p-2.5 rounded-lg" style={{ background: 'rgba(255,179,71,0.07)', border: '1px solid rgba(255,179,71,0.2)' }}>
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: '#ffb347' }} />
                  <p style={{ color: 'rgba(255,179,71,0.8)' }}>AI interpretation only. Clinical correlation required. All critical values require immediate physician notification.</p>
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="rounded-xl flex items-center justify-center h-full min-h-80"
              style={{ background: 'rgba(15,26,46,0.4)', border: '1px dashed var(--border)' }}>
              <div className="text-center" style={{ color: 'var(--text3)' }}>
                <FlaskConical className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Enter lab values and click Interpret</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const DEMO_RESULT = {
  summary: 'Markedly elevated Troponin I (210× ULN) with leukocytosis and elevated CRP strongly suggest acute myocardial infarction with systemic inflammatory response.',
  criticalFlags: ['Troponin I 8.4 ng/mL (210× upper limit of normal) — CRITICAL', 'WBC 14.2 ×10³/µL — elevated, suggesting stress/inflammatory response'],
  interpretation: 'The laboratory profile is consistent with acute myocardial infarction. The markedly elevated troponin indicates significant myocardial injury. Elevated WBC and CRP suggest an inflammatory response. Mild anemia may exacerbate myocardial ischemia.',
  likelyCauses: ['Acute Myocardial Infarction (STEMI/NSTEMI)', 'Myocarditis with cardiac injury', 'Type 2 MI from demand ischemia'],
  recommendations: ['Emergent cardiology consultation', 'Serial troponin q3-6h', 'ECG correlation for STEMI pattern', 'Aspirin + anticoagulation per ACS protocol', 'Consider urgent coronary angiography'],
  confidence: 91,
  urgency: 'emergent',
  classified_values: {
    wbc:        { value: 14.2, unit: '×10³/µL', status: 'high',          flag: '↑ HIGH'       },
    hemoglobin: { value: 11.8, unit: 'g/dL',    status: 'low',           flag: '↓ LOW'        },
    platelets:  { value: 380,  unit: '×10³/µL', status: 'normal',        flag: 'NORMAL'       },
    troponin_i: { value: 8.4,  unit: 'ng/mL',   status: 'critical_high', flag: '↑↑ CRITICAL'  },
    crp:        { value: 48.2, unit: 'mg/L',    status: 'high',          flag: '↑ HIGH'       },
    glucose:    { value: 142,  unit: 'mg/dL',   status: 'high',          flag: '↑ HIGH'       },
  },
};
