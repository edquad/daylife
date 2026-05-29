import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useConnections, forceSyncInbox } from '../hooks/useConnections';
import { useInviteAcceptedNotifier } from '../hooks/useInviteActions';
import { useGitHubSync } from '../features/sync/GitHubSyncContext';
import { notifyNewInvites, updatePendingBadge } from '../lib/pendingNotifications';

const POLL_MS = 45_000;

export function PendingNotificationsWatcher() {
  const { cloudReady } = useGitHubSync();
  const queryClient = useQueryClient();
  const { data: connections = [] } = useConnections();
  useInviteAcceptedNotifier(connections);
  const prevPendingCount = useRef(0);

  const pendingReceived = connections.filter((c) => c.status === 'pending_received');

  useEffect(() => {
    updatePendingBadge(pendingReceived.length);
    if (pendingReceived.length > prevPendingCount.current) {
      notifyNewInvites(pendingReceived);
    }
    prevPendingCount.current = pendingReceived.length;
  }, [pendingReceived]);

  useEffect(() => {
    if (!cloudReady) return;

    const pollInbox = () => {
      if (document.visibilityState !== 'visible') return;
      forceSyncInbox()
        .then((next) => {
          queryClient.setQueryData(['connections'], next);
        })
        .catch(() => undefined);
    };

    pollInbox();
    const interval = setInterval(pollInbox, POLL_MS);
    const onVisible = () => pollInbox();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [cloudReady, queryClient]);

  return null;
}
