'use client';

import { useState } from 'react';
import { Settings, Shield, Brain, Bell } from 'lucide-react';

const AI_SETTINGS = [
  { label: 'ECG Image Pipeline', value: 'Preprocessing + waveform extraction + rule screen' },
  { label: 'Radiology Pipeline', value: 'Local safety screen; external model optional' },
  { label: 'Lab Pipeline', value: 'Reference ranges + plausibility + critical flags' },
  { label: 'Report Generation', value: 'Backend draft formatter; physician signature required' },
  { label: 'Diagnostic Status', value: 'AI-assisted review only' },
  { label: 'Validation Status', value: 'Not clinically validated or regulatory cleared' },
];

const SECURITY_SETTINGS = [
  { label: 'Audit Logging', status: 'Enabled for key clinical actions', color: '#00e5a0' },
  { label: 'Transport Security', status: 'HTTPS on hosted services', color: '#00e5a0' },
  { label: 'Session Timeout', status: '30 min access token', color: '#ffb347' },
  { label: 'Access Control', status: 'Role-based API guards', color: '#00e5a0' },
  { label: 'Compliance Claim', status: 'No HIPAA/FDA/CE claim', color: '#ffb347' },
];

const ALERT_PREFS = [
  { label: 'Possible ST screen flag', on: true },
  { label: 'Critical lab values', on: true },
  { label: 'Poor image quality', on: true },
  { label: 'Model unavailable fallback', on: true },
  { label: 'Routine study complete', on: false },
];

export default function SettingsPage() {
  const [alerts, setAlerts] = useState(ALERT_PREFS.map((item) => item.on));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2 text-sm font-semibold mb-4">
          <Brain className="w-4 h-4" style={{ color: 'var(--accent)' }} />
          AI Safety Configuration
        </div>
        <div className="space-y-2">
          {AI_SETTINGS.map((setting) => (
            <div key={setting.label} className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg"
              style={{ background: 'var(--bg3)', border: '1px solid var(--border)' }}>
              <span className="text-xs" style={{ color: 'var(--text3)' }}>{setting.label}</span>
              <span className="text-xs text-right max-w-56" style={{ fontFamily: 'DM Mono', color: 'var(--accent)', fontSize: '10px' }}>{setting.value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2 text-sm font-semibold mb-4">
          <Shield className="w-4 h-4" style={{ color: '#00e5a0' }} />
          Security Status
        </div>
        <div className="space-y-2">
          {SECURITY_SETTINGS.map((setting) => (
            <div key={setting.label} className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg"
              style={{ background: 'var(--bg3)', border: '1px solid var(--border)' }}>
              <span className="text-xs" style={{ color: 'var(--text3)' }}>{setting.label}</span>
              <span className="text-xs px-2 py-0.5 rounded-full text-right"
                style={{ background: `${setting.color}15`, color: setting.color }}>{setting.status}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2 text-sm font-semibold mb-4">
          <Bell className="w-4 h-4" style={{ color: '#ffb347' }} />
          Review Flags
        </div>
        <div className="space-y-2">
          {ALERT_PREFS.map((alert, index) => (
            <div key={alert.label} className="flex items-center justify-between px-3 py-2.5 rounded-lg"
              style={{ background: 'var(--bg3)' }}>
              <span className="text-xs" style={{ color: alerts[index] ? 'var(--text)' : 'var(--text3)' }}>{alert.label}</span>
              <button
                onClick={() => setAlerts((prev) => prev.map((value, currentIndex) => currentIndex === index ? !value : value))}
                className="w-9 h-5 rounded-full relative transition-all flex-shrink-0"
                style={{ background: alerts[index] ? 'var(--accent2)' : 'var(--border2)' }}>
                <div className="w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 transition-all"
                  style={{ left: alerts[index] ? '18px' : '2px' }} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2 text-sm font-semibold mb-4">
          <Settings className="w-4 h-4" style={{ color: 'var(--text2)' }} />
          Operator Notes
        </div>
        <div className="p-3 rounded-lg text-xs leading-relaxed"
          style={{ background: 'rgba(255,179,71,0.07)', border: '1px solid rgba(255,179,71,0.2)', color: '#ffb347' }}>
          This MVP is configured for clinical decision support using live uploads and live database records.
          It must not be presented as a validated diagnostic product.
        </div>
      </div>
    </div>
  );
}
