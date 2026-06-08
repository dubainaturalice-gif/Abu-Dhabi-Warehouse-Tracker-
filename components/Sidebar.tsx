import React from 'react';
import { CalendarDays, BarChart3, TrendingUp, Users, LogOut, Snowflake, ChevronRight } from 'lucide-react';
import { User, View } from '../types';

interface SidebarProps {
  user: User;
  currentView: View;
  onViewChange: (v: View) => void;
  onLogout: () => void;
}

interface NavItem {
  id: View;
  label: string;
  description: string;
  icon: React.ReactNode;
  adminOnly?: boolean;
}

const NAV: NavItem[] = [
  { id: 'daily',   label: 'Daily Entry',    description: 'Enter stock per day',    icon: <CalendarDays size={17} /> },
  { id: 'monthly', label: 'Monthly Report', description: 'View monthly totals',    icon: <BarChart3 size={17} /> },
  { id: 'yearly',  label: 'Yearly Report',  description: 'Annual overview',        icon: <TrendingUp size={17} /> },
  { id: 'users',   label: 'Users',          description: 'Manage team access',     icon: <Users size={17} />, adminOnly: true },
];

export const Sidebar: React.FC<SidebarProps> = ({ user, currentView, onViewChange, onLogout }) => {
  const items = NAV.filter(n => !n.adminOnly || user.role === 'admin');

  return (
    <aside className="w-60 bg-base-200 h-screen flex flex-col border-r border-base-300 flex-shrink-0">
      {/* Brand */}
      <div className="px-4 py-5 border-b border-base-300">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/15 rounded-2xl flex items-center justify-center ring-1 ring-primary/20 flex-shrink-0">
            <Snowflake size={20} className="text-primary" />
          </div>
          <div className="min-w-0">
            <div className="font-bold text-sm text-base-content leading-tight">Natural Ice</div>
            <div className="text-xs text-base-content/40 truncate">Abu Dhabi Warehouse</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        <p className="text-xs font-semibold text-base-content/30 uppercase tracking-widest px-2 mb-2">Menu</p>
        {items.map(item => {
          const active = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all group ${
                active
                  ? 'bg-primary text-primary-content shadow-sm'
                  : 'text-base-content/60 hover:bg-base-300 hover:text-base-content'
              }`}
            >
              <span className={active ? 'text-primary-content' : 'text-base-content/40 group-hover:text-base-content/70'}>
                {item.icon}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium leading-tight">{item.label}</div>
                <div className={`text-xs truncate ${active ? 'text-primary-content/70' : 'text-base-content/35'}`}>
                  {item.description}
                </div>
              </div>
              {active && <ChevronRight size={13} className="text-primary-content/60 flex-shrink-0" />}
            </button>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="p-3 border-t border-base-300">
        <div className="flex items-center gap-3 px-2 mb-2">
          <div className="w-8 h-8 bg-secondary/20 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-secondary font-bold text-sm">{user.username.charAt(0).toUpperCase()}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-base-content truncate">{user.username}</div>
            <span className={`badge badge-xs ${user.role === 'admin' ? 'badge-primary' : 'badge-secondary'} capitalize`}>
              {user.role}
            </span>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="btn btn-ghost btn-sm w-full justify-start gap-2 text-base-content/50 hover:text-error hover:bg-error/10"
        >
          <LogOut size={14} /> Sign out
        </button>
      </div>
    </aside>
  );
};
