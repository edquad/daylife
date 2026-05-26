import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { ApiError } from '../../lib/api';
import { isFreshSignupInProgress, beginFreshSignup } from '../../lib/storage';
import {
  type HouseholdType,
  HOUSEHOLD_TYPE_LABELS,
  HOUSEHOLD_TYPE_DESC,
  MAX_HOUSEHOLD_SIZE,
  roleLabel,
} from '../../lib/household';
import { Heart, User, Users, ChevronLeft, Plus, Trash2, LogIn, UserPlus, HandCoins } from 'lucide-react';
import { cn } from '../../lib/utils';

type Screen = 'welcome' | 'login' | 'signup-type' | 'signup-details';

const TYPE_OPTIONS: { type: HouseholdType; icon: typeof User; accent: string }[] = [
  { type: 'SINGLE', icon: User, accent: 'border-brand-200 bg-brand-50 hover:border-brand-400' },
  { type: 'COUPLE', icon: Heart, accent: 'border-accent-200 bg-accent-50 hover:border-accent-400' },
  { type: 'FAMILY', icon: Users, accent: 'border-green-200 bg-green-50 hover:border-green-400' },
  { type: 'GROUP', icon: HandCoins, accent: 'border-violet-200 bg-violet-50 hover:border-violet-400' },
];

