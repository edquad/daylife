import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type ChatThreadSummary } from '../lib/api';
import { useGitHubSync } from '../features/sync/GitHubSyncContext';
import { getActiveAccountId } from '../lib/accounts';
import {
  chatAlertsEnabled,
  markChatMessageNotified,
  showChatNotification,
  wasChatMessageNotified,
} from '../lib/chatNotifications';
import { updatePendingBadge } from '../lib/pendingNotifications';
import { useConnections } from '../hooks/useConnections';

const POLL_MS = 15_000;

/**
 * When a partner sends a chat message, show banner + sound (WhatsApp-style) if you're not in that thread.
 */
export function ChatNotificationWatcher() {
  const { cloudReady } = useGitHubSync();
  const location = useLocation();
  const queryClient = useQueryClient();
  const accountId = getActiveAccountId();
  const { data: connections = [] } = useConnections({ syncInbox: false });

  const { data: threads = [] } = useQuery({
    queryKey: ['chat', 'threads'],
    queryFn: () => api.get<ChatThreadSummary[]>('/chat/threads'),
    enabled: cloudReady && Boolean(accountId),
    refetchInterval: POLL_MS,
  });

  const pendingInvites = connections.filter((c) => c.status === 'pending_received').length;
  const chatUnread = threads.reduce((sum, t) => sum + t.unreadCount, 0);

  useEffect(() => {
    updatePendingBadge(pendingInvites + chatUnread);
  }, [pendingInvites, chatUnread]);

  useEffect(() => {
    if (!cloudReady || !accountId || !chatAlertsEnabled()) return;

    const activeChatMatch = location.pathname.match(/\/chat\/([^/]+)/);
    const activeSpaceId = activeChatMatch?.[1] || null;

    for (const thread of threads) {
      const last = thread.lastMessage;
      if (!last) continue;
      if (last.authorAccountId === accountId) continue;

      if (activeSpaceId === thread.spaceId && document.visibilityState === 'visible') {
        markChatMessageNotified(thread.spaceId, last.id);
        continue;
      }

      if (wasChatMessageNotified(thread.spaceId, last.id)) continue;

      const senderLabel =
        last.authorId === 'rozka-ai'
          ? 'Rozka AI'
          : thread.partnerName || `@${thread.partnerUsername}`;

      showChatNotification({
        spaceId: thread.spaceId,
        senderLabel,
        body: last.content,
        messageId: last.id,
      });
    }
  }, [threads, cloudReady, accountId, location.pathname]);

  useEffect(() => {
    if (!cloudReady) return;
    const onVisible = () => queryClient.invalidateQueries({ queryKey: ['chat', 'threads'] });
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [cloudReady, queryClient]);

  return null;
}
