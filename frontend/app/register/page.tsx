'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Activity, UserPlus } from 'lucide-react';
import { authAPI } from '@/lib/api';
import { toast } from 'sonner';

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    full_name: '', email: '', password: '', role: 'doctor',
    specialty: '', license_number: '', institution: '',
  });

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await authAPI.register(form);
      toast.success('Account created! Please sign in.');
      router.push('/login');
    } catch (err: any) {
      toast.error(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg)' }}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md rounded-2xl p-8"
        style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg,var(--accent),var(--purple))' }}>
            <Activity className="w-4 h-4 text-white" />
          </div>
          <span className="text-lg font-black" style={{ fontFamily: 'Syne', color: 'var(--accent)' }}>MediCore</span>
        </div>

        <h2 className="text-xl font-bold mb-1" style={{ fontFamily: 'Syne' }}>Request Access</h2>
        <p className="text-sm mb-6" style={{ color: 'var(--text3)' }}>For licensed medical professionals only</p>

        <form onSubmit={submit} className="space-y-3">
          <Field label="Full Name (with title)" value={form.full_name} onChange={set('full_name')} placeholder="Dr. First Last" required />
          <Field label="Professional Email" value={form.email} onChange={set('email')} type="email" placeholder="dr.name@hospital.com" required />
          <Field label="Password (min 8 chars)" value={form.password} onChange={set('password')} type="password" placeholder="••••••••" required />

          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text2)' }}>Role</label>
            <select value={form.role} onChange={set('role')}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text)' }}>
              <option value="doctor">Doctor</option>
              <option value="radiologist">Radiologist</option>
              <option value="admin">Administrator</option>
            </select>
          </div>

          <Field label="Specialty" value={form.specialty} onChange={set('specialty')} placeholder="e.g. Cardiology, Radiology" />
          <Field label="Medical License Number" value={form.license_number} onChange={set('license_number')} placeholder="e.g. DZ-MED-2018-XXXX" />
          <Field label="Institution / Hospital" value={form.institution} onChange={set('institution')} placeholder="e.g. University Hospital" />

          <button type="submit" disabled={loading}
            className="w-full py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50 mt-2"
            style={{ background: 'linear-gradient(135deg,var(--accent2),#005588)', color: 'white' }}>
            <UserPlus className="w-4 h-4" />
            {loading ? 'Submitting...' : 'Request Access'}
          </button>
        </form>

        <p className="mt-4 text-center text-xs" style={{ color: 'var(--text3)' }}>
          Already have access?{' '}
          <a href="/login" style={{ color: 'var(--accent2)' }}>Sign in</a>
        </p>
      </motion.div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', placeholder, required }: any) {
  return (
    <div>
      <label className="block text-xs mb-1" style={{ color: 'var(--text2)' }}>{label}</label>
      <input type={type} value={value} onChange={onChange} placeholder={placeholder} required={required}
        className="w-full rounded-lg px-3 py-2 text-sm outline-none"
        style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text)' }} />
    </div>
  );
}
