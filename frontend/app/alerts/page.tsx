'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Bell } from 'lucide-react';
import { alertsAPI } from '@/lib/api';

const ALERT_BORDER: Record<string, string> = {
  critical: '#ff4d6d',
  warning: '#ffb347',
  info: '#00d4ff',
};

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    alertsAPI
      .list({ limit: 50 })
      .then(setAlerts)
      .catch((err) => setError(err.message || 'Unable to load alerts'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
        <Bell className="w-4 h-4" style={{ color: 'var(--accent)' }} />
        Clinical Review Alerts
      </div>

      <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        {loading && <EmptyState text="Loading live alerts..." />}
        {error && <EmptyState text={error} tone="warning" />}
        {!loading && !error && alerts.length === 0 && (
          <EmptyState text="No live alerts yet. Upload ECG, X-ray, or lab data to generate review flags." />
        )}

        {alerts.map((alert) => {
          const color = ALERT_BORDER[alert.severity] || ALERT_BORDER.info;
          return (
            <div key={alert.id} className="flex items-start gap-3 p-3 rounded-lg"
              style={{ background: 'var(--bg3)', borderLeft: `3px solid ${color}` }}>
              <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: color }} />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium mb-1">{alert.title}</div>
                <div className="text-xs mb-1" style={{ color: 'var(--text2)' }}>{alert.description}</div>
                <div className="text-[10px]" style={{ color: 'var(--text3)' }}>
                  {new Date(alert.created_at).toLocaleString()} · {alert.alert_type}
                </div>
              </div>
              <Link href="/dashboard" className="px-2.5 py-1 rounded text-[10px] flex-shrink-0 transition-all"
                style={{ background: 'var(--surface2)', border: '1px solid var(--border2)', color: 'var(--text2)' }}>
                Review
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EmptyState({ text, tone = 'info' }: { text: string; tone?: 'info' | 'warning' }) {
  const color = tone === 'warning' ? '#ffb347' : 'var(--text3)';
  return (
    <div className="flex items-center gap-2 p-3 rounded-lg text-xs"
      style={{ background: 'var(--bg3)', border: '1px dashed var(--border)', color }}>
      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
      {text}
    </div>
  );
}
