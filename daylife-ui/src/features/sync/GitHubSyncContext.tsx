import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  GitHubSyncConfig,
  SyncStatus,
  loadGitHubConfig,
  isGitHubConfigured,
  pullAndMerge,
  syncNow,
  scheduleGitHubPush,
} from '../../lib/githubSync';
import { registerDataSaveHook } from '../../lib/storage';

interface GitHubSyncContextType {
  config: GitHubSyncConfig;
  status: SyncStatus;
  statusMessage: string;
  cloudReady: boolean;
  pullFromGitHub: () => Promise<void>;
  syncToGitHub: () => Promise<void>;
}

const GitHubSyncContext = createContext<GitHubSyncContextType | null>(null);

export function GitHubSyncProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [config, setConfig] = useState<GitHubSyncConfig>(loadGitHubConfig);
  const cloudReady = isGitHubConfigured(config);
  const [status, setStatus] = useState<SyncStatus>(cloudReady ? 'syncing' : 'error');
  const [statusMessage, setStatusMessage] = useState(
    cloudReady ? 'Connecting to cloud…' : 'Cloud sync unavailable',
  );

  const invalidateApp = useCallback(() => {
    queryClient.invalidateQueries();
  }, [queryClient]);

  const pullFromGitHub = useCallback(async () => {
    const cfg = loadGitHubConfig();
    if (!isGitHubConfigured(cfg)) throw new Error('Cloud sync not available');
    setStatus('syncing');
    setStatusMessage('Pulling from cloud…');
    try {
      await pullAndMerge(cfg);
      invalidateApp();
      setConfig(loadGitHubConfig());
      setStatus('synced');
      setStatusMessage('Up to date');
    } catch (err: any) {
      setStatus('error');
      setStatusMessage(err.message || 'Pull failed');
      throw err;
    }
  }, [invalidateApp]);

  const syncToGitHub = useCallback(async () => {
    const cfg = loadGitHubConfig();
    if (!isGitHubConfigured(cfg)) throw new Error('Cloud sync not available');
    setStatus('syncing');
    setStatusMessage('Saving to cloud…');
    try {
      await syncNow(cfg);
      invalidateApp();
      setConfig(loadGitHubConfig());
      setStatus('synced');
      setStatusMessage('Saved to cloud');
    } catch (err: any) {
      setStatus('error');
      setStatusMessage(err.message || 'Sync failed');
      throw err;
    }
  }, [invalidateApp]);

  useEffect(() => {
    registerDataSaveHook(() => scheduleGitHubPush(loadGitHubConfig()));
    return () => registerDataSaveHook(null);
  }, []);

  useEffect(() => {
    const onSync = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.status === 'synced') {
        setStatus('synced');
        setStatusMessage('Saved to cloud');
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
    const cfg = loadGitHubConfig();
    setConfig(cfg);
    if (!isGitHubConfigured(cfg)) {
      setStatus('error');
      setStatusMessage('Cloud sync unavailable');
      return;
    }

    let cancelled = false;
    (async () => {
      setStatus('syncing');
      setStatusMessage('Loading your data…');
      try {
        await syncNow(cfg);
        if (!cancelled) {
          invalidateApp();
          setConfig(loadGitHubConfig());
          setStatus('synced');
          setStatusMessage('Synced — changes save automatically');
        }
      } catch (err: any) {
        if (!cancelled) {
          setStatus('error');
          setStatusMessage(err.message || 'Could not sync');
        }
      }
    })();

    return () => { cancelled = true; };
  }, [invalidateApp]);

  useEffect(() => {
    if (!cloudReady) return;
    const onFocus = () => {
      pullFromGitHub().catch(() => undefined);
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [cloudReady, pullFromGitHub]);

  return (
    <GitHubSyncContext.Provider value={{
      config, status, statusMessage, cloudReady, pullFromGitHub, syncToGitHub,
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
