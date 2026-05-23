'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { AlertTriangle, Activity, Users, ArrowUpRight } from 'lucide-react';
import { alertsAPI, patientsAPI } from '@/lib/api';

const quick = [
  { label: 'Screen ECG', href: '/ecg', color: 'var(--accent2)' },
  { label: 'Upload X-Ray', href: '/xray', color: 'var(--surface2)' },
  { label: 'Screen Lab Values', href: '/labs', color: 'var(--surface2)' },
  { label: 'Generate Report', href: '/reports', color: 'var(--surface2)' },
];

const alertBorder: Record<string, string> = {
  critical: '#ff4d6d',
  warning: '#ffb347',
  info: '#00d4ff',
};

export default function DashboardPage() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      alertsAPI.list({ limit: 5 }).catch(() => []),
      patientsAPI.list({ limit: 5 }).catch(() => []),
    ])
      .then(([liveAlerts, livePatients]) => {
        setAlerts(liveAlerts);
        setPatients(livePatients);
      })
      .finally(() => setLoading(false));
  }, []);

  const openAlerts = alerts.filter((alert) => !alert.is_acknowledged);
  const criticalAlerts = openAlerts.filter((alert) => alert.severity === 'critical');

  const stats = [
    { label: 'Live Patients', value: patients.length, change: 'from database', color: '#00d4ff' },
    { label: 'Open Alerts', value: openAlerts.length, change: 'requires review', color: '#ffb347' },
    { label: 'Critical Alerts', value: criticalAlerts.length, change: 'clinical escalation', color: '#ff4d6d' },
    { label: 'Mode', value: 'MVP', change: 'AI-assisted only', color: '#00e5a0' },
  ];

  return (
    <div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {stats.map((stat, index) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.07 }}
            className="rounded-xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="text-xs uppercase tracking-widest mb-2" style={{ color: 'var(--text3)' }}>{stat.label}</div>
            <div className="text-3xl font-black mb-1" style={{ fontFamily: 'Syne', color: stat.color }}>{stat.value}</div>
            <div className="text-xs" style={{ color: 'var(--text3)' }}>{stat.change}</div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <div className="rounded-xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <AlertTriangle className="w-4 h-4" style={{ color: 'var(--red)' }} />
              Live Review Alerts
            </div>
            <Link href="/alerts" className="text-xs" style={{ color: 'var(--accent2)' }}>View all</Link>
          </div>
          <div className="space-y-2">
            {loading && <Empty text="Loading alerts..." />}
            {!loading && alerts.length === 0 && <Empty text="No alerts yet. Upload studies to generate review flags." />}
            {alerts.map((alert) => {
              const color = alertBorder[alert.severity] || alertBorder.info;
              return (
                <div key={alert.id} className="flex items-start gap-2.5 p-3 rounded-lg"
                  style={{ background: 'var(--bg3)', borderLeft: `3px solid ${color}` }}>
                  <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: color }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium mb-0.5">{alert.title}</div>
                    <div className="text-xs truncate" style={{ color: 'var(--text2)' }}>{alert.description}</div>
                    <div className="text-[10px] mt-1" style={{ color: 'var(--text3)' }}>
                      {new Date(alert.created_at).toLocaleString()}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Users className="w-4 h-4" style={{ color: 'var(--accent)' }} />
              Live Patients
            </div>
            <Link href="/patients" className="text-xs" style={{ color: 'var(--accent2)' }}>View all</Link>
          </div>
          <div className="space-y-1">
            {loading && <Empty text="Loading patients..." />}
            {!loading && patients.length === 0 && <Empty text="No patient records yet." />}
            {patients.map((patient) => (
              <div key={patient.id} className="flex items-center gap-3 px-2.5 py-2 rounded-lg"
                style={{ border: '1px solid transparent' }}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold"
                  style={{ background: 'var(--surface3)', color: 'var(--accent)', border: '1px solid var(--border2)' }}>
                  {patient.full_name.split(' ').map((part: string) => part[0]).join('').slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">{patient.full_name}</div>
                  <div className="text-[10px] mt-0.5" style={{ color: 'var(--text3)' }}>{patient.patient_code} · {patient.sex}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="text-sm font-semibold mb-3">Quick Actions</div>
          <div className="space-y-2">
            {quick.map((item) => (
              <Link key={item.label} href={item.href}
                className="flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all group"
                style={{ background: item.color, border: '1px solid var(--border2)', color: 'var(--text)' }}>
                {item.label}
                <ArrowUpRight className="w-3.5 h-3.5 opacity-50 group-hover:opacity-100 transition-opacity" />
              </Link>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2 rounded-xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="flex items-start gap-3">
            <Activity className="w-4 h-4 mt-0.5" style={{ color: 'var(--accent)' }} />
            <div>
              <div className="text-sm font-semibold mb-1">Clinical Safety Mode</div>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text2)' }}>
                This dashboard only displays live database records and generated review flags. The app no longer shows hard-coded clinical cases or confidence examples as if they were real patients.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="p-3 rounded-lg text-xs" style={{ background: 'var(--bg3)', color: 'var(--text3)', border: '1px dashed var(--border)' }}>
      {text}
    </div>
  );
}
