import React, { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';
import { useGitHubSync } from '../sync/GitHubSyncContext';
import { api, User, HouseholdInfo } from '../../lib/api';
import { exportData, importData } from '../../lib/storage';
import {
  HOUSEHOLD_TYPE_LABELS,
  roleLabel,
  MAX_HOUSEHOLD_SIZE,
  type HouseholdType,
} from '../../lib/household';
import { toast } from '../../components/Toaster';
import { Heart, Download, Upload, Trash2, UserPlus, LogOut, Cloud, RefreshCw, Smartphone } from 'lucide-react';
import { usePwaInstall } from '../../hooks/usePwaInstall';

export function SettingsPage() {
  const { user, logout } = useAuth();
  const { config, status, statusMessage, cloudReady, pullFromGitHub, syncToGitHub } = useGitHubSync();
  const { install, isStandalone, isIos, showIosHint, showAndroidInstall } = usePwaInstall();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(user?.name || '');
  const [color, setColor] = useState(user?.color || '#0F766E');
  const [newMemberName, setNewMemberName] = useState('');

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
    onSuccess: () => {
      setNewMemberName('');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['household'] });
      toast.success('Family member added');
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
        </p>
      </section>

      <section className="bg-white rounded-2xl border shadow-sm p-6 space-y-4">
        <h2 className="font-semibold flex items-center gap-2">
          <Heart size={18} className="text-brand-600" /> Your profile
        </h2>
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
              {householdType === 'FAMILY' && m.role !== 'OWNER' && (
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

        {householdType === 'FAMILY' && members.length < MAX_HOUSEHOLD_SIZE && (
          <div className="flex gap-2 pt-2">
            <input
              value={newMemberName}
              onChange={(e) => setNewMemberName(e.target.value)}
              placeholder="New family member name"
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

        {householdType !== 'FAMILY' && (
          <p className="text-sm text-gray-500">
            To switch between single / couple / family, export your data, clear all, and set up again.
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
          <p className="text-sm text-green-700">
            DayLife is installed on this device. Your data stays synced with the website via GitHub cloud save.
          </p>
        ) : (
          <>
            <p className="text-sm text-gray-500">
              Install DayLife on your phone — same login, same tasks, expenses & vision board as the website. No app store needed.
            </p>
            {showAndroidInstall && (
              <button
                type="button"
                onClick={() => install().then((ok) => ok && toast.success('DayLife installed'))}
                className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700"
              >
                <Smartphone size={16} /> Install on this device
              </button>
            )}
            {(showIosHint || isIos) && (
              <div className="text-sm text-gray-600 bg-gray-50 rounded-xl p-4 space-y-2">
                <p className="font-medium text-gray-800">iPhone / iPad (Safari)</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Open this site in Safari</li>
                  <li>Tap the Share button</li>
                  <li>Choose <strong>Add to Home Screen</strong></li>
                </ol>
              </div>
            )}
            {!showAndroidInstall && !isIos && (
              <p className="text-sm text-gray-500">
                On Android Chrome, use the browser menu → <strong>Install app</strong> or <strong>Add to Home screen</strong>.
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
          Always on — tasks, expenses, shopping & more sync to{' '}
          <a
            href={`https://github.com/${config.owner}/${config.repo}`}
            target="_blank"
            rel="noreferrer"
            className="text-brand-600 hover:underline"
          >
            {config.owner}/{config.repo}
          </a>
          . Open the app on any device and your data is there.
        </p>
        <p className={`text-sm ${status === 'error' ? 'text-red-600' : 'text-green-700'}`}>
          {statusMessage || (cloudReady ? 'Synced' : 'Waiting for cloud connection')}
          {config.lastSyncedAt && ` · Last sync ${new Date(config.lastSyncedAt).toLocaleString()}`}
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
    </div>
  );
}
