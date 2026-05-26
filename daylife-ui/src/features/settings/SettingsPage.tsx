import React, { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';
import { useGitHubSync } from '../sync/GitHubSyncContext';
import { api, User, HouseholdInfo } from '../../lib/api';
import { exportData, importData } from '../../lib/storage';
import type { GitHubSyncConfig } from '../../lib/githubSync';
import { testGitHubConnection } from '../../lib/githubSync';
import {
  HOUSEHOLD_TYPE_LABELS,
  roleLabel,
  MAX_HOUSEHOLD_SIZE,
  type HouseholdType,
} from '../../lib/household';
import { toast } from '../../components/Toaster';
import { Heart, Download, Upload, Trash2, UserPlus, LogOut, Cloud, RefreshCw } from 'lucide-react';

export function SettingsPage() {
  const { user, logout } = useAuth();
  const { config, status, statusMessage, saveConfig, pullFromGitHub, syncToGitHub } = useGitHubSync();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(user?.name || '');
  const [color, setColor] = useState(user?.color || '#0F766E');
  const [newMemberName, setNewMemberName] = useState('');
  const [ghOwner, setGhOwner] = useState(config.owner);
  const [ghRepo, setGhRepo] = useState(config.repo);
  const [ghToken, setGhToken] = useState(config.token);
  const [ghEnabled, setGhEnabled] = useState(config.enabled);
  const [ghBusy, setGhBusy] = useState(false);

  React.useEffect(() => {
    setGhOwner(config.owner);
    setGhRepo(config.repo);
    setGhToken(config.token);
    setGhEnabled(config.enabled);
  }, [config]);

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

  const buildGhConfig = (): GitHubSyncConfig => ({
    ...config,
    enabled: ghEnabled,
    owner: ghOwner.trim(),
    repo: ghRepo.trim() || 'daylife-data',
    token: ghToken.trim(),
    branch: config.branch || 'main',
    path: config.path || 'data/daylife.json',
  });

  const handleSaveGitHub = async () => {
    setGhBusy(true);
    try {
      const next = buildGhConfig();
      await testGitHubConnection(next);
      saveConfig(next);
      if (next.enabled) {
        await syncToGitHub();
        toast.success('GitHub cloud save enabled');
      } else {
        toast.success('GitHub settings saved');
      }
    } catch (err: any) {
      toast.error(err.message || 'GitHub setup failed');
    } finally {
      setGhBusy(false);
    }
  };

  return (
    <div className="p-4 lg:p-6 max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-gray-500 text-sm">Local storage + optional free GitHub cloud sync</p>
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
          <Cloud size={18} className="text-brand-600" /> GitHub cloud save (free)
        </h2>
        <p className="text-sm text-gray-500">
          Stores your household data as a private JSON file in a GitHub repo. Same repo on phone + laptop = shared data.
          Your token stays on this device only — never share it in chat.
        </p>

        <ol className="text-sm text-gray-600 list-decimal list-inside space-y-1 bg-gray-50 rounded-xl p-4">
          <li>Create a <strong>private</strong> repo on GitHub (e.g. <code className="text-xs bg-white px-1 rounded">daylife-data</code>)</li>
          <li>GitHub → Settings → Developer settings → <strong>Personal access tokens</strong></li>
          <li>Create token with <strong>repo</strong> access (classic token is fine)</li>
          <li>Enter details below and enable sync</li>
        </ol>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={ghEnabled} onChange={(e) => setGhEnabled(e.target.checked)} />
          Enable GitHub cloud save
        </label>

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">GitHub username</label>
            <input value={ghOwner} onChange={(e) => setGhOwner(e.target.value)} placeholder="your-username"
              className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Data repo name</label>
            <input value={ghRepo} onChange={(e) => setGhRepo(e.target.value)} placeholder="daylife-data"
              className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Personal access token</label>
          <input type="password" value={ghToken} onChange={(e) => setGhToken(e.target.value)} placeholder="ghp_..."
            className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500" />
        </div>

        {config.enabled && (
          <p className={`text-xs ${status === 'error' ? 'text-red-600' : 'text-gray-500'}`}>
            Status: {statusMessage || status}
            {config.lastSyncedAt && ` · Last sync ${new Date(config.lastSyncedAt).toLocaleString()}`}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <button onClick={handleSaveGitHub} disabled={ghBusy}
            className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50">
            {ghBusy ? 'Saving…' : 'Save & sync'}
          </button>
          {config.enabled && (
            <>
              <button onClick={() => syncToGitHub().then(() => toast.success('Synced')).catch((e) => toast.error(e.message))}
                className="flex items-center gap-1 px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">
                <RefreshCw size={14} /> Sync now
              </button>
              <button onClick={() => pullFromGitHub().then(() => toast.success('Pulled from GitHub')).catch((e) => toast.error(e.message))}
                className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">
                Pull from GitHub
              </button>
            </>
          )}
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
