import React, { useState } from 'react';
import { useAuth } from './AuthContext';
import { useGitHubSync } from '../sync/GitHubSyncContext';
import { ApiError } from '../../lib/api';
import { normalizeUsername, validateUsername } from '../../lib/accounts';
import { validatePinFormat, validateRecoveryCodeFormat, formatRecoveryCode } from '../../lib/pin';
import { AppLogo } from '../../components/AppLogo';
import { APP_NAME, APP_TAGLINE } from '../../lib/brand';
import { Loader2 } from 'lucide-react';

type Tab = 'login' | 'signup' | 'forgot';

export function LoginPage() {
  const { signup, login, resetPin } = useAuth();
  const { status, cloudReady } = useGitHubSync();

  const [tab, setTab] = useState<Tab>('login');
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
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

  const handleForgotPin = async (e: React.FormEvent) => {
    e.preventDefault();
    const user = normalizeUsername(username);
    const userErr = validateUsername(user);
    if (userErr) {
      setError(userErr);
      return;
    }
    if (!validateRecoveryCodeFormat(recoveryCode)) {
      setError('Enter your 8-character recovery code');
      return;
    }
    if (!validatePinFormat(newPin)) {
      setError('New PIN must be 4 digits');
      return;
    }
    if (newPin !== confirmPin) {
      setError('PINs do not match');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await resetPin({ username: user, recoveryCode, newPin });
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : err.message || 'Could not reset PIN');
    } finally {
      setLoading(false);
    }
  };

  const switchTab = (next: Tab) => {
    setTab(next);
    setError('');
    if (next !== 'forgot') {
      setRecoveryCode('');
      setNewPin('');
      setConfirmPin('');
    }
  };

  return (
    <div className="min-h-dvh min-h-[100dvh] flex items-start sm:items-center justify-center bg-gradient-to-br from-brand-50 via-white to-accent-50 px-3 sm:px-4 py-6 sm:py-8 overflow-y-auto overflow-x-hidden">
      <div className="w-full max-w-md my-auto">
        <div className="text-center mb-8">
          <AppLogo size="lg" className="mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-brand-700">{APP_NAME}</h1>
          <p className="text-gray-500 mt-1">{APP_TAGLINE}</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border p-4 sm:p-6 overflow-hidden">
          {tab !== 'forgot' ? (
            <div className="flex rounded-xl bg-gray-100 p-1 mb-6">
              <button
                type="button"
                onClick={() => switchTab('login')}
                className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${
                  tab === 'login' ? 'bg-white shadow text-brand-700' : 'text-gray-500'
                }`}
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => switchTab('signup')}
                className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${
                  tab === 'signup' ? 'bg-white shadow text-brand-700' : 'text-gray-500'
                }`}
              >
                Sign up
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => switchTab('login')}
              className="text-sm text-brand-600 font-medium mb-4 hover:underline"
            >
              ← Back to sign in
            </button>
          )}

          {syncing && tab !== 'forgot' && (
            <div className="flex items-center justify-center gap-2 text-sm text-gray-500 mb-4">
              <Loader2 size={16} className="animate-spin" />
              Connecting…
            </div>
          )}

          <form
            onSubmit={
              tab === 'login' ? handleLogin : tab === 'signup' ? handleSignup : handleForgotPin
            }
            className="space-y-4"
          >
            <div>
              <label className="block text-sm font-medium mb-1">Username</label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                placeholder="yourname"
                autoComplete="username"
                className="w-full px-3 py-3 border rounded-xl outline-none focus:ring-2 focus:ring-brand-500 text-base max-w-full"
                required
                autoFocus
              />
              {tab !== 'forgot' && (
                <p className="text-xs text-gray-400 mt-1">Letters, numbers, underscore · 3–20 chars</p>
              )}
            </div>

            {tab === 'signup' && (
              <div>
                <label className="block text-sm font-medium mb-1">Your name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="How we greet you"
                  autoComplete="name"
                  className="w-full px-3 py-3 border rounded-xl outline-none focus:ring-2 focus:ring-brand-500 text-base max-w-full"
                  required
                />
              </div>
            )}

            {tab === 'forgot' && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-1">Recovery code</label>
                  <input
                    value={recoveryCode}
                    onChange={(e) => setRecoveryCode(formatRecoveryCode(e.target.value))}
                    placeholder="XXXX-XXXX"
                    autoComplete="off"
                    className="w-full px-3 py-3 border rounded-xl outline-none focus:ring-2 focus:ring-brand-500 tracking-widest uppercase font-mono"
                    required
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    From sign up or Settings. Without it we cannot reset your PIN.
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">New PIN</label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="••••"
                    autoComplete="new-password"
                    className="w-full px-3 py-3 border rounded-xl outline-none focus:ring-2 focus:ring-brand-500 tracking-widest"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Confirm new PIN</label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    value={confirmPin}
                    onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="••••"
                    autoComplete="new-password"
                    className="w-full px-3 py-3 border rounded-xl outline-none focus:ring-2 focus:ring-brand-500 tracking-widest"
                    required
                  />
                </div>
              </>
            )}

            {tab !== 'forgot' && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium">
                    {tab === 'signup' ? '4-digit PIN (optional)' : 'PIN (if you set one)'}
                  </label>
                  {tab === 'login' && (
                    <button
                      type="button"
                      onClick={() => switchTab('forgot')}
                      className="text-xs text-brand-600 font-medium hover:underline"
                    >
                      Forgot PIN?
                    </button>
                  )}
                </div>
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
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={loading || (syncing && tab !== 'forgot')}
              className="w-full py-3 bg-brand-600 text-white font-semibold rounded-xl hover:bg-brand-700 disabled:opacity-50"
            >
              {loading
                ? 'Please wait…'
                : tab === 'login'
                  ? 'Sign in'
                  : tab === 'signup'
                    ? 'Create account'
                    : 'Reset PIN & sign in'}
            </button>
          </form>

          {tab === 'signup' && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mt-4">
              After sign up you get a <strong>recovery code</strong>. Save it — you need it if you forget your PIN.
            </p>
          )}

          <p className="text-xs text-gray-400 text-center mt-6 leading-relaxed">
            Your account is yours alone. Later, use <span className="font-medium text-gray-500">Share</span> to invite someone by username — only what you pick gets shared.
          </p>
        </div>
      </div>
    </div>
  );
}
