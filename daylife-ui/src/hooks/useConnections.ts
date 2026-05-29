import { useQuery } from '@tanstack/react-query';
import { api, Connection } from '../lib/api';
import { useAuth } from '../features/auth/AuthContext';
import { useGitHubSync } from '../features/sync/GitHubSyncContext';

let lastInboxSyncAt = 0;
const INBOX_SYNC_MIN_INTERVAL_MS = 20_000;

async function syncInboxIfStale(): Promise<void> {
  const now = Date.now();
  if (now - lastInboxSyncAt < INBOX_SYNC_MIN_INTERVAL_MS) return;
  lastInboxSyncAt = now;
  await api.post('/connections/sync-inbox').catch(() => undefined);
}

export function useConnections(options?: { syncInbox?: boolean }) {
  const { user } = useAuth();
  const { cloudReady } = useGitHubSync();
  const shouldSyncInbox = options?.syncInbox !== false;

  return useQuery<Connection[]>({
    queryKey: ['connections'],
    queryFn: async () => {
      if (shouldSyncInbox && cloudReady) {
        await syncInboxIfStale();
      }
      return api.get('/connections');
    },
    enabled: Boolean(user) && cloudReady,
    staleTime: 25_000,
    refetchOnWindowFocus: true,
  });
}

export async function forceSyncInbox(): Promise<Connection[]> {
  lastInboxSyncAt = 0;
  await syncInboxIfStale();
  return api.get('/connections');
}
