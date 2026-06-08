'use client';
import { useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

interface AppUser { id: number; username: string; role: string; created_at: string; }

export default function UserManagement() {
  const { token } = useAuth();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [form, setForm] = useState({ username: '', password: '', role: 'employee' });
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [pwModal, setPwModal] = useState<{ id: number; username: string } | null>(null);
  const [newPw, setNewPw] = useState('');

  const h = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const load = async () => {
    const res = await fetch('/api/users', { headers: h });
    setUsers(await res.json());
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(''); setMsg(''); setLoading(true);
    try {
      const res = await fetch('/api/users', { method: 'POST', headers: h, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) { setErr(data.error); return; }
      setMsg(`User "${form.username}" created`);
      setForm({ username: '', password: '', role: 'employee' });
      load();
    } finally { setLoading(false); }
  };

  const handleDelete = async (id: number, username: string) => {
    if (!confirm(`Delete user "${username}"?`)) return;
    await fetch(`/api/users?id=${id}`, { method: 'DELETE', headers: h });
    load();
  };

  const handleChangePw = async () => {
    if (!pwModal || !newPw) return;
    await fetch('/api/users', { method: 'PUT', headers: h, body: JSON.stringify({ id: pwModal.id, password: newPw }) });
    setMsg(`Password updated for "${pwModal.username}"`);
    setPwModal(null); setNewPw('');
  };

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">User Management</h1>
        <p className="text-slate-400 text-sm mt-0.5">Manage employee accounts and access</p>
      </div>

      {/* Add user */}
      <div className="rounded-xl p-5 mb-6" style={{ background: '#0f1f36', border: '1px solid #1a2f4a' }}>
        <h2 className="text-sm font-semibold text-white mb-4">Add New User</h2>
        <form onSubmit={handleAdd} className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-36">
            <label className="block text-xs text-slate-400 mb-1">Username</label>
            <input value={form.username} onChange={e => setForm(f => ({...f, username: e.target.value}))}
              required className="w-full px-3 py-2 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
              style={{ background: '#0A1628', border: '1px solid #1a2f4a' }} placeholder="username" />
          </div>
          <div className="flex-1 min-w-36">
            <label className="block text-xs text-slate-400 mb-1">Password</label>
            <input type="password" value={form.password} onChange={e => setForm(f => ({...f, password: e.target.value}))}
              required className="w-full px-3 py-2 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
              style={{ background: '#0A1628', border: '1px solid #1a2f4a' }} placeholder="password" />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Role</label>
            <select value={form.role} onChange={e => setForm(f => ({...f, role: e.target.value}))}
              className="px-3 py-2 rounded-lg text-sm text-white focus:outline-none"
              style={{ background: '#0A1628', border: '1px solid #1a2f4a' }}>
              <option value="employee">Employee</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <button type="submit" disabled={loading}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
            style={{ background: '#0d9488' }}>
            {loading ? 'Adding…' : 'Add User'}
          </button>
        </form>
        {msg && <p className="text-teal-400 text-xs mt-3">{msg}</p>}
        {err && <p className="text-red-400 text-xs mt-3">{err}</p>}
      </div>

      {/* User list */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #1a2f4a' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: '#0A1628' }}>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Username</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Role</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Created</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u, i) => (
              <tr key={u.id} style={{ background: i % 2 === 0 ? '#0f1f36' : '#0A1628', borderBottom: '1px solid #1a2f4a1a' }}>
                <td className="px-4 py-3 font-medium text-white">{u.username}</td>
                <td className="px-4 py-3">
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{ background: u.role === 'admin' ? '#7c3aed30' : '#0d948830', color: u.role === 'admin' ? '#a78bfa' : '#14b8a6' }}>
                    {u.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-400 text-xs">{new Date(u.created_at).toLocaleDateString()}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => { setPwModal({ id: u.id, username: u.username }); setNewPw(''); }}
                      className="text-xs px-2.5 py-1 rounded text-blue-400 border border-blue-500/30 hover:bg-blue-500/10 transition-all">
                      Change PW
                    </button>
                    <button onClick={() => handleDelete(u.id, u.username)}
                      className="text-xs px-2.5 py-1 rounded text-red-400 border border-red-500/30 hover:bg-red-500/10 transition-all">
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Change password modal */}
      {pwModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="rounded-2xl p-6 max-w-sm w-full mx-4" style={{ background: '#0f1f36', border: '1px solid #1a2f4a' }}>
            <h3 className="text-white font-semibold mb-4">Change Password — {pwModal.username}</h3>
            <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)}
              placeholder="New password" autoFocus
              className="w-full px-3 py-2.5 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-teal-500 mb-4"
              style={{ background: '#0A1628', border: '1px solid #1a2f4a' }} />
            <div className="flex gap-3 justify-end">
              <button onClick={() => setPwModal(null)} className="px-4 py-2 rounded-lg text-sm text-slate-300 border border-slate-600 hover:bg-white/5">Cancel</button>
              <button onClick={handleChangePw} className="px-4 py-2 rounded-lg text-sm text-white" style={{ background: '#0d9488' }}>Update</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
