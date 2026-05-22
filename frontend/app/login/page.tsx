'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Lock, Activity } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';

export default function LoginPage() {
  const router = useRouter();
  const { login, isLoading, error } = useAuthStore();
  const [email, setEmail] = useState('admin@medicore.ai');
  const [password, setPassword] = useState('Admin1234!');
  const [role, setRole] = useState('doctor');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(email, password);
      toast.success('Welcome back, Doctor');
      router.push('/dashboard');
    } catch (err: any) {
      toast.error(err?.message || error || 'Login failed');
    }
  };

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg)' }}>
      {/* Left panel */}
      <motion.div
        initial={{ opacity: 0, x: -40 }}
        animate={{ opacity: 1, x: 0 }}
        className="hidden lg:flex flex-1 flex-col items-center justify-center p-12 relative overflow-hidden"
      >
        {/* Background ECG art */}
        <svg className="absolute inset-0 w-full h-full opacity-5" viewBox="0 0 800 600">
          <g stroke="#00d4ff" fill="none" strokeWidth="0.5">
            <circle cx="400" cy="300" r="350"/><circle cx="400" cy="300" r="280"/>
            <circle cx="400" cy="300" r="210"/><circle cx="400" cy="300" r="140"/>
            <line x1="50" y1="300" x2="750" y2="300"/><line x1="400" y1="50" x2="400" y2="550"/>
          </g>
          <path d="M50 300 L150 300 L180 200 L220 400 L260 250 L300 320 L340 300 L400 300 L440 150 L480 450 L520 260 L560 300 L650 300 L750 300"
            stroke="#00d4ff" fill="none" strokeWidth="2"/>
        </svg>

        <div className="relative z-10 text-center">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,#00d4ff,#a78bfa)' }}>
              <Activity className="w-7 h-7 text-white" />
            </div>
            <span className="text-5xl font-black" style={{ fontFamily: 'Syne', color: 'var(--accent)' }}>
              Medi<span style={{ color: 'var(--purple)' }}>Core</span>
            </span>
          </div>
          <p className="text-lg mb-10" style={{ color: 'var(--text2)' }}>
            AI-Powered Clinical Decision Support System
          </p>
          <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto">
            {[
              { label: 'ECG Analysis', color: 'var(--accent)', icon: '⚡' },
              { label: 'Chest X-Ray', color: 'var(--green)', icon: '🫁' },
              { label: 'CT / MRI', color: 'var(--purple)', icon: '🧠' },
              { label: 'Lab Results', color: 'var(--amber)', icon: '🧪' },
            ].map((m) => (
              <div key={m.label} className="rounded-xl p-4 text-center"
                style={{ background: `${m.color}10`, border: `1px solid ${m.color}30` }}>
                <div className="text-2xl mb-1">{m.icon}</div>
                <div className="text-sm font-semibold" style={{ color: m.color }}>{m.label}</div>
              </div>
            ))}
          </div>
          <p className="mt-10 text-xs" style={{ color: 'var(--text3)' }}>
            HIPAA-inspired · Encrypted · Audit-logged · Role-based access
          </p>
        </div>
      </motion.div>

      {/* Right panel - login form */}
      <motion.div
        initial={{ opacity: 0, x: 40 }}
        animate={{ opacity: 1, x: 0 }}
        className="w-full lg:w-[440px] flex flex-col justify-center p-8 lg:p-12"
        style={{ background: 'var(--bg2)', borderLeft: '1px solid var(--border)' }}
      >
        <div className="mb-8">
          <div className="text-3xl font-black mb-1" style={{ fontFamily: 'Syne', color: 'var(--accent)' }}>
            MediCore
          </div>
          <p className="text-xs mb-6" style={{ color: 'var(--text3)' }}>
            Clinical AI Decision Support · v2.4.1
          </p>
          <h2 className="text-xl font-bold mb-1" style={{ fontFamily: 'Syne' }}>Sign in to your account</h2>
          <p className="text-sm" style={{ color: 'var(--text3)' }}>
            Secure access for licensed medical professionals
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          {/* Role selector */}
          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text2)' }}>Role</label>
            <div className="grid grid-cols-3 gap-2">
              {['doctor', 'radiologist', 'admin'].map((r) => (
                <button key={r} type="button" onClick={() => setRole(r)}
                  className="py-2 rounded-lg text-xs font-medium capitalize transition-all"
                  style={{
                    background: role === r ? 'rgba(0,153,204,0.15)' : 'var(--bg3)',
                    border: `1px solid ${role === r ? 'var(--accent2)' : 'var(--border)'}`,
                    color: role === r ? 'var(--accent)' : 'var(--text3)',
                  }}>
                  {r === 'doctor' ? '🩺' : r === 'radiologist' ? '🔬' : '⚙️'} {r}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text2)' }}>Email</label>
            <input
              type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
              className="w-full rounded-lg px-3 py-2.5 text-sm outline-none transition-all"
              style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text)' }}
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text2)' }}>Password</label>
            <input
              type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
              className="w-full rounded-lg px-3 py-2.5 text-sm outline-none transition-all"
              style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text)' }}
            />
          </div>

          {error && (
            <div className="text-xs p-3 rounded-lg" style={{ background: 'rgba(255,77,109,0.1)', color: 'var(--red)', border: '1px solid rgba(255,77,109,0.3)' }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={isLoading}
            className="w-full py-3 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg,var(--accent2),#0055aa)', color: 'white' }}>
            <Lock className="w-4 h-4" />
            {isLoading ? 'Signing in...' : 'Sign In Securely'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs" style={{ color: 'var(--text3)' }}>
          By signing in you agree to HIPAA-compliant data processing.<br />
          All sessions are encrypted and audit-logged.
        </p>
        <div className="mt-3 text-center">
          <a href="/register" className="text-xs" style={{ color: 'var(--accent2)' }}>
            Request access
          </a>
          <span className="mx-2 text-xs" style={{ color: 'var(--text3)' }}>·</span>
          <a href="#" className="text-xs" style={{ color: 'var(--accent2)' }}>Forgot password?</a>
        </div>
      </motion.div>
    </div>
  );
}
