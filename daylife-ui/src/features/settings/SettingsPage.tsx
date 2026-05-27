import React, { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';
import { useGitHubSync } from '../sync/GitHubSyncContext';
import { api, User, HouseholdInfo } from '../../lib/api';
import { exportData, importData } from '../../lib/storage';
import {
  HOUSEHOLD_TYPE_LABELS,
  canManageMembers,
  canAddPartner,
  roleLabel,
  MAX_HOUSEHOLD_SIZE,
  type HouseholdType,
} from '../../lib/household';
import { toast } from '../../components/Toaster';
import { Heart, Download, Upload, Trash2, UserPlus, LogOut, Cloud, RefreshCw, Smartphone, Lock, KeyRound } from 'lucide-react';
import { usePwaInstall } from '../../hooks/usePwaInstall';
import { AndroidInstallSteps, IosInstallSteps } from '../../components/InstallInstructions';
import { PinModal } from '../../components/PinModal';
import { RecoveryCodeModal } from '../../components/RecoveryCodeModal';
import { ApiError } from '../../lib/api';
import { APP_NAME, APP_TAGLINE } from '../../lib/brand';
import { forceAppRefresh } from '../../lib/appUpdate';

export function SettingsPage() {
  const { user, logout, refreshUser } = useAuth();
  const { config, status, statusMessage, cloudReady, pullFromGitHub, syncToGitHub } = useGitHubSync();
  const { install, isStandalone, isIos, isAndroid, showIosHint, showAndroidInstall, showAndroidHint } = usePwaInstall();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(user?.name || '');
  const [color, setColor] = useState(user?.color || '#0F766E');
  const [newMemberName, setNewMemberName] = useState('');
  const [pinModal, setPinModal] = useState<'set' | 'change-current' | 'change-new' | 'remove' | 'recovery' | null>(null);
  const [pinError, setPinError] = useState('');
  const [currentPinDraft, setCurrentPinDraft] = useState('');
  const [newRecoveryCode, setNewRecoveryCode] = useState<string | null>(null);

  const { data: household } = useQuery<HouseholdInfo>({
    queryKey: ['household'],
    queryFn: () => api.get('/household'),
  });

  const { data: members = [] } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: () => api.get('/users'),
  });

  const householdType = (household?.householdType || 'SINGLE') as HouseholdType;

  const updateProfile = useMutation({
    mutationFn: () => api.put<User>('/users/me', { name, color }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Profile updated');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const addMember = useMutation({
    mutationFn: () => api.post<User>('/users', { name: newMemberName.trim() }),
    onSuccess: (added) => {
      setNewMemberName('');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['household'] });
      toast.success(
        canAddPartner(householdType, members.length)
          ? `${added.name} added — you can both log in now`
          : 'Family member added',
      );
    },
    onError: (err: any) => toast.error(err.message),
  });

  const removeMember = useMutation({
    mutationFn: (id: string) => api.delete(`/users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['household'] });
      toast.success('Member removed');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const generateRecovery = useMutation({
    mutationFn: (currentPin?: string) =>
      api.post<{ recoveryCode: string }>('/users/me/recovery-code', { currentPin }),
    onSuccess: (res) => {
      setNewRecoveryCode(res.recoveryCode);
      refreshUser();
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  React.useEffect(() => {
    if (user) {
      setName(user.name);
      setColor(user.color);
    }
  }, [user]);

  const handleExport = () => {
    const blob = new Blob([exportData()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `daylife-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Backup downloaded');
  };

  const handleImport = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        importData(reader.result as string);
        queryClient.invalidateQueries();
        toast.success('Backup restored — please sign in again');
        logout();
      } catch {
        toast.error('Invalid backup file');
      }
    };
    reader.readAsText(file);
  };

  const handleClearAll = () => {
    if (!confirm('Delete ALL data on this device? This cannot be undone.')) return;
    localStorage.removeItem('daylife_data');
    localStorage.removeItem('daylife_session');
    toast.success('All data cleared');
    logout();
  };

  return (
    <div className="p-4 lg:p-6 max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-gray-500 text-sm">Your data saves to the cloud automatically</p>
      </div>

      <section className="bg-white rounded-2xl border shadow-sm p-6 space-y-3">
        <h2 className="font-semibold">Account</h2>
        <p className="text-sm text-gray-500">
          This is your personal {APP_NAME}. Log out to sign in as someone else.
        </p>
        <button onClick={logout}
          className="flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium hover:bg-gray-50 text-gray-700">
          <LogOut size={16} /> Log out
        </button>
      </section>

      <section className="bg-white rounded-2xl border shadow-sm p-6 space-y-4 hidden">
        <h2 className="font-semibold">Household</h2>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 bg-brand-50 text-brand-700 text-sm font-medium rounded-full">
            {HOUSEHOLD_TYPE_LABELS[householdType]}
          </span>
          {household?.householdName && (
            <span className="text-sm text-gray-600">{household.householdName}</span>
          )}
        </div>
        <p className="text-sm text-gray-500">
          {householdType === 'SINGLE' && 'You manage everything on your own.'}
          {householdType === 'COUPLE' && 'Two people — each gets their own daily column.'}
          {householdType === 'FAMILY' && `${members.length} people in your household.`}
          {householdType === 'GROUP' && `${members.length} people in your group — split expenses & settle up.`}
        </p>
      </section>

      <section className="bg-white rounded-2xl border shadow-sm p-6 space-y-4">
        <h2 className="font-semibold flex items-center gap-2">
          <Heart size={18} className="text-brand-600" /> Your profile
        </h2>
        {user?.username && (
          <p className="text-sm text-gray-500">
            Signed in as <span className="font-medium text-gray-800">@{user.username}</span>
          </p>
        )}
        <div>
          <label className="block text-sm font-medium mb-1">Display name</label>
          <input value={name} onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-brand-500" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Color</label>
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-10 h-10 rounded cursor-pointer" />
        </div>
        <button onClick={() => updateProfile.mutate()} disabled={updateProfile.isPending}
          className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50">
          Save profile
        </button>
      </section>

      <section className="bg-white rounded-2xl border shadow-sm p-6 space-y-4">
        <h2 className="font-semibold flex items-center gap-2">
          <Lock size={18} className="text-brand-600" /> PIN lock
        </h2>
        <p className="text-sm text-gray-500">
          Optional 4-digit PIN. You&apos;ll need it when you sign in.
        </p>
        {user?.hasPin ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => { setPinError(''); setCurrentPinDraft(''); setPinModal('change-current'); }}
              className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-gray-50"
            >
              Change PIN
            </button>
            <button
              type="button"
              onClick={() => { setPinError(''); setPinModal('remove'); }}
              className="px-4 py-2 border border-red-200 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50"
            >
              Remove PIN
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => { setPinError(''); setPinModal('set'); }}
            className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700"
          >
            Set PIN
          </button>
        )}
      </section>

      <section className="bg-white rounded-2xl border shadow-sm p-6 space-y-4">
        <h2 className="font-semibold flex items-center gap-2">
          <KeyRound size={18} className="text-amber-600" /> Forgot PIN?
        </h2>
        <p className="text-sm text-gray-500">
          Your recovery code lets you set a new PIN on the sign-in screen. Keep it somewhere safe — like a notes app or password manager.
        </p>
        {user?.hasRecoveryCode ? (
          <p className="text-sm text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2">
            Recovery code is set on your account.
          </p>
        ) : (
          <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
            No recovery code yet. Create one now so you can reset your PIN later.
          </p>
        )}
        <button
          type="button"
          onClick={() => {
            setPinError('');
            if (user?.hasPin) setPinModal('recovery');
            else generateRecovery.mutate(undefined);
          }}
          disabled={generateRecovery.isPending}
          className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
        >
          {user?.hasRecoveryCode ? 'Create new recovery code' : 'Create recovery code'}
        </button>
      </section>

      <section className="bg-white rounded-2xl border shadow-sm p-6 space-y-4 hidden">
        <h2 className="font-semibold">People</h2>
        <div className="space-y-2">
          {members.map((m) => (
            <div key={m.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-medium" style={{ backgroundColor: m.color }}>
                {m.name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{m.name}{m.id === user?.id ? ' (you)' : ''}</p>
                <p className="text-xs text-gray-400">{roleLabel(m.role, householdType)}</p>
              </div>
              {canManageMembers(householdType) && m.role !== 'OWNER' && (
                <button
                  onClick={() => removeMember.mutate(m.id)}
                  className="p-2 text-gray-400 hover:text-red-500"
                  title="Remove member"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          ))}
        </div>

        {canManageMembers(householdType) && members.length < MAX_HOUSEHOLD_SIZE && (
          <div className="flex gap-2 pt-2">
            <input
              value={newMemberName}
              onChange={(e) => setNewMemberName(e.target.value)}
              placeholder={householdType === 'GROUP' ? 'New group member name' : 'New family member name'}
              className="flex-1 px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500"
            />
            <button
              onClick={() => newMemberName.trim() && addMember.mutate()}
              disabled={!newMemberName.trim() || addMember.isPending}
              className="flex items-center gap-1 px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
            >
              <UserPlus size={16} /> Add
            </button>
          </div>
        )}

        {canAddPartner(householdType, members.length) && user?.role === 'OWNER' && (
          <div className="pt-2 space-y-2">
            <p className="text-sm text-gray-600">
              Only you are on this account. Add your partner so they can log in as themselves on their phone — same shared shopping & splits, private tasks with a PIN.
            </p>
            <div className="flex gap-2">
              <input
                value={newMemberName}
                onChange={(e) => setNewMemberName(e.target.value)}
                placeholder="Partner's name"
                className="flex-1 px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500"
              />
              <button
                onClick={() => newMemberName.trim() && addMember.mutate()}
                disabled={!newMemberName.trim() || addMember.isPending}
                className="flex items-center gap-1 px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
              >
                <UserPlus size={16} /> Add partner
              </button>
            </div>
          </div>
        )}

        {!canManageMembers(householdType) && !canAddPartner(householdType, members.length) && (
          <p className="text-sm text-gray-500">
            To switch between single / couple / family / group, export your data, clear all, and set up again.
          </p>
        )}
        <button onClick={logout}
          className="flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium hover:bg-gray-50 text-gray-700">
          <LogOut size={16} /> Log out
        </button>
      </section>

      <section className="bg-white rounded-2xl border shadow-sm p-6 space-y-4">
        <h2 className="font-semibold flex items-center gap-2">
          <Smartphone size={18} className="text-brand-600" /> Phone app (free)
        </h2>
        {isStandalone ? (
          <div className="space-y-3">
            <p className="text-sm text-green-700">
              {APP_NAME} is installed on this device. Your data stays synced with the website via GitHub cloud save.
            </p>
            <p className="text-sm text-gray-500">
              If you still see the old login (pick a name / household), the app cache is outdated. Tap below to load the latest version with username sign-in.
            </p>
            <button
              type="button"
              onClick={() => forceAppRefresh().catch(() => window.location.reload())}
              className="flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium hover:bg-gray-50"
            >
              <RefreshCw size={16} /> Update app to latest version
            </button>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-500">
              Install {APP_NAME} on your phone — {APP_TAGLINE.toLowerCase()}. Same login, tasks & expenses as the website.
            </p>
            {showAndroidInstall && (
              <button
                type="button"
                onClick={() => install().then((ok) => ok && toast.success(`${APP_NAME} installed`))}
                className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700"
              >
                <Smartphone size={16} /> Install on this device
              </button>
            )}
            {(showAndroidHint || (isAndroid && !showAndroidInstall)) && <AndroidInstallSteps />}
            {(showIosHint || isIos) && <IosInstallSteps />}
            {!isAndroid && !isIos && !showAndroidInstall && (
              <p className="text-sm text-gray-500">
                Open this page on your phone in Chrome (Android) or Safari (iPhone) to install.
              </p>
            )}
          </>
        )}
      </section>

      <section className="bg-white rounded-2xl border shadow-sm p-6 space-y-4">
        <h2 className="font-semibold flex items-center gap-2">
          <Cloud size={18} className="text-brand-600" /> Cloud save
        </h2>
        <p className="text-sm text-gray-500">
          Your tasks, expenses, shopping list and more save automatically. Open {APP_NAME} on any phone or computer — same data everywhere.
        </p>
        <p className={`text-sm ${status === 'error' ? 'text-red-600' : status === 'syncing' ? 'text-amber-700' : 'text-green-700'}`}>
          {status === 'error'
            ? statusMessage
            : status === 'syncing'
              ? 'Saving to cloud…'
              : config.lastSyncedAt
                ? `Saved · ${new Date(config.lastSyncedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}`
                : 'Saved to cloud'}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => syncToGitHub().then(() => toast.success('Synced')).catch((e) => toast.error(e.message))}
            disabled={!cloudReady}
            className="flex items-center gap-1 px-4 py-2 border rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw size={14} /> Sync now
          </button>
          <button
            onClick={() => pullFromGitHub().then(() => toast.success('Updated from cloud')).catch((e) => toast.error(e.message))}
            disabled={!cloudReady}
            className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            Refresh from cloud
          </button>
        </div>
      </section>

      <section className="bg-white rounded-2xl border shadow-sm p-6 space-y-4">
        <h2 className="font-semibold">Manual backup</h2>
        <p className="text-sm text-gray-500">
          Export a JSON file to backup or move data to another phone/computer.
        </p>
        <div className="flex flex-wrap gap-3">
          <button onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium hover:bg-gray-50">
            <Download size={16} /> Export backup
          </button>
          <button onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium hover:bg-gray-50">
            <Upload size={16} /> Import backup
          </button>
          <input ref={fileRef} type="file" accept=".json" className="hidden"
            onChange={(e) => e.target.files?.[0] && handleImport(e.target.files[0])} />
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-red-100 shadow-sm p-6 space-y-3">
        <h2 className="font-semibold text-red-700">Danger zone</h2>
        <button onClick={handleClearAll}
          className="flex items-center gap-2 px-4 py-2 border border-red-200 text-red-600 rounded-lg text-sm hover:bg-red-50">
          <Trash2 size={16} /> Clear all data on this device
        </button>
      </section>

      {newRecoveryCode && (
        <RecoveryCodeModal
          code={newRecoveryCode}
          title={user?.hasRecoveryCode ? 'New recovery code' : 'Your recovery code'}
          subtitle="Save this code somewhere safe. You need it on the sign-in screen if you forget your PIN."
          onClose={() => setNewRecoveryCode(null)}
        />
      )}

      {pinModal && (
        <PinModal
          title={
            pinModal === 'remove'
              ? 'Remove PIN'
              : pinModal === 'recovery'
                ? 'Confirm PIN'
              : pinModal === 'change-current'
                ? 'Current PIN'
                : pinModal === 'change-new'
                  ? 'New PIN'
                  : 'Set PIN'
          }
          subtitle={
            pinModal === 'remove'
              ? 'Enter your current PIN to remove it'
              : pinModal === 'recovery'
                ? 'Enter your PIN to create a recovery code'
              : pinModal === 'change-current'
                ? 'Enter your current PIN'
                : pinModal === 'change-new'
                  ? 'Choose a new 4-digit PIN'
                  : 'Choose a 4-digit PIN'
          }
          submitLabel={
            pinModal === 'remove'
              ? 'Remove PIN'
              : pinModal === 'recovery'
                ? 'Create code'
              : pinModal === 'change-new'
                ? 'Save new PIN'
                : 'Continue'
          }
          onClose={() => {
            setPinModal(null);
            setPinError('');
            setCurrentPinDraft('');
          }}
          error={pinError}
          onSubmit={async (pin) => {
            try {
              if (pinModal === 'recovery') {
                await generateRecovery.mutateAsync(pin);
                setPinModal(null);
                return;
              }
              if (pinModal === 'remove') {
                await api.delete('/users/me/pin', { currentPin: pin });
                toast.success('PIN removed');
                setPinModal(null);
              } else if (pinModal === 'change-current') {
                setCurrentPinDraft(pin);
                setPinError('');
                setPinModal('change-new');
                return;
              } else if (pinModal === 'change-new') {
                await api.put('/users/me/pin', { pin, currentPin: currentPinDraft });
                toast.success('PIN updated');
                setPinModal(null);
                setCurrentPinDraft('');
              } else {
                await api.put('/users/me/pin', { pin });
                toast.success('PIN set');
                setPinModal(null);
              }
              await refreshUser();
              queryClient.invalidateQueries({ queryKey: ['users'] });
            } catch (err: any) {
              setPinError(err instanceof ApiError ? err.message : 'Could not update PIN');
              throw err;
            }
          }}
        />
      )}
    </div>
  );
}
