'use client';
import Link from 'next/link';
import { Users } from 'lucide-react';

const PATIENTS = [
  { name: 'Mariam Benali',     id: '#1047', age: '58', sex: 'F', type: 'ECG',  badge: 'STEMI',      status: 'critical', href: '/ecg'   },
  { name: 'Omar Khelil',       id: '#1052', age: '71', sex: 'M', type: 'Labs', badge: 'Troponin↑',  status: 'critical', href: '/labs'  },
  { name: 'Yasmine Ait Ahmed', id: '#1038', age: '45', sex: 'F', type: 'CT',   badge: 'Pending',    status: 'pending',  href: '/ct-mri'},
  { name: 'Farid Mouloud',     id: '#1031', age: '62', sex: 'M', type: 'X-Ray',badge: 'Normal',     status: 'complete', href: '/xray'  },
  { name: 'Houria Saadi',      id: '#1028', age: '39', sex: 'F', type: 'ECG',  badge: 'AF Detected',status: 'complete', href: '/ecg'   },
  { name: 'Karim Bouzid',      id: '#1019', age: '55', sex: 'M', type: 'MRI',  badge: 'Normal',     status: 'complete', href: '/ct-mri'},
];

const STATUS_COLORS: Record<string, string> = {
  critical: '#ff4d6d', pending: '#ffb347', complete: '#00e5a0',
};

export default function PatientsPage() {
  return (
    <div>
      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between p-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Users className="w-4 h-4" style={{ color: 'var(--accent)' }} />
            Patient Registry
          </div>
          <button className="px-3 py-1.5 rounded-lg text-xs font-semibold"
            style={{ background: 'linear-gradient(135deg,var(--accent2),#005588)', color: 'white' }}>
            + New Patient
          </button>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Patient', 'Age', 'Last Study', 'Status', 'Action'].map((h) => (
                <th key={h} className="text-left px-4 py-3 font-medium uppercase tracking-wider" style={{ color: 'var(--text3)', fontSize: '10px' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PATIENTS.map((p) => (
              <tr key={p.id} style={{ borderBottom: '1px solid rgba(30,48,80,0.4)' }}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-[10px]"
                      style={{ background: 'var(--surface3)', color: 'var(--accent)', border: '1px solid var(--border2)' }}>
                      {p.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                    </div>
                    <div>
                      <div className="font-medium">{p.name}</div>
                      <div style={{ color: 'var(--text3)' }}>{p.id}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3" style={{ color: 'var(--text2)' }}>{p.age}{p.sex}</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 rounded text-[10px]" style={{ background: 'rgba(0,212,255,0.1)', color: 'var(--accent)' }}>{p.type}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                    style={{ background: `${STATUS_COLORS[p.status]}15`, color: STATUS_COLORS[p.status] }}>
                    {p.badge}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <Link href={p.href} className="px-2.5 py-1 rounded text-[10px] transition-all"
                    style={{ background: 'var(--surface2)', border: '1px solid var(--border2)', color: 'var(--text2)' }}>
                    Open
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
