import { useQuery } from '@tanstack/react-query';
import { api, type ChatThreadSummary } from '../lib/api';
import { useGitHubSync } from '../features/sync/GitHubSyncContext';

export function useChatUnreadCount(): number {
  const { cloudReady } = useGitHubSync();
  const { data: threads = [] } = useQuery({
    queryKey: ['chat', 'threads'],
    queryFn: () => api.get<ChatThreadSummary[]>('/chat/threads'),
    enabled: cloudReady,
    refetchInterval: 30_000,
  });
  return threads.reduce((sum, t) => sum + t.unreadCount, 0);
}
