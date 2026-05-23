'use client';

import { useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import { patientsAPI } from '@/lib/api';

export default function PatientsPage() {
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    patientsAPI
      .list({ limit: 50 })
      .then(setPatients)
      .catch((err) => setError(err.message || 'Unable to load patients'))
      .finally(() => setLoading(false));
  }, []);

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
            New Patient
          </button>
        </div>

        {loading && <EmptyRows text="Loading live patients..." />}
        {error && <EmptyRows text={error} />}
        {!loading && !error && patients.length === 0 && (
          <EmptyRows text="No patients have been created yet. Create a patient record before using this as live clinical workflow." />
        )}

        {patients.length > 0 && (
          <table className="w-full text-xs">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Patient', 'Age', 'Sex', 'Code', 'Action'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 font-medium uppercase tracking-wider" style={{ color: 'var(--text3)', fontSize: '10px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {patients.map((patient) => (
                <tr key={patient.id} style={{ borderBottom: '1px solid rgba(30,48,80,0.4)' }}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-[10px]"
                        style={{ background: 'var(--surface3)', color: 'var(--accent)', border: '1px solid var(--border2)' }}>
                        {initials(patient.full_name)}
                      </div>
                      <div>
                        <div className="font-medium">{patient.full_name}</div>
                        <div style={{ color: 'var(--text3)' }}>{patient.id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--text2)' }}>{ageFromDob(patient.date_of_birth)}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--text2)' }}>{patient.sex}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--text2)' }}>{patient.patient_code}</td>
                  <td className="px-4 py-3">
                    <span className="px-2.5 py-1 rounded text-[10px]"
                      style={{ background: 'var(--surface2)', border: '1px solid var(--border2)', color: 'var(--text2)' }}>
                      Live
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function EmptyRows({ text }: { text: string }) {
  return (
    <div className="p-8 text-center text-xs" style={{ color: 'var(--text3)' }}>
      {text}
    </div>
  );
}

function initials(name: string) {
  return name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
}

function ageFromDob(dob: string) {
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return 'Unknown';
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDelta = now.getMonth() - birth.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < birth.getDate())) age -= 1;
  return age;
}
