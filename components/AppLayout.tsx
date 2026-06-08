'use client';
import { useAuth } from './AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, ReactNode } from 'react';
import Link from 'next/link';

const NAV = [
  { href: '/daily',   icon: '📋', label: 'Daily Entry' },
  { href: '/monthly', icon: '📅', label: 'Monthly Summary' },
  { href: '/yearly',  icon: '📊', label: 'Yearly Overview' },
];

export default function AppLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!user) router.replace('/login');
  }, [user, router]);

  if (!user) return null;

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#040d1a' }}>
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 flex flex-col" style={{ background: '#0A1628', borderRight: '1px solid #1a2f4a' }}>
        {/* Logo */}
        <div className="px-4 py-5 border-b" style={{ borderColor: '#1a2f4a' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base" style={{ background: 'linear-gradient(135deg,#0d9488,#14b8a6)' }}>🧊</div>
            <div>
              <div className="text-white font-semibold text-sm leading-tight">Abu Dhabi</div>
              <div className="text-teal-500 text-xs">Warehouse Tracker</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 space-y-0.5 px-2">
          {NAV.map(n => (
            <Link key={n.href} href={n.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                pathname === n.href
                  ? 'text-teal-400 font-medium'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
              style={pathname === n.href ? { background: 'rgba(13,148,136,0.15)', borderLeft: '2px solid #14b8a6' } : {}}
            >
              <span>{n.icon}</span>{n.label}
            </Link>
          ))}
          {user.role === 'admin' && (
            <Link href="/users"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                pathname === '/users'
                  ? 'text-teal-400 font-medium'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
              style={pathname === '/users' ? { background: 'rgba(13,148,136,0.15)', borderLeft: '2px solid #14b8a6' } : {}}
            >
              <span>👥</span>User Management
            </Link>
          )}
        </nav>

        {/* User info + logout */}
        <div className="p-3 border-t" style={{ borderColor: '#1a2f4a' }}>
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
              style={{ background: user.role === 'admin' ? '#7c3aed' : '#0d9488' }}>
              {user.username[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-white text-xs font-medium truncate">{user.username}</div>
              <div className="text-xs" style={{ color: user.role === 'admin' ? '#a78bfa' : '#14b8a6' }}>
                {user.role === 'admin' ? 'Administrator' : 'Employee'}
              </div>
            </div>
          </div>
          <button onClick={() => { logout(); router.replace('/login'); }}
            className="w-full text-xs text-slate-500 hover:text-red-400 py-1.5 px-2 rounded hover:bg-red-500/10 transition-all text-left">
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
