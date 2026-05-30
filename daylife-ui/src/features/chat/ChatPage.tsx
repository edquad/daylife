import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, MessageCircle, Send, Loader2 } from 'lucide-react';
import { api, type ChatMessage, type ChatThreadSummary } from '../../lib/api';
import { useAuth } from '../auth/AuthContext';
import { useGitHubSync } from '../sync/GitHubSyncContext';
import { useConnections } from '../../hooks/useConnections';
import { markChatRead } from '../../lib/chatReadState';
import { getActiveAccountId } from '../../lib/accounts';
import { PageHeader } from '../../components/PageHeader';
import { cn } from '../../lib/utils';
import { toast } from '../../components/Toaster';

function formatMessageTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) {
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function ThreadList() {
  const { cloudReady } = useGitHubSync();
  const { data: threads = [], isLoading, refetch } = useQuery({
    queryKey: ['chat', 'threads'],
    queryFn: () => api.get<ChatThreadSummary[]>('/chat/threads'),
    enabled: cloudReady,
    refetchInterval: 20_000,
  });

  if (!cloudReady) {
    return (
      <div className="rounded-2xl border bg-amber-50 border-amber-200 p-4 text-sm text-amber-900">
        Turn on cloud sync in Settings to chat with people you share with.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="animate-spin text-brand-600" size={28} />
      </div>
    );
  }

  if (threads.length === 0) {
    return (
      <div className="text-center py-14 px-4 rounded-2xl border border-dashed bg-gray-50/80">
        <MessageCircle size={36} className="mx-auto text-gray-300 mb-3" />
        <p className="font-medium text-gray-700">No chats yet</p>
        <p className="text-sm text-gray-500 mt-1 max-w-xs mx-auto">
          Connect with someone on the Share page — then message them here.
        </p>
        <Link
          to="/share"
          className="inline-flex mt-4 px-4 py-2 rounded-xl bg-brand-600 text-white text-sm font-semibold touch-manipulation"
        >
          Go to Share
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => void refetch()}
        className="text-xs text-brand-600 font-medium mb-2 touch-manipulation"
      >
        Refresh
      </button>
      {threads.map((thread) => (
        <Link
          key={thread.spaceId}
          to={`/chat/${thread.spaceId}`}
          className="flex items-center gap-3 p-4 bg-white rounded-2xl border shadow-sm hover:border-brand-200 transition-colors touch-manipulation"
        >
          <div className="w-11 h-11 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center font-bold shrink-0">
            {thread.partnerUsername.slice(0, 1).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold text-gray-900 truncate">@{thread.partnerUsername}</p>
              {thread.lastMessage && (
                <span className="text-[11px] text-gray-400 shrink-0">
                  {formatMessageTime(thread.lastMessage.createdAt)}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 truncate mt-0.5">
              {thread.lastMessage?.content || 'Say hello'}
            </p>
          </div>
          {thread.unreadCount > 0 && (
            <span className="min-w-[1.25rem] h-5 px-1.5 rounded-full bg-brand-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0">
              {thread.unreadCount > 9 ? '9+' : thread.unreadCount}
            </span>
          )}
        </Link>
      ))}
    </div>
  );
}

function ChatThread({ spaceId }: { spaceId: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const accountId = getActiveAccountId();
  const [draft, setDraft] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const { data: connections = [] } = useConnections({ syncInbox: false });
  const conn = connections.find((c) => c.sharedSpaceId === spaceId && c.status === 'active');

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['chat', 'messages', spaceId],
    queryFn: () => api.get<ChatMessage[]>(`/shared/${spaceId}/messages?limit=200`),
    enabled: Boolean(spaceId),
    refetchInterval: 12_000,
  });

  useEffect(() => {
    if (messages.length === 0) return;
    markChatRead(spaceId, messages[messages.length - 1].createdAt);
    queryClient.invalidateQueries({ queryKey: ['chat', 'threads'] });
  }, [messages, spaceId, queryClient]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const send = useMutation({
    mutationFn: (content: string) => api.post<ChatMessage>(`/shared/${spaceId}/messages`, { content }),
    onSuccess: () => {
      setDraft('');
      queryClient.invalidateQueries({ queryKey: ['chat', 'messages', spaceId] });
      queryClient.invalidateQueries({ queryKey: ['chat', 'threads'] });
    },
    onError: (err: Error) => toast.error(err.message || 'Could not send'),
  });

  if (!conn) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">This chat is not available.</p>
        <button type="button" onClick={() => navigate('/chat')} className="mt-3 text-brand-600 text-sm font-medium">
          Back to chats
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-8rem)] sm:h-[calc(100dvh-6rem)] max-w-lg mx-auto">
      <div className="flex items-center gap-3 pb-3 border-b mb-3">
        <button
          type="button"
          onClick={() => navigate('/chat')}
          className="p-2 -ml-2 text-gray-500 touch-manipulation"
          aria-label="Back"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="w-10 h-10 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center font-bold">
          {conn.partnerUsername.slice(0, 1).toUpperCase()}
        </div>
        <div>
          <p className="font-semibold">@{conn.partnerUsername}</p>
          {conn.partnerName && <p className="text-xs text-gray-500">{conn.partnerName}</p>}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-0">
        {isLoading && (
          <div className="flex justify-center py-8">
            <Loader2 className="animate-spin text-gray-400" size={24} />
          </div>
        )}
        {!isLoading && messages.length === 0 && (
          <p className="text-center text-sm text-gray-400 py-8">No messages yet — say hi!</p>
        )}
        {messages.map((msg) => {
          const mine = msg.authorAccountId === accountId || msg.authorId === user?.id;
          return (
            <div key={msg.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
              <div
                className={cn(
                  'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm',
                  mine ? 'bg-brand-600 text-white rounded-br-md' : 'bg-white border text-gray-800 rounded-bl-md',
                )}
              >
                <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                <p className={cn('text-[10px] mt-1', mine ? 'text-brand-100' : 'text-gray-400')}>
                  {formatMessageTime(msg.createdAt)}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <form
        className="flex gap-2 pt-3 border-t mt-2 shrink-0"
        onSubmit={(e) => {
          e.preventDefault();
          const text = draft.trim();
          if (!text || send.isPending) return;
          send.mutate(text);
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Type a message…"
          className="flex-1 px-4 py-3 border rounded-2xl text-base outline-none focus:ring-2 focus:ring-brand-500"
          autoComplete="off"
          enterKeyHint="send"
        />
        <button
          type="submit"
          disabled={!draft.trim() || send.isPending}
          className="w-12 h-12 rounded-2xl bg-brand-600 text-white flex items-center justify-center disabled:opacity-50 touch-manipulation shrink-0"
          aria-label="Send"
        >
          {send.isPending ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
        </button>
      </form>
    </div>
  );
}

export function ChatPage() {
  const { spaceId } = useParams<{ spaceId?: string }>();
  const { data: threads = [] } = useQuery({
    queryKey: ['chat', 'threads'],
    queryFn: () => api.get<ChatThreadSummary[]>('/chat/threads'),
  });
  const unreadTotal = useMemo(
    () => threads.reduce((sum, t) => sum + t.unreadCount, 0),
    [threads],
  );

  if (spaceId) {
    return (
      <div className="px-4 py-4 sm:px-6 max-w-lg mx-auto">
        <ChatThread spaceId={spaceId} />
      </div>
    );
  }

  return (
    <div className="px-4 py-4 sm:px-6 max-w-lg mx-auto space-y-4">
      <PageHeader
        theme="share"
        icon={MessageCircle}
        title="Chat"
        subtitle={
          unreadTotal > 0
            ? `${unreadTotal} unread message${unreadTotal > 1 ? 's' : ''}`
            : 'Message people you share with'
        }
      />
      <ThreadList />
    </div>
  );
}
