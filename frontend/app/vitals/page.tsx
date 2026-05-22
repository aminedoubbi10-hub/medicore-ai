'use client';
import { motion } from 'framer-motion';
import { Heart, AlertTriangle } from 'lucide-react';

const VITALS = [
  { icon: '❤️', label: 'Heart Rate',      value: '112',    unit: 'bpm',   status: 'Tachycardia', color: '#ff4d6d' },
  { icon: '🩸', label: 'Blood Pressure',  value: '158/96', unit: 'mmHg',  status: 'Hypertensive', color: '#ffb347' },
  { icon: '🫁', label: 'Resp. Rate',      value: '22',     unit: '/min',  status: 'Tachypnea',    color: '#ffb347' },
  { icon: '🌡️', label: 'Temperature',    value: '37.8',   unit: '°C',    status: 'Low-grade fever', color: '#ffb347' },
  { icon: '💧', label: 'SpO₂',           value: '94',     unit: '%',     status: '⚠ Low',        color: '#ff4d6d' },
  { icon: '⚖️', label: 'GCS',            value: '15/15',  unit: '',      status: 'Alert',        color: '#00e5a0' },
];

export default function VitalsPage() {
  return (
    <div className="space-y-4">
      <div className="rounded-xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Heart className="w-4 h-4" style={{ color: '#ff4d6d' }} />
            Current Vitals — Patient #1047 · Mariam B., 58F
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs" style={{ background: 'var(--surface2)', border: '1px solid #00e5a0', color: '#00e5a0' }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#00e5a0' }} />
            Live
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {VITALS.map((v, i) => (
            <motion.div key={v.label} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.07 }}
              className="rounded-xl p-3 text-center" style={{ background: 'var(--bg3)', border: '1px solid var(--border)' }}>
              <div className="text-2xl mb-1">{v.icon}</div>
              <div className="text-2xl font-black mb-0.5" style={{ fontFamily: 'Syne', color: v.color }}>
                {v.value}<span className="text-sm font-normal ml-0.5" style={{ color: 'var(--text3)' }}>{v.unit}</span>
              </div>
              <div className="text-xs" style={{ color: 'var(--text3)' }}>{v.label}</div>
              <div className="text-[10px] mt-1" style={{ color: v.color }}>{v.status}</div>
            </motion.div>
          ))}
        </div>
      </div>

      <div className="rounded-xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="text-sm font-semibold mb-3">AI Vitals Assessment</div>
        <div className="p-3 rounded-lg flex gap-2 mb-3" style={{ background: 'rgba(255,77,109,0.08)', border: '1px solid rgba(255,77,109,0.3)' }}>
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#ff4d6d' }} />
          <div>
            <div className="text-xs font-semibold mb-1" style={{ color: '#ff4d6d' }}>🚨 Concerning Vital Signs Pattern</div>
            <div className="text-xs leading-relaxed" style={{ color: 'var(--text2)' }}>
              Combination of tachycardia (112 bpm), hypertension (158/96), tachypnea (22/min), and hypoxemia (SpO₂ 94%) in the context of chest pain suggests possible acute coronary syndrome or pulmonary embolism. Correlate with ECG and troponin.
            </div>
          </div>
        </div>
        <div className="flex gap-2 p-2.5 rounded-lg text-xs" style={{ background: 'rgba(255,179,71,0.07)', border: '1px solid rgba(255,179,71,0.2)', color: '#ffb347' }}>
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          AI vitals interpretation is supplementary only. Clinical assessment by a physician is always required.
        </div>
      </div>

      {/* Trend chart placeholder */}
      <div className="rounded-xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="text-sm font-semibold mb-3">Vitals Trend (Last 6 Hours)</div>
        <div className="relative h-32" style={{ background: 'var(--bg3)', borderRadius: '8px' }}>
          <svg width="100%" height="100%" viewBox="0 0 600 128" preserveAspectRatio="none">
            <defs>
              <linearGradient id="hrGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ff4d6d" stopOpacity="0.3"/>
                <stop offset="100%" stopColor="#ff4d6d" stopOpacity="0"/>
              </linearGradient>
              <linearGradient id="spo2Grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#00d4ff" stopOpacity="0.3"/>
                <stop offset="100%" stopColor="#00d4ff" stopOpacity="0"/>
              </linearGradient>
            </defs>
            {/* HR line */}
            <polyline points="0,80 100,75 200,70 300,65 400,60 500,55 600,52"
              fill="none" stroke="#ff4d6d" strokeWidth="2"/>
            {/* SpO2 line */}
            <polyline points="0,40 100,45 200,50 300,55 400,60 500,65 600,68"
              fill="none" stroke="#00d4ff" strokeWidth="2" strokeDasharray="4,2"/>
          </svg>
          <div className="absolute bottom-2 right-3 flex gap-3 text-[10px]" style={{ color: 'var(--text3)' }}>
            <span><span style={{ color: '#ff4d6d' }}>—</span> Heart Rate</span>
            <span><span style={{ color: '#00d4ff' }}>- -</span> SpO₂</span>
          </div>
        </div>
      </div>
    </div>
  );
}
