import React, { useState } from 'react';
import { useAuth } from './AuthContext';
import { useGitHubSync } from '../sync/GitHubSyncContext';
import { ApiError } from '../../lib/api';
import { normalizeUsername, validateUsername } from '../../lib/accounts';
import { validatePinFormat } from '../../lib/pin';
import { Heart, Loader2 } from 'lucide-react';

type Tab = 'login' | 'signup';

export function LoginPage() {
  const { signup, login } = useAuth();
  const { status, cloudReady } = useGitHubSync();

  const [tab, setTab] = useState<Tab>('login');
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const syncing = cloudReady && status === 'syncing';

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    const user = normalizeUsername(username);
    const userErr = validateUsername(user);
    if (userErr) {
      setError(userErr);
      return;
    }
    if (!name.trim()) {
      setError('Enter your name');
      return;
    }
    if (pin && !validatePinFormat(pin)) {
      setError('PIN must be 4 digits');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await signup({ username: user, name: name.trim(), pin: pin || undefined });
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : err.message || 'Sign up failed');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const user = normalizeUsername(username);
    const userErr = validateUsername(user);
    if (userErr) {
      setError(userErr);
      return;
    }
    setLoading(true);
    setError('');
    try {
      await login({ username: user, pin: pin || undefined });
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : err.message || 'Sign in failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh flex items-center justify-center bg-gradient-to-br from-brand-50 via-white to-accent-50 px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-600 text-white mb-4">
            <Heart size={28} />
          </div>
          <h1 className="text-3xl font-bold text-brand-700">DayLife</h1>
          <p className="text-gray-500 mt-1">Your personal daily planner</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border p-6">
          <div className="flex rounded-xl bg-gray-100 p-1 mb-6">
            <button
              type="button"
              onClick={() => { setTab('login'); setError(''); }}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${
                tab === 'login' ? 'bg-white shadow text-brand-700' : 'text-gray-500'
              }`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => { setTab('signup'); setError(''); }}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${
                tab === 'signup' ? 'bg-white shadow text-brand-700' : 'text-gray-500'
              }`}
            >
              Sign up
            </button>
          </div>

          {syncing && (
            <div className="flex items-center justify-center gap-2 text-sm text-gray-500 mb-4">
              <Loader2 size={16} className="animate-spin" />
              Connecting…
            </div>
          )}

          <form onSubmit={tab === 'login' ? handleLogin : handleSignup} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Username</label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                placeholder="yourname"
                autoComplete="username"
                className="w-full px-3 py-3 border rounded-xl outline-none focus:ring-2 focus:ring-brand-500"
                required
                autoFocus
              />
              <p className="text-xs text-gray-400 mt-1">Letters, numbers, underscore · 3–20 chars</p>
            </div>

            {tab === 'signup' && (
              <div>
                <label className="block text-sm font-medium mb-1">Your name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="How we greet you"
                  autoComplete="name"
                  className="w-full px-3 py-3 border rounded-xl outline-none focus:ring-2 focus:ring-brand-500"
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-1">
                {tab === 'signup' ? '4-digit PIN (optional)' : 'PIN (if you set one)'}
              </label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="••••"
                autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
                className="w-full px-3 py-3 border rounded-xl outline-none focus:ring-2 focus:ring-brand-500 tracking-widest"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={loading || syncing}
              className="w-full py-3 bg-brand-600 text-white font-semibold rounded-xl hover:bg-brand-700 disabled:opacity-50"
            >
              {loading ? 'Please wait…' : tab === 'login' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          <p className="text-xs text-gray-400 text-center mt-6">
            Your account is yours alone — tasks, notes & expenses sync to your own cloud space.
          </p>
          <p className="text-xs text-gray-400 text-center mt-2">
            Still see old login? Open in browser and reinstall, or tap Update when the banner appears.
          </p>
        </div>
      </div>
    </div>
  );
}
