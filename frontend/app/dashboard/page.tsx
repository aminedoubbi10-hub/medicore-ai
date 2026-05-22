'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { AlertTriangle, Activity, Users, FileText, Bell, ArrowUpRight } from 'lucide-react';

const stats = [
  { label: 'Studies Today',   value: '47',  change: '↑ 12%', color: '#00d4ff' },
  { label: 'AI Analyses',     value: '132', change: '↑ 8%',  color: '#00e5a0' },
  { label: 'Pending Review',  value: '18',  change: '↓ 3',   color: '#ffb347' },
  { label: 'Critical Alerts', value: '3',   change: 'Action needed', color: '#ff4d6d' },
];

const alerts = [
  { type: 'critical', title: '🚨 STEMI Pattern Detected', sub: 'Patient #1047 · Mariam B., 58F · ECG · Ward 4B', time: '2 min ago', conf: '94.2%', href: '/ecg' },
  { type: 'warning',  title: '⚠️ Elevated Troponin I',   sub: 'Patient #1052 · Omar K., 71M · 8.4 ng/mL (ref <0.04)', time: '18 min ago', conf: '', href: '/labs' },
  { type: 'info',     title: 'ℹ️ CT Scan Pending',        sub: 'Patient #1038 · Awaiting radiologist review', time: '1h ago', conf: '', href: '/ct-mri' },
];

const patients = [
  { name: 'Mariam Benali',    id: '#1047', age: '58F', type: 'ECG',  status: 'critical', badge: 'STEMI',      href: '/ecg'  },
  { name: 'Omar Khelil',      id: '#1052', age: '71M', type: 'Labs', status: 'critical', badge: 'Troponin↑',  href: '/labs' },
  { name: 'Yasmine Ait Ahmed',id: '#1038', age: '45F', type: 'CT',   status: 'pending',  badge: 'Pending',    href: '/ct-mri' },
  { name: 'Farid Mouloud',    id: '#1031', age: '62M', type: 'X-Ray',status: 'complete', badge: 'Normal',     href: '/xray' },
  { name: 'Houria Saadi',     id: '#1028', age: '39F', type: 'ECG',  status: 'complete', badge: 'AF Detected',href: '/ecg'  },
];

const quick = [
  { label: 'Analyze ECG',       href: '/ecg',     color: 'var(--accent2)' },
  { label: 'Upload X-Ray',      href: '/xray',    color: 'var(--surface2)' },
  { label: 'Enter Lab Values',  href: '/labs',    color: 'var(--surface2)' },
  { label: 'Generate Report',   href: '/reports', color: 'var(--surface2)' },
];

const statusColor: Record<string, string> = {
  critical: '#ff4d6d', pending: '#ffb347', complete: '#00e5a0',
};
const alertBorder: Record<string, string> = {
  critical: '#ff4d6d', warning: '#ffb347', info: '#00d4ff',
};

