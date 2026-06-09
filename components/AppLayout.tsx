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
    <div className="flex h-screen overflow-hidden" style={{ background: '#f1f5f9' }}>
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 flex flex-col bg-white" style={{ borderRight: '1px solid #e2e8f0', boxShadow: '2px 0 8px rgba(0,0,0,0.04)' }}>
        {/* Logo */}
        <div className="px-4 py-5 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg" style={{ background: 'linear-gradient(135deg,#0d9488,#14b8a6)' }}>🧊</div>
            <div>
              <div className="font-bold text-sm text-slate-800 leading-tight">Abu Dhabi</div>
              <div className="text-xs font-medium" style={{ color: '#0d9488' }}>Warehouse Tracker</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 space-y-0.5 px-2">
          {NAV.map(n => (
            <Link key={n.href} href={n.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                pathname === n.href
                  ? 'font-semibold'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}
              style={pathname === n.href ? { background: 'rgba(13,148,136,0.10)', borderLeft: '3px solid #0d9488', color: '#0d9488', paddingLeft: '10px' } : {}}
            >
              <span>{n.icon}</span>{n.label}
            </Link>
          ))}
          {user.role === 'admin' && (
            <Link href="/users"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                pathname === '/users'
                  ? 'font-semibold'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}
              style={pathname === '/users' ? { background: 'rgba(13,148,136,0.10)', borderLeft: '3px solid #0d9488', color: '#0d9488', paddingLeft: '10px' } : {}}
            >
              <span>👥</span>User Management
            </Link>
          )}
        </nav>

        {/* User info + logout */}
        <div className="p-3 border-t border-slate-100">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
              style={{ background: user.role === 'admin' ? '#7c3aed' : '#0d9488' }}>
              {user.username[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-slate-800 text-xs font-semibold truncate">{user.username}</div>
              <div className="text-xs" style={{ color: user.role === 'admin' ? '#7c3aed' : '#0d9488' }}>
                {user.role === 'admin' ? 'Administrator' : 'Employee'}
              </div>
            </div>
          </div>
          <button onClick={() => { logout(); router.replace('/login'); }}
            className="w-full text-xs text-slate-400 hover:text-red-500 py-1.5 px-2 rounded hover:bg-red-50 transition-all text-left">
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
