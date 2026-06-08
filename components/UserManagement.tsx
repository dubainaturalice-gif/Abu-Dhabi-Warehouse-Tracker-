import React, { useState, useEffect, useCallback } from 'react';
import { UserPlus, Trash2, KeyRound, Users, Shield, User, RefreshCw, X, Check } from 'lucide-react';
import { getUsers, createUser, deleteUser, updatePassword } from '../utils/db';

interface UserRow { id: number; username: string; role: string; created_at: string; }

export const UserManagement: React.FC = () => {
  const [users, setUsers]       = useState<UserRow[]>([]);
  const [loading, setLoading]   = useState(false);
  const [showAdd, setShowAdd]   = useState(false);
  const [pwdModal, setPwdModal] = useState<UserRow | null>(null);

  // Add user form
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'employee' });
  const [addErr, setAddErr]   = useState('');
  const [addOk,  setAddOk]   = useState(false);

  // Change password form
  const [newPwd, setNewPwd]     = useState('');
  const [pwdErr, setPwdErr]     = useState('');
  const [pwdOk,  setPwdOk]     = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setUsers(await getUsers()); }
    catch (e) { console.error('Load users failed:', e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddErr(''); setAddOk(false);
    if (!newUser.username.trim() || !newUser.password.trim()) {
      setAddErr('Username and password are required.');
      return;
    }
    try {
      await createUser(newUser.username.trim(), newUser.password.trim(), newUser.role);
      setAddOk(true);
      setNewUser({ username: '', password: '', role: 'employee' });
      await load();
      setTimeout(() => { setAddOk(false); setShowAdd(false); }, 1200);
    } catch (e: any) {
      setAddErr(String(e?.message ?? 'Username already exists.'));
      console.error('Create user failed:', e);
    }
  };

  const handleDelete = async (u: UserRow) => {
    if (u.username === 'admin') return;
    await deleteUser(u.id);
    await load();
  };

  const handlePwd = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdErr(''); setPwdOk(false);
    if (!newPwd.trim()) { setPwdErr('New password is required.'); return; }
    if (newPwd.trim().length < 4) { setPwdErr('Password must be at least 4 characters.'); return; }
    try {
      await updatePassword(pwdModal!.id, newPwd.trim());
      setPwdOk(true);
      setNewPwd('');
      setTimeout(() => { setPwdOk(false); setPwdModal(null); }, 1200);
    } catch (e) {
      setPwdErr('Failed to update password.');
      console.error('Update password failed:', e);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Header */}
      <div className="bg-base-200 border-b border-base-300 px-5 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <Users size={18} className="text-primary" />
          <div>
            <div className="font-bold text-base-content">User Management</div>
            <div className="text-xs text-base-content/40">{users.length} team member{users.length !== 1 ? 's' : ''}</div>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="btn btn-ghost btn-sm btn-circle" title="Reload"><RefreshCw size={13} /></button>
          <button onClick={() => { setShowAdd(v => !v); setAddErr(''); setAddOk(false); }} className="btn btn-primary btn-sm gap-1.5">
            <UserPlus size={14} />{showAdd ? 'Cancel' : 'Add User'}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">

        {/* Add user form */}
        {showAdd && (
          <div className="card bg-base-200 border border-primary/20 shadow-sm">
            <div className="card-body p-4">
              <h3 className="font-bold text-sm text-base-content mb-3 flex items-center gap-2">
                <UserPlus size={15} className="text-primary" /> New User
              </h3>
              <form onSubmit={handleAdd} className="grid grid-cols-3 gap-3">
                <input
                  className="input input-bordered input-sm bg-base-100"
                  placeholder="Username"
                  value={newUser.username}
                  onChange={e => setNewUser(v => ({ ...v, username: e.target.value }))}
                  autoFocus
                />
                <input
                  className="input input-bordered input-sm bg-base-100"
                  type="password"
                  placeholder="Password"
                  value={newUser.password}
                  onChange={e => setNewUser(v => ({ ...v, password: e.target.value }))}
                />
                <select
                  className="select select-bordered select-sm bg-base-100"
                  value={newUser.role}
                  onChange={e => setNewUser(v => ({ ...v, role: e.target.value }))}
                >
                  <option value="employee">Employee</option>
                  <option value="admin">Admin</option>
                </select>
                {addErr && <div className="col-span-3 alert alert-error py-1.5 text-xs">{addErr}</div>}
                {addOk  && <div className="col-span-3 alert alert-success py-1.5 text-xs flex gap-1"><Check size={12} />User created!</div>}
                <div className="col-span-3 flex justify-end">
                  <button type="submit" className="btn btn-primary btn-sm gap-1">
                    <UserPlus size={13} />Create User
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Users table */}
        {loading ? (
          <div className="flex items-center justify-center h-32 gap-2 text-base-content/40">
            <span className="loading loading-spinner loading-sm text-primary" />
            <span className="text-sm">Loading users…</span>
          </div>
        ) : (
          <div className="card bg-base-200 overflow-hidden">
            <table className="table table-sm w-full">
              <thead className="bg-base-300">
                <tr>
                  <th className="text-xs font-semibold text-base-content/50 pl-4">User</th>
                  <th className="text-center text-xs font-semibold text-base-content/50">Role</th>
                  <th className="text-center text-xs font-semibold text-base-content/50">Created</th>
                  <th className="text-right text-xs font-semibold text-base-content/50 pr-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-base-300/40 border-b border-base-300/40">
                    <td className="pl-4 py-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 bg-secondary/15 rounded-full flex items-center justify-center flex-shrink-0">
                          {u.role === 'admin'
                            ? <Shield size={14} className="text-primary" />
                            : <User size={14} className="text-secondary" />}
                        </div>
                        <div>
                          <div className="font-semibold text-sm text-base-content">{u.username}</div>
                          <div className="text-xs text-base-content/40">ID #{u.id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="text-center">
                      <span className={`badge badge-sm ${u.role === 'admin' ? 'badge-primary' : 'badge-secondary'} capitalize`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="text-center text-xs text-base-content/40">
                      {u.created_at ? new Date(u.created_at).toLocaleDateString('en-GB') : '—'}
                    </td>
                    <td className="text-right pr-4">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => { setPwdModal(u); setNewPwd(''); setPwdErr(''); setPwdOk(false); }}
                          className="btn btn-ghost btn-xs gap-1 text-base-content/50 hover:text-warning"
                          title="Change password"
                        >
                          <KeyRound size={12} />
                        </button>
                        <button
                          onClick={() => handleDelete(u)}
                          disabled={u.username === 'admin'}
                          className="btn btn-ghost btn-xs gap-1 text-base-content/50 hover:text-error disabled:opacity-20"
                          title={u.username === 'admin' ? 'Cannot delete admin' : 'Delete user'}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Password modal */}
      {pwdModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="card bg-base-100 shadow-2xl w-80">
            <div className="card-body p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-sm flex items-center gap-2">
                  <KeyRound size={14} className="text-primary" /> Change Password
                </h3>
                <button onClick={() => setPwdModal(null)} className="btn btn-ghost btn-xs btn-circle"><X size={13} /></button>
              </div>
              <p className="text-xs text-base-content/50 mb-3">User: <strong>{pwdModal.username}</strong></p>
              <form onSubmit={handlePwd} className="space-y-3">
                <input
                  className="input input-bordered input-sm w-full bg-base-200"
                  type="password"
                  placeholder="New password (min 4 chars)"
                  value={newPwd}
                  onChange={e => setNewPwd(e.target.value)}
                  autoFocus
                />
                {pwdErr && <div className="alert alert-error py-1.5 text-xs">{pwdErr}</div>}
                {pwdOk  && <div className="alert alert-success py-1.5 text-xs flex gap-1"><Check size={12} />Password updated!</div>}
                <div className="flex gap-2 justify-end">
                  <button type="button" onClick={() => setPwdModal(null)} className="btn btn-ghost btn-sm">Cancel</button>
                  <button type="submit" className="btn btn-primary btn-sm">Update</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