export default function DashboardPage() {
  return (
    <div>
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {stats.map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
            className="rounded-xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="text-xs uppercase tracking-widest mb-2" style={{ color: 'var(--text3)' }}>{s.label}</div>
            <div className="text-3xl font-black mb-1" style={{ fontFamily: 'Syne', color: s.color }}>{s.value}</div>
            <div className="text-xs" style={{ color: 'var(--text3)' }}>{s.change}</div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* Alerts */}
        <div className="rounded-xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <AlertTriangle className="w-4 h-4" style={{ color: 'var(--red)' }} />
              Critical Alerts
            </div>
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,77,109,0.1)', color: 'var(--red)' }}>3 Active</span>
          </div>
          <div className="space-y-2">
            {alerts.map((a) => (
              <div key={a.title} className="flex items-start gap-2.5 p-3 rounded-lg" style={{ background: 'var(--bg3)', borderLeft: `3px solid ${alertBorder[a.type]}` }}>
                <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: alertBorder[a.type] }} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium mb-0.5">{a.title}</div>
                  <div className="text-xs truncate" style={{ color: 'var(--text2)' }}>{a.sub}</div>
                  <div className="text-[10px] mt-1" style={{ color: 'var(--text3)' }}>{a.time}{a.conf && ` · Confidence: ${a.conf}`}</div>
                </div>
                <Link href={a.href} className="text-xs px-2 py-1 rounded flex-shrink-0 transition-all"
                  style={{ background: 'var(--surface2)', border: '1px solid var(--border2)', color: 'var(--text2)' }}>
                  Review
                </Link>
              </div>
            ))}
          </div>
        </div>

        {/* Recent patients */}
        <div className="rounded-xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Users className="w-4 h-4" style={{ color: 'var(--accent)' }} />
              Recent Patients
            </div>
            <Link href="/patients" className="text-xs" style={{ color: 'var(--accent2)' }}>View all</Link>
          </div>
          <div className="space-y-1">
            {patients.map((p) => (
              <Link key={p.id} href={p.href}
                className="flex items-center gap-3 px-2.5 py-2 rounded-lg transition-all"
                style={{ border: '1px solid transparent' }}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold"
                  style={{ background: 'var(--surface3)', color: 'var(--accent)', border: '1px solid var(--border2)' }}>
                  {p.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">{p.name}
                    <span className="ml-1.5 font-normal" style={{ color: 'var(--text3)' }}>{p.age} · {p.id}</span>
                  </div>
                  <div className="text-[10px] mt-0.5 px-1.5 py-0.5 rounded inline-block"
                    style={{ background: 'rgba(0,212,255,0.1)', color: 'var(--accent)' }}>{p.type}</div>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0"
                  style={{ background: `${statusColor[p.status]}15`, color: statusColor[p.status] }}>
                  {p.badge}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Quick actions + model confidence */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="text-sm font-semibold mb-3">Quick Actions</div>
          <div className="space-y-2">
            {quick.map((q) => (
              <Link key={q.label} href={q.href}
                className="flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all group"
                style={{ background: q.color, border: '1px solid var(--border2)', color: 'var(--text)' }}>
                {q.label}
                <ArrowUpRight className="w-3.5 h-3.5 opacity-50 group-hover:opacity-100 transition-opacity" />
              </Link>
            ))}
          </div>
        </div>

        <div className="rounded-xl p-4 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="text-sm font-semibold mb-4">AI Confidence Avg</div>
          <div className="text-6xl font-black mb-1" style={{ fontFamily: 'Syne', color: 'var(--green)' }}>89<span className="text-2xl">%</span></div>
          <div className="text-xs mb-4" style={{ color: 'var(--text3)' }}>Average model confidence this week</div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'ECG Model',  val: '94.2%', color: 'var(--green)'  },
              { label: 'X-Ray',     val: '91.7%', color: 'var(--accent)' },
              { label: 'CT/MRI',    val: '87.3%', color: 'var(--purple)' },
              { label: 'Labs',      val: '92.1%', color: 'var(--amber)'  },
            ].map((m) => (
              <div key={m.label} className="rounded-lg p-2" style={{ background: 'var(--bg3)' }}>
                <div className="text-sm font-bold" style={{ color: m.color }}>{m.val}</div>
                <div className="text-[10px]" style={{ color: 'var(--text3)' }}>{m.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="text-sm font-semibold mb-3">Study Distribution</div>
          {[
            { label: 'ECG Analyses',  val: 38, max: 50, color: 'var(--accent)' },
            { label: 'Chest X-Rays', val: 22, max: 50, color: 'var(--green)'  },
            { label: 'CT Scans',     val: 15, max: 50, color: 'var(--purple)' },
            { label: 'Lab Results',  val: 41, max: 50, color: 'var(--amber)'  },
            { label: 'MRI Studies',  val: 8,  max: 50, color: 'var(--red)'    },
          ].map((s) => (
            <div key={s.label} className="mb-2.5">
              <div className="flex justify-between text-xs mb-1">
                <span style={{ color: 'var(--text2)' }}>{s.label}</span>
                <span style={{ color: 'var(--text3)' }}>{s.val}</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface3)' }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${(s.val / s.max) * 100}%`, background: s.color }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
