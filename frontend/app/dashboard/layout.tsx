'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/authStore';
import {
  LayoutDashboard, Users, Activity, Square, Circle,
  FlaskConical, Heart, FileText, Bell, Settings, LogOut,
} from 'lucide-react';

const NAV = [
  { href: '/dashboard', label: 'Dashboard',    icon: LayoutDashboard },
  { href: '/patients',  label: 'Patients',      icon: Users },
  { label: 'ANALYSIS', type: 'section' },
  { href: '/ecg',       label: 'ECG Analyzer',  icon: Activity,    badge: 'AI' },
  { href: '/xray',      label: 'Chest X-Ray',   icon: Square },
  { href: '/ct-mri',    label: 'CT / MRI',      icon: Circle },
  { href: '/labs',      label: 'Lab Results',   icon: FlaskConical },
  { href: '/vitals',    label: 'Vitals',        icon: Heart },
  { label: 'SYSTEM', type: 'section' },
  { href: '/reports',   label: 'AI Reports',    icon: FileText },
  { href: '/alerts',    label: 'Alerts',        icon: Bell,        badge: '3' },
  { href: '/settings',  label: 'Settings',      icon: Settings },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, logout } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated) router.push('/login');
  }, [isAuthenticated, router]);

  if (!isAuthenticated) return null;

  const initials = user?.full_name?.split(' ').map((n) => n[0]).join('').slice(0, 2) || 'DR';

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg)' }}>
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 flex flex-col" style={{ background: 'var(--bg2)', borderRight: '1px solid var(--border)' }}>
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg,var(--accent),var(--purple))' }}>
            <Activity className="w-4 h-4 text-white" />
          </div>
          <span className="text-base font-black" style={{ fontFamily: 'Syne', color: 'var(--accent)' }}>
            Medi<span style={{ color: 'var(--purple)' }}>Core</span>
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 overflow-y-auto space-y-0.5">
          {NAV.map((item, i) => {
            if (item.type === 'section') {
              return (
                <div key={i} className="px-2 pt-4 pb-1 text-[10px] font-semibold tracking-widest uppercase"
                  style={{ color: 'var(--text3)' }}>
                  {item.label}
                </div>
              );
            }
            const Icon = item.icon!;
            const active = pathname === item.href;
            return (
              <Link key={item.href} href={item.href!}
                className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-all group"
                style={{
                  background: active ? 'var(--surface2)' : 'transparent',
                  border: `1px solid ${active ? 'var(--accent3)' : 'transparent'}`,
                  color: active ? 'var(--accent)' : 'var(--text2)',
                }}>
                <Icon className="w-4 h-4 flex-shrink-0" style={{ opacity: active ? 1 : 0.6 }} />
                <span className="flex-1">{item.label}</span>
                {item.badge && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{ background: item.badge === '3' ? 'var(--red)' : 'rgba(0,212,255,0.2)', color: item.badge === '3' ? 'white' : 'var(--accent)' }}>
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div className="px-2 py-3" style={{ borderTop: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer transition-all"
            style={{ background: 'transparent' }}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold"
              style={{ background: 'var(--surface3)', color: 'var(--accent)', border: '1px solid var(--border2)' }}>
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium truncate">{user?.full_name || 'Doctor'}</div>
              <div className="text-[10px] capitalize" style={{ color: 'var(--text3)' }}>{user?.role}</div>
            </div>
            <button onClick={() => { logout(); router.push('/login'); }}
              className="p-1 rounded opacity-50 hover:opacity-100 transition-opacity">
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="px-2.5 pt-2 text-[10px] tracking-wide"
            style={{ color: 'var(--text3)', opacity: 0.45 }}>
            made by amine
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="h-14 flex items-center gap-4 px-5 flex-shrink-0"
          style={{ background: 'var(--bg2)', borderBottom: '1px solid var(--border)' }}>
          <h1 className="text-base font-semibold flex-1" style={{ fontFamily: 'Syne' }}>
            {NAV.find((n) => n.href === pathname)?.label || 'MediCore AI'}
          </h1>

          {/* Search */}
          <div className="relative hidden md:block">
            <input placeholder="Search patients, studies..."
              className="w-56 text-xs pl-8 pr-3 py-2 rounded-lg outline-none"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }} />
            <svg className="absolute left-2.5 top-2.5 w-3.5 h-3.5 opacity-40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </div>

          {/* AI status */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
            style={{ background: 'var(--surface)', border: '1px solid var(--green)', color: 'var(--green)' }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--green)' }} />
            AI Online
          </div>

          <Link href="/alerts"
            className="relative w-8 h-8 rounded-lg flex items-center justify-center transition-all"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <Bell className="w-4 h-4 opacity-70" />
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full" style={{ background: 'var(--red)' }} />
          </Link>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-5">
          {children}
        </main>
      </div>
    </div>
  );
}
