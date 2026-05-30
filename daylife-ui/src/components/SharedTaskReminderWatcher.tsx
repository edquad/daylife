import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useConnections } from '../hooks/useConnections';
import { useGitHubSync } from '../features/sync/GitHubSyncContext';
import { api } from '../lib/api';
import { isEveningReminderWindow } from '../lib/sharedTaskReminders';

const CHECK_INTERVAL_MS = 30 * 60 * 1000;

/**
 * In the evening, post a friendly Rozka AI message in chat when a partner still has open shared tasks.
 */
export function SharedTaskReminderWatcher() {
  const { cloudReady } = useGitHubSync();
  const queryClient = useQueryClient();
  const { data: connections = [] } = useConnections();

  useEffect(() => {
    if (!cloudReady) return;

    const run = () => {
      if (document.visibilityState !== 'visible') return;
      if (!isEveningReminderWindow()) return;

      const eligible = connections.filter(
        (c) =>
          c.status === 'active' &&
          c.sharedSpaceId &&
          c.features.includes('tasks') &&
          c.features.includes('chat'),
      );
      if (eligible.length === 0) return;

      void (async () => {
        for (const conn of eligible) {
          try {
            await api.post(`/shared/${conn.sharedSpaceId}/evening-task-reminder`);
          } catch {
            /* ignore per-space errors */
          }
        }
        queryClient.invalidateQueries({ queryKey: ['chat', 'threads'] });
      })();
    };

    run();
    const interval = setInterval(run, CHECK_INTERVAL_MS);
    const onVisible = () => run();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [cloudReady, connections, queryClient]);

  return null;
}
