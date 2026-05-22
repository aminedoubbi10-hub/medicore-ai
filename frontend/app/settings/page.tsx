'use client';
import { useState } from 'react';
import { Settings, Shield, Brain, Bell } from 'lucide-react';

const AI_SETTINGS = [
  { label: 'ECG Analysis Model',       value: 'MediCore CardioNet v2.4 + Claude' },
  { label: 'CXR Detection Model',      value: 'MediCore ChestNet v3.1 + Claude'  },
  { label: 'Lab Interpretation',       value: 'Claude Sonnet 4 (claude-sonnet-4-20250514)' },
  { label: 'Report Generation',        value: 'Claude Sonnet 4 (claude-sonnet-4-20250514)' },
  { label: 'Confidence Threshold',     value: '≥ 70% — show differentials'        },
  { label: 'Alert Threshold',          value: '≥ 85% — trigger critical alerts'   },
  { label: 'Minimum Report Confidence',value: '≥ 60% — generate report'           },
];

const SECURITY_SETTINGS = [
  { label: 'Audit Logging',      status: 'Active',   color: '#00e5a0' },
  { label: 'Encrypted Storage',  status: 'AES-256',  color: '#00e5a0' },
  { label: 'TLS Encryption',     status: 'TLS 1.3',  color: '#00e5a0' },
  { label: 'Session Timeout',    status: '30 min',   color: '#ffb347' },
  { label: 'HIPAA Mode',         status: 'Enabled',  color: '#00e5a0' },
  { label: '2FA Required',       status: 'Enabled',  color: '#00e5a0' },
  { label: 'Data Retention',     status: '7 years',  color: '#00d4ff' },
  { label: 'Access Control',     status: 'RBAC',     color: '#00e5a0' },
];

const ALERT_PREFS = [
  { label: 'STEMI Detection',          on: true  },
  { label: 'Critical Lab Values',      on: true  },
  { label: 'Tension Pneumothorax',     on: true  },
  { label: 'Intracranial Bleed',       on: true  },
  { label: 'Severe Sepsis Patterns',   on: true  },
  { label: 'Routine Study Complete',   on: false },
];

export default function SettingsPage() {
  const [alerts, setAlerts] = useState(ALERT_PREFS.map((a) => a.on));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* AI Settings */}
      <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2 text-sm font-semibold mb-4">
          <Brain className="w-4 h-4" style={{ color: 'var(--accent)' }} />
          AI Model Settings
        </div>
        <div className="space-y-2">
          {AI_SETTINGS.map((s) => (
            <div key={s.label} className="flex items-center justify-between px-3 py-2.5 rounded-lg"
              style={{ background: 'var(--bg3)', border: '1px solid var(--border)' }}>
              <span className="text-xs" style={{ color: 'var(--text3)' }}>{s.label}</span>
              <span className="text-xs text-right max-w-40" style={{ fontFamily: 'DM Mono', color: 'var(--accent)', fontSize: '10px' }}>{s.value}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 p-3 rounded-lg text-xs" style={{ background: 'rgba(0,212,255,0.05)', border: '1px solid rgba(0,212,255,0.15)', color: 'var(--text2)' }}>
          AI models are updated automatically. All changes are logged to the audit trail. Contact admin to modify thresholds.
        </div>
      </div>

      {/* Security */}
      <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2 text-sm font-semibold mb-4">
          <Shield className="w-4 h-4" style={{ color: '#00e5a0' }} />
          Security & Compliance
        </div>
        <div className="space-y-2">
          {SECURITY_SETTINGS.map((s) => (
            <div key={s.label} className="flex items-center justify-between px-3 py-2.5 rounded-lg"
              style={{ background: 'var(--bg3)', border: '1px solid var(--border)' }}>
              <span className="text-xs" style={{ color: 'var(--text3)' }}>{s.label}</span>
              <span className="text-xs px-2 py-0.5 rounded-full"
                style={{ background: `${s.color}15`, color: s.color }}>{s.status}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Alert preferences */}
      <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2 text-sm font-semibold mb-4">
          <Bell className="w-4 h-4" style={{ color: '#ffb347' }} />
          Alert Preferences
        </div>
        <div className="space-y-2">
          {ALERT_PREFS.map((a, i) => (
            <div key={a.label} className="flex items-center justify-between px-3 py-2.5 rounded-lg"
              style={{ background: 'var(--bg3)' }}>
              <span className="text-xs" style={{ color: alerts[i] ? 'var(--text)' : 'var(--text3)' }}>{a.label}</span>
              <button
                onClick={() => setAlerts((prev) => prev.map((v, j) => j === i ? !v : v))}
                className="w-9 h-5 rounded-full relative transition-all flex-shrink-0"
                style={{ background: alerts[i] ? 'var(--accent2)' : 'var(--border2)' }}>
                <div className="w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 transition-all"
                  style={{ left: alerts[i] ? '18px' : '2px' }} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Account */}
      <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2 text-sm font-semibold mb-4">
          <Settings className="w-4 h-4" style={{ color: 'var(--text2)' }} />
          Account & Profile
        </div>
        <div className="space-y-3">
          {[
            { label: 'Full Name',       value: 'Dr. Hassan Al-Rashid',    readonly: true  },
            { label: 'Email',           value: 'dr.hassan@medicore.ai',   readonly: true  },
            { label: 'Role',            value: 'Senior Cardiologist',     readonly: true  },
            { label: 'Institution',     value: 'MediCore Medical Center', readonly: false },
            { label: 'License Number',  value: 'DZ-MED-2018-4471',       readonly: false },
          ].map((f) => (
            <div key={f.label}>
              <label className="block text-xs mb-1" style={{ color: 'var(--text3)' }}>{f.label}</label>
              <input readOnly={f.readonly} defaultValue={f.value}
                className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                style={{
                  background: f.readonly ? 'var(--bg)' : 'var(--bg3)',
                  border: '1px solid var(--border)',
                  color: f.readonly ? 'var(--text3)' : 'var(--text)',
                  cursor: f.readonly ? 'default' : 'text',
                }} />
            </div>
          ))}
          <button className="mt-2 px-4 py-2 rounded-lg text-xs font-medium transition-all"
            style={{ background: 'linear-gradient(135deg,var(--accent2),#005588)', color: 'white' }}>
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
