import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  GitHubSyncConfig,
  SyncStatus,
  loadGitHubConfig,
  saveGitHubConfig,
  isGitHubConfigured,
  testGitHubConnection,
  pullAndMerge,
  syncNow,
  scheduleGitHubPush,
} from '../../lib/githubSync';
import { registerDataSaveHook } from '../../lib/storage';

interface GitHubSyncContextType {
  config: GitHubSyncConfig;
  status: SyncStatus;
  statusMessage: string;
  saveConfig: (next: GitHubSyncConfig) => void;
  testConnection: () => Promise<void>;
  pullFromGitHub: () => Promise<void>;
  syncToGitHub: () => Promise<void>;
}

const GitHubSyncContext = createContext<GitHubSyncContextType | null>(null);

export function GitHubSyncProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [config, setConfig] = useState<GitHubSyncConfig>(loadGitHubConfig);
  const [status, setStatus] = useState<SyncStatus>(config.enabled ? 'idle' : 'off');
  const [statusMessage, setStatusMessage] = useState('');

  const invalidateApp = useCallback(() => {
    queryClient.invalidateQueries();
  }, [queryClient]);

  const saveConfig = useCallback((next: GitHubSyncConfig) => {
    saveGitHubConfig(next);
    setConfig(next);
    setStatus(next.enabled ? 'idle' : 'off');
  }, []);

  const pullFromGitHub = useCallback(async () => {
    if (!isGitHubConfigured(config)) throw new Error('Set up GitHub sync first');
    setStatus('syncing');
    setStatusMessage('Pulling from GitHub…');
    try {
      await pullAndMerge(config);
      invalidateApp();
      setStatus('synced');
      setStatusMessage('Up to date with GitHub');
    } catch (err: any) {
      setStatus('error');
      setStatusMessage(err.message || 'Pull failed');
      throw err;
    }
  }, [config, invalidateApp]);

  const syncToGitHub = useCallback(async () => {
    if (!isGitHubConfigured(config)) throw new Error('Set up GitHub sync first');
    setStatus('syncing');
    setStatusMessage('Syncing to GitHub…');
    try {
      await syncNow(config);
      invalidateApp();
      setConfig(loadGitHubConfig());
      setStatus('synced');
      setStatusMessage('Saved to GitHub');
    } catch (err: any) {
      setStatus('error');
      setStatusMessage(err.message || 'Sync failed');
      throw err;
    }
  }, [config, invalidateApp]);

  const testConnection = useCallback(async () => {
    await testGitHubConnection(config);
  }, [config]);

  useEffect(() => {
    registerDataSaveHook(() => scheduleGitHubPush(loadGitHubConfig()));
    return () => registerDataSaveHook(null);
  }, []);

  useEffect(() => {
    const onSync = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.status === 'synced') {
        setStatus('synced');
        setStatusMessage('Saved to GitHub');
        setConfig(loadGitHubConfig());
      }
      if (detail?.status === 'error') {
        setStatus('error');
        setStatusMessage(detail.message || 'Sync failed');
      }
    };
    window.addEventListener('daylife-sync', onSync);
    return () => window.removeEventListener('daylife-sync', onSync);
  }, []);

  useEffect(() => {
    if (!isGitHubConfigured(config)) return;

    let cancelled = false;
    (async () => {
      setStatus('syncing');
      setStatusMessage('Loading cloud data…');
      try {
        await pullAndMerge(config);
        if (!cancelled) {
          invalidateApp();
          setConfig(loadGitHubConfig());
          setStatus('synced');
          setStatusMessage('Synced with GitHub');
        }
      } catch (err: any) {
        if (!cancelled) {
          setStatus('error');
          setStatusMessage(err.message || 'Could not load from GitHub');
        }
      }
    })();

    return () => { cancelled = true; };
  }, [config.enabled, config.owner, config.repo]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isGitHubConfigured(config)) return;
    const onFocus = () => {
      pullFromGitHub().catch(() => undefined);
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [config, pullFromGitHub]);

  return (
    <GitHubSyncContext.Provider value={{
      config, status, statusMessage, saveConfig, testConnection, pullFromGitHub, syncToGitHub,
    }}>
      {children}
    </GitHubSyncContext.Provider>
  );
}

export function useGitHubSync() {
  const ctx = useContext(GitHubSyncContext);
  if (!ctx) throw new Error('useGitHubSync must be used within GitHubSyncProvider');
  return ctx;
}
