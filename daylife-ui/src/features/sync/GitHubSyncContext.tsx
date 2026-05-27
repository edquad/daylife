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
import { registerDataSaveHook, isFreshSignupInProgress } from '../../lib/storage';
import { getActiveAccountId } from '../../lib/accounts';
import { api } from '../../lib/api';

function friendlySyncError(err: unknown): string {
  const msg = (err as Error)?.message || 'Could not sync';
  if (msg.includes('Unexpected token') || msg.includes('not valid JSON') || msg.includes('\uFEFF')) {
    return 'Cloud file had a bad format — hard refresh the page (Ctrl+Shift+R), then tap Sync now';
  }
  return msg;
}

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
    if (isFreshSignupInProgress()) return;
    const cfg = loadGitHubConfig();
    if (!isGitHubConfigured(cfg)) throw new Error('Cloud sync not available');
    setStatus('syncing');
    setStatusMessage('Pulling from cloud…');
    try {
      await pullAndMerge(cfg);
      invalidateApp();
      setConfig(loadGitHubConfig());
      setStatus('synced');
      setStatusMessage('Everything synced');
    } catch (err: any) {
      setStatus('error');
      setStatusMessage(friendlySyncError(err));
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
      setStatusMessage(friendlySyncError(err));
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
        setStatusMessage('Saved');
        setConfig(loadGitHubConfig());
      }
      if (detail?.status === 'error') {
        setStatus('error');
        setStatusMessage(friendlySyncError(new Error(detail.message || 'Sync failed')));
      }
    };
    window.addEventListener('daylife-sync', onSync);
    return () => window.removeEventListener('daylife-sync', onSync);
  }, []);

  const [accountRevision, setAccountRevision] = useState(0);

  useEffect(() => {
    const onAccountChange = () => setAccountRevision((r) => r + 1);
    window.addEventListener('daylife-account-changed', onAccountChange);
    return () => window.removeEventListener('daylife-account-changed', onAccountChange);
  }, []);

  useEffect(() => {
    const cfg = loadGitHubConfig();
    setConfig(cfg);
    if (!isGitHubConfigured(cfg)) {
      setStatus('error');
      setStatusMessage('Cloud sync unavailable');
      return;
    }

    if (!getActiveAccountId()) {
      setStatus('idle');
      setStatusMessage('Sign in to load your data');
      return;
    }

    let cancelled = false;
    if (isFreshSignupInProgress()) {
      setStatus('idle');
      setStatusMessage('Finish sign up first');
      return;
    }
    (async () => {
      setStatus('syncing');
      setStatusMessage('Loading your data…');
      try {
        await syncNow(cfg);
        if (!cancelled) {
          if (api.getToken()) {
            try {
              await api.post('/connections/sync-inbox');
            } catch {
              /* best effort */
            }
          }
          invalidateApp();
          setConfig(loadGitHubConfig());
          setStatus('synced');
          setStatusMessage('Saved automatically');
        }
      } catch (err: any) {
        if (!cancelled) {
          setStatus('error');
          setStatusMessage(friendlySyncError(err));
        }
      }
    })();

    return () => { cancelled = true; };
  }, [invalidateApp, accountRevision]);

  useEffect(() => {
    if (!cloudReady) return;
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        pullFromGitHub().catch(() => undefined);
      }
    };
    window.addEventListener('focus', onVisible);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', onVisible);
      document.removeEventListener('visibilitychange', onVisible);
    };
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
