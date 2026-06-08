import React, { useState } from 'react';
import { LogIn, Snowflake, Eye, EyeOff } from 'lucide-react';
import { authenticate } from '../utils/db';
import { User } from '../types';

interface LoginProps {
  onLogin: (user: User) => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Please enter username and password.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const user = await authenticate(username.trim(), password.trim());
      if (user) {
        onLogin(user);
      } else {
        setError('Invalid username or password.');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-base-100 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Brand card */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-primary/15 rounded-3xl mb-4 ring-2 ring-primary/20">
            <Snowflake size={38} className="text-primary" />
          </div>
          <h1 className="text-3xl font-extrabold text-base-content tracking-tight">Natural Ice</h1>
          <p className="text-base-content/50 text-sm mt-1 font-medium">Abu Dhabi · Warehouse Tracker</p>
        </div>

        <div className="card bg-base-200 shadow-xl border border-base-300">
          <div className="card-body p-7 gap-4">
            <h2 className="text-base font-semibold text-base-content/70 text-center">Sign in to your account</h2>

            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <div className="form-control gap-1">
                <label className="label py-0"><span className="label-text text-xs font-semibold uppercase tracking-wide text-base-content/50">Username</span></label>
                <input
                  className="input input-bordered w-full bg-base-100 focus:border-primary"
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  autoFocus
                  autoComplete="username"
                />
              </div>

              <div className="form-control gap-1">
                <label className="label py-0"><span className="label-text text-xs font-semibold uppercase tracking-wide text-base-content/50">Password</span></label>
                <label className="input input-bordered flex items-center gap-2 bg-base-100 focus-within:border-primary">
                  <input
                    className="grow"
                    type={showPwd ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                  />
                  <button type="button" onClick={() => setShowPwd(v => !v)} className="opacity-40 hover:opacity-70 transition-opacity">
                    {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </label>
              </div>

              {error && (
                <div className="alert alert-error py-2 text-sm gap-2">
                  <span>{error}</span>
                </div>
              )}

              <button className="btn btn-primary w-full mt-1" type="submit" disabled={loading}>
                {loading ? <span className="loading loading-spinner loading-sm" /> : <LogIn size={16} />}
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
          </div>
        </div>

        <p className="text-center text-xs text-base-content/30 mt-5">
          Default — admin: <span className="font-mono">admin / admin123</span>
        </p>
      </div>
    </div>
  );
};