export function LoginPage() {
  const { setupComplete, members, household, setupHousehold, loginAs, resetForNewSignup } = useAuth();
  const [screen, setScreen] = useState<Screen>(setupComplete ? 'welcome' : 'welcome');
  const [householdType, setHouseholdType] = useState<HouseholdType | null>(null);
  const [yourName, setYourName] = useState('');
  const [partnerName, setPartnerName] = useState('');
  const [householdName, setHouseholdName] = useState('');
  const [familyMembers, setFamilyMembers] = useState(['', '']);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const householdTypeKey = (household?.householdType || 'SINGLE') as HouseholdType;
  const hasExistingHousehold = setupComplete && members.length > 0;

  useEffect(() => {
    if (hasExistingHousehold && (screen === 'signup-type' || screen === 'signup-details') && !isFreshSignupInProgress()) {
      setScreen('welcome');
      setError('Your household is already set up. Tap Log in and choose your name.');
    }
  }, [hasExistingHousehold, screen]);

  const pickType = (type: HouseholdType) => {
    setHouseholdType(type);
    setScreen('signup-details');
    setError('');
  };

  const updateFamilyMember = (index: number, value: string) => {
    setFamilyMembers((prev) => prev.map((m, i) => (i === index ? value : m)));
  };

  const addFamilySlot = () => {
    if (familyMembers.length >= MAX_HOUSEHOLD_SIZE - 1) return;
    setFamilyMembers((prev) => [...prev, '']);
  };

  const removeFamilySlot = (index: number) => {
    if (familyMembers.length <= 1) return;
    setFamilyMembers((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!householdType) return;
    setError('');
    setLoading(true);
    try {
      await setupHousehold({
        householdType,
        name: yourName.trim(),
        householdName: householdType === 'FAMILY' || householdType === 'GROUP' ? householdName.trim() : undefined,
        partnerName: householdType === 'COUPLE' ? partnerName.trim() : undefined,
        memberNames: householdType === 'FAMILY' || householdType === 'GROUP' ? familyMembers : undefined,
      });
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!selectedUserId) {
      setError('Please choose who you are');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await loginAs(selectedUserId);
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const canSubmitSignup =
    yourName.trim() &&
    (householdType === 'SINGLE' ||
      (householdType === 'COUPLE' && partnerName.trim()) ||
      (householdType === 'FAMILY' && familyMembers.some((m) => m.trim())) ||
      (householdType === 'GROUP' && familyMembers.some((m) => m.trim())));

  const handleStartSignup = () => {
    if (hasExistingHousehold) {
      const ok = window.confirm(
        'Start a brand-new household? This clears data on this device and replaces the cloud backup. Export a backup in Settings first if you need one.',
      );
      if (!ok) return;
      resetForNewSignup();
    } else {
      beginFreshSignup();
    }
    setScreen('signup-type');
    setError('');
  };

  const BrandHeader = () => (
    <div className="text-center mb-8">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-600 text-white mb-4">
        <Heart size={28} />
      </div>
      <h1 className="text-3xl font-bold text-brand-700">DayLife</h1>
      <p className="text-gray-500 mt-1">Your daily planner — just for you, or together</p>
      <p className="text-xs text-green-600 mt-2 font-medium">Free · saves on this device</p>
    </div>
  );

  return (
    <div className="min-h-dvh flex items-center justify-center bg-gradient-to-br from-brand-50 via-white to-accent-50 px-4 py-8">
      <div className="w-full max-w-md">
        <BrandHeader />

        <div className="bg-white rounded-2xl shadow-sm border p-6">
          {/* ── Welcome: Login / Sign up ── */}
          {screen === 'welcome' && (
            <>
              <h2 className="text-lg font-semibold text-center mb-1">Welcome</h2>
              <p className="text-sm text-gray-500 text-center mb-6">
                {hasExistingHousehold
                  ? 'Your household is ready — log in as yourself'
                  : 'Create your account to get started'}
              </p>

              <div className="space-y-3">
                {hasExistingHousehold && (
                  <button
                    type="button"
                    onClick={() => {
                      setScreen('login');
                      setSelectedUserId(members[0]?.id || '');
                      setError('');
                    }}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-brand-600 text-white font-semibold rounded-xl hover:bg-brand-700 transition-colors"
                  >
                    <LogIn size={18} />
                    Log in
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleStartSignup}
                  className={cn(
                    'w-full flex items-center justify-center gap-2 py-3 font-semibold rounded-xl transition-colors',
                    hasExistingHousehold
                      ? 'border-2 border-brand-200 text-brand-700 hover:bg-brand-50'
                      : 'bg-brand-600 text-white hover:bg-brand-700',
                  )}
                >
                  <UserPlus size={18} />
                  {hasExistingHousehold ? 'Create new household' : 'Sign up'}
                </button>

                {hasExistingHousehold && (
                  <p className="text-center text-xs text-gray-400 pt-2">
                    {household?.householdName || HOUSEHOLD_TYPE_LABELS[householdTypeKey]}
                    {' · '}{members.length} {members.length === 1 ? 'person' : 'people'}
                    {' · '}{members.map((m) => m.name).join(', ')}
                  </p>
                )}
              </div>
              {error && <p className="text-sm text-red-600 text-center mt-4">{error}</p>}
            </>
          )}

          {/* ── Log in: pick user ── */}
          {screen === 'login' && hasExistingHousehold && (
            <>
              <button
                type="button"
                onClick={() => { setScreen('welcome'); setError(''); }}
                className="flex items-center gap-1 text-sm text-gray-500 hover:text-brand-600 mb-4"
              >
                <ChevronLeft size={16} /> Back
              </button>
              <h2 className="text-lg font-semibold mb-1">Log in</h2>
              <p className="text-sm text-gray-500 mb-5">Choose your account and continue</p>

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Account</label>
                  <select
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    className="w-full px-3 py-2.5 border rounded-lg bg-white focus:ring-2 focus:ring-brand-500 outline-none"
                    required
                  >
                    <option value="">Select who you are…</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({roleLabel(m.role, householdTypeKey)})
                      </option>
                    ))}
                  </select>
                </div>

                {selectedUserId && (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                    {(() => {
                      const m = members.find((x) => x.id === selectedUserId);
                      if (!m) return null;
                      return (
                        <>
                          <div
                            className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold"
                            style={{ backgroundColor: m.color }}
                          >
                            {m.name[0]}
                          </div>
                          <div>
                            <p className="font-medium">{m.name}</p>
                            <p className="text-xs text-gray-400">{roleLabel(m.role, householdTypeKey)}</p>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}

                {error && <p className="text-sm text-red-600">{error}</p>}

                <button
                  type="submit"
                  disabled={loading || !selectedUserId}
                  className="w-full py-2.5 bg-brand-600 text-white font-semibold rounded-lg hover:bg-brand-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <LogIn size={16} />
                  {loading ? 'Logging in…' : 'Log in'}
                </button>
              </form>

              <div className="mt-4 pt-4 border-t">
                <p className="text-xs text-gray-400 text-center">
                  After login, switch users anytime from the top bar without signing out.
                </p>
              </div>
            </>
          )}

          {/* ── Sign up: pick type ── */}
          {screen === 'signup-type' && (
            <>
              <button
                type="button"
                onClick={() => { setScreen('welcome'); setError(''); }}
                className="flex items-center gap-1 text-sm text-gray-500 hover:text-brand-600 mb-4"
              >
                <ChevronLeft size={16} /> Back
              </button>
              <h2 className="text-lg font-semibold mb-1">Sign up</h2>
              <p className="text-sm text-gray-500 mb-5">Who will use DayLife?</p>
              <div className="space-y-3">
                {TYPE_OPTIONS.map(({ type, icon: Icon, accent }) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => pickType(type)}
                    className={cn('w-full flex items-center gap-4 p-4 border-2 rounded-xl text-left transition-colors', accent)}
                  >
                    <div className="w-11 h-11 rounded-xl bg-white flex items-center justify-center shadow-sm">
                      <Icon size={22} className="text-brand-700" />
                    </div>
                    <div>
                      <p className="font-semibold">{HOUSEHOLD_TYPE_LABELS[type]}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{HOUSEHOLD_TYPE_DESC[type]}</p>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* ── Sign up: details ── */}
          {screen === 'signup-details' && householdType && (
            <>
              <button
                type="button"
                onClick={() => { setScreen('signup-type'); setError(''); }}
                className="flex items-center gap-1 text-sm text-gray-500 hover:text-brand-600 mb-4"
              >
                <ChevronLeft size={16} /> Back
              </button>
              <h2 className="text-lg font-semibold mb-1">Sign up — {HOUSEHOLD_TYPE_LABELS[householdType]}</h2>
              <p className="text-sm text-gray-500 mb-4">{HOUSEHOLD_TYPE_DESC[householdType]}</p>

              <form onSubmit={handleSetup} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Your name</label>
                  <input
                    type="text"
                    value={yourName}
                    onChange={(e) => setYourName(e.target.value)}
                    placeholder="Anshul"
                    className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                    required
                    autoFocus
                  />
                </div>

                {householdType === 'COUPLE' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Partner's name</label>
                    <input
                      type="text"
                      value={partnerName}
                      onChange={(e) => setPartnerName(e.target.value)}
                      placeholder="Pratyasha"
                      className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                      required
                    />
                  </div>
                )}

                {(householdType === 'FAMILY' || householdType === 'GROUP') && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {householdType === 'GROUP' ? 'Group name (optional)' : 'Family name (optional)'}
                      </label>
                      <input
                        type="text"
                        value={householdName}
                        onChange={(e) => setHouseholdName(e.target.value)}
                        placeholder={householdType === 'GROUP' ? 'Trip to Goa' : 'The Sharma Family'}
                        className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {householdType === 'GROUP' ? 'Group members' : 'Family members'}
                      </label>
                      <div className="space-y-2">
                        {familyMembers.map((member, index) => (
                          <div key={index} className="flex gap-2">
                            <input
                              type="text"
                              value={member}
                              onChange={(e) => updateFamilyMember(index, e.target.value)}
                              placeholder={householdType === 'GROUP' ? `Member ${index + 1}` : index === 0 ? 'Partner' : `Member ${index + 1}`}
                              className="flex-1 px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none text-sm"
                            />
                            {familyMembers.length > 1 && (
                              <button type="button" onClick={() => removeFamilySlot(index)} className="p-2 text-gray-400 hover:text-red-500">
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                      {familyMembers.length < MAX_HOUSEHOLD_SIZE - 1 && (
                        <button type="button" onClick={addFamilySlot} className="mt-2 flex items-center gap-1 text-sm text-brand-600 hover:underline">
                          <Plus size={14} /> Add another member
                        </button>
                      )}
                    </div>
                  </>
                )}

                {error && <p className="text-sm text-red-600">{error}</p>}
                <button
                  type="submit"
                  disabled={loading || !canSubmitSignup}
                  className="w-full py-2.5 bg-brand-600 text-white font-semibold rounded-lg hover:bg-brand-700 disabled:opacity-50"
                >
                  {loading ? 'Creating account…' : 'Create account'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
