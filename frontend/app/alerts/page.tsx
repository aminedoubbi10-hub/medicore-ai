'use client';
import Link from 'next/link';
import { Bell, AlertTriangle } from 'lucide-react';

const ALERTS = [
  { type: 'critical', icon: '🚨', title: 'STEMI Pattern Detected — Patient #1047',
    desc: 'AI ECG Analysis detected inferior STEMI with 94.2% confidence. ST elevation in II, III, aVF. Reciprocal changes in I, aVL.',
    time: '2 min ago', href: '/ecg' },
  { type: 'warning',  icon: '⚠️', title: 'Critical Troponin — Patient #1052',
    desc: 'Troponin I elevated at 8.4 ng/mL (ref <0.04 ng/mL). 210× upper limit of normal. Consistent with myocardial injury.',
    time: '18 min ago', href: '/labs' },
  { type: 'warning',  icon: '⚠️', title: 'Pending CT Analysis — Patient #1038',
    desc: 'CT Chest uploaded and awaiting AI analysis. Radiologist review required.',
    time: '1h ago', href: '/ct-mri' },
  { type: 'info',     icon: 'ℹ️', title: 'SpO₂ Alert — Patient #1047',
    desc: 'Oxygen saturation dropped to 94%. Consider supplemental oxygen.',
    time: '2h ago', href: '/vitals' },
];

const ALERT_BORDER: Record<string, string> = { critical: '#ff4d6d', warning: '#ffb347', info: '#00d4ff' };
const ALERT_DOT: Record<string, string> = { critical: '#ff4d6d', warning: '#ffb347', info: '#00d4ff' };

export default function AlertsPage() {
  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <span className="text-xs" style={{ color: 'var(--text3)' }}>Filter:</span>
        <button className="px-3 py-1 rounded text-xs font-medium"
          style={{ background: 'rgba(255,77,109,0.1)', color: '#ff4d6d', border: '1px solid rgba(255,77,109,0.3)' }}>
          Critical (1)
        </button>
        <button className="px-3 py-1 rounded text-xs font-medium"
          style={{ background: 'var(--surface2)', color: '#ffb347', border: '1px solid var(--border2)' }}>
          Urgent (2)
        </button>
        <button className="px-3 py-1 rounded text-xs font-medium"
          style={{ background: 'var(--surface2)', color: 'var(--text2)', border: '1px solid var(--border2)' }}>
          All (4)
        </button>
      </div>
      <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        {ALERTS.map((a) => (
          <div key={a.title} className="flex items-start gap-3 p-3 rounded-lg"
            style={{ background: 'var(--bg3)', borderLeft: `3px solid ${ALERT_BORDER[a.type]}` }}>
            <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: ALERT_DOT[a.type] }} />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium mb-1">{a.icon} {a.title}</div>
              <div className="text-xs mb-1" style={{ color: 'var(--text2)' }}>{a.desc}</div>
              <div className="text-[10px]" style={{ color: 'var(--text3)' }}>{a.time}</div>
            </div>
            <Link href={a.href} className="px-2.5 py-1 rounded text-[10px] flex-shrink-0 transition-all"
              style={{ background: 'var(--surface2)', border: '1px solid var(--border2)', color: 'var(--text2)' }}>
              Review
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
