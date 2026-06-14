import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, MessageCircle, Send, Loader2,
  Smile, Brain, Mic, Image, Heart, ThumbsUp,
  Laugh, Flame, Sparkles,
} from 'lucide-react';
import { api, type ChatMessage, type ChatThreadSummary } from '../../lib/api';
import { useAuth } from '../auth/AuthContext';
import { useGitHubSync } from '../sync/GitHubSyncContext';
import { useConnections } from '../../hooks/useConnections';
import { markChatRead } from '../../lib/chatReadState';
import { getActiveAccountId } from '../../lib/accounts';
import { cn } from '../../lib/utils';
import { toast } from '../../components/Toaster';

function formatMessageTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) {
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) {
    return `Yesterday ${d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
  }
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function getDateLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return 'Today';
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

const QUICK_REPLIES = ['👍', '❤️', 'Got it!', 'On my way', 'Sure!', 'Thanks!'];

const REACTIONS = [
  { emoji: '❤️', icon: Heart },
  { emoji: '👍', icon: ThumbsUp },
  { emoji: '😂', icon: Laugh },
  { emoji: '🔥', icon: Flame },
];

function ThreadList() {
  const { cloudReady } = useGitHubSync();
  const { data: threads = [], isLoading, refetch } = useQuery({
    queryKey: ['chat', 'threads'],
    queryFn: () => api.get<ChatThreadSummary[]>('/chat/threads'),
    enabled: cloudReady,
    refetchInterval: 15_000,
  });

  if (!cloudReady) {
    return (
      <div className="mx-4 mt-4 rounded-2xl border bg-amber-50 border-amber-200 p-4 text-sm text-amber-900">
        Enable cloud sync in Settings to chat.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="animate-spin text-violet-600" size={28} />
      </div>
    );
  }

  if (threads.length === 0) {
    return (
      <div className="text-center py-16 px-6">
        <div className="w-20 h-20 rounded-full bg-violet-50 mx-auto mb-4 flex items-center justify-center">
          <MessageCircle size={32} className="text-violet-400" />
        </div>
        <p className="font-bold text-gray-800 text-lg">No chats yet</p>
        <p className="text-sm text-gray-500 mt-2 max-w-xs mx-auto">
          Connect with someone on Share page, then you'll see them here
        </p>
        <Link
          to="/share"
          className="inline-flex mt-5 px-5 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold"
        >
          Go to Share
        </Link>
      </div>
    );
  }

  return (
    <div className="px-4 pt-4 space-y-2">
      {threads.map((thread) => (
        <Link
          key={thread.spaceId}
          to={`/chat/${thread.spaceId}`}
          className="flex items-center gap-3 p-3.5 bg-white rounded-2xl border shadow-sm hover:shadow-md transition-all"
        >
          <div className="relative">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-400 to-indigo-500 text-white flex items-center justify-center font-bold text-lg shrink-0">
              {thread.partnerUsername.slice(0, 1).toUpperCase()}
            </div>
            {thread.unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                {thread.unreadCount > 9 ? '9+' : thread.unreadCount}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className={cn('font-semibold text-gray-900 truncate', thread.unreadCount > 0 && 'text-black')}>
                @{thread.partnerUsername}
              </p>
              {thread.lastMessage && (
                <span className="text-[11px] text-gray-400 shrink-0">
                  {formatMessageTime(thread.lastMessage.createdAt)}
                </span>
              )}
            </div>
            <p className={cn(
              'text-sm truncate mt-0.5',
              thread.unreadCount > 0 ? 'text-gray-800 font-medium' : 'text-gray-500',
            )}>
              {thread.lastMessage?.content || 'Say hello 👋'}
            </p>
          </div>
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
  const [showQuickReplies, setShowQuickReplies] = useState(true);
  const [reactionMsgId, setReactionMsgId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { data: connections = [] } = useConnections({ syncInbox: false });
  const conn = connections.find((c) => c.sharedSpaceId === spaceId && c.status === 'active');

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['chat', 'messages', spaceId],
    queryFn: () => api.get<ChatMessage[]>(`/shared/${spaceId}/messages?limit=200`),
    enabled: Boolean(spaceId),
    refetchInterval: 8_000,
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
      setShowQuickReplies(false);
      queryClient.invalidateQueries({ queryKey: ['chat', 'messages', spaceId] });
      queryClient.invalidateQueries({ queryKey: ['chat', 'threads'] });
    },
    onError: (err: Error) => toast.error(err.message || 'Could not send'),
  });

  const askAI = useMutation({
    mutationFn: (question: string) => api.post<ChatMessage>(`/shared/${spaceId}/messages`, {
      content: `@rozka ${question}`,
    }),
    onSuccess: () => {
      setDraft('');
      queryClient.invalidateQueries({ queryKey: ['chat', 'messages', spaceId] });
    },
    onError: () => toast.error('AI is not available right now'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || send.isPending) return;
    if (text.startsWith('@rozka ') || text.startsWith('/ai ')) {
      askAI.mutate(text.replace(/^(@rozka |\/ai )/, ''));
    } else {
      send.mutate(text);
    }
  };

  const sendQuickReply = (text: string) => {
    if (send.isPending) return;
    send.mutate(text);
  };

  if (!conn) {
    return (
      <div className="text-center py-12 px-4">
        <p className="text-gray-600">This chat is not available.</p>
        <button type="button" onClick={() => navigate('/comms')} className="mt-3 text-violet-600 text-sm font-medium">
          Back to chats
        </button>
      </div>
    );
  }

  // Group messages by date
  const groupedMessages: Array<{ date: string; messages: ChatMessage[] }> = [];
  let currentDate = '';
  for (const msg of messages) {
    const d = new Date(msg.createdAt).toDateString();
    if (d !== currentDate) {
      currentDate = d;
      groupedMessages.push({ date: msg.createdAt, messages: [] });
    }
    groupedMessages[groupedMessages.length - 1].messages.push(msg);
  }

  return (
    <div className="flex flex-col fixed inset-0 top-0 bottom-16 z-30 bg-white max-w-lg mx-auto left-0 right-0">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-white z-10 shrink-0">
        <button
          type="button"
          onClick={() => navigate('/comms')}
          className="p-2 -ml-2 text-gray-500"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-400 to-indigo-500 text-white flex items-center justify-center font-bold">
          {conn.partnerUsername.slice(0, 1).toUpperCase()}
        </div>
        <div className="flex-1">
          <p className="font-semibold text-sm">@{conn.partnerUsername}</p>
          {conn.partnerName && <p className="text-xs text-gray-500">{conn.partnerName}</p>}
        </div>
        <button
          type="button"
          onClick={() => {
            setDraft('/ai ');
            inputRef.current?.focus();
          }}
          className="p-2 rounded-xl bg-violet-50 text-violet-600"
          title="Ask Rozka AI"
        >
          <Brain size={18} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1 min-h-0 bg-gray-50/50">
        {isLoading && (
          <div className="flex justify-center py-8">
            <Loader2 className="animate-spin text-gray-400" size={24} />
          </div>
        )}
        {!isLoading && messages.length === 0 && (
          <div className="text-center py-12">
            <p className="text-4xl mb-3">👋</p>
            <p className="text-sm text-gray-500">Say hi to @{conn.partnerUsername}!</p>
          </div>
        )}

        {groupedMessages.map((group, gi) => (
          <div key={gi}>
            {/* Date separator */}
            <div className="flex items-center justify-center my-3">
              <span className="px-3 py-1 rounded-full bg-gray-100 text-[11px] text-gray-500 font-medium">
                {getDateLabel(group.date)}
              </span>
            </div>
            {group.messages.map((msg) => {
              const isAi = msg.kind === 'ai' || msg.authorId === 'rozka-ai';
              const mine = !isAi && (msg.authorAccountId === accountId || msg.authorId === user?.id);

              if (isAi) {
                return (
                  <div key={msg.id} className="flex justify-start mb-2">
                    <div className="max-w-[88%] rounded-2xl rounded-bl-md px-4 py-3 text-sm bg-gradient-to-br from-violet-50 to-indigo-50 border border-violet-100 shadow-sm">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Sparkles size={12} className="text-violet-600" />
                        <span className="text-[10px] font-bold text-violet-700">Rozka AI</span>
                      </div>
                      <p className="whitespace-pre-wrap break-words text-gray-800 leading-relaxed">{msg.content}</p>
                      <p className="text-[10px] mt-1.5 text-gray-400">{formatMessageTime(msg.createdAt)}</p>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={msg.id}
                  className={cn('flex mb-1.5', mine ? 'justify-end' : 'justify-start')}
                  onDoubleClick={() => setReactionMsgId(reactionMsgId === msg.id ? null : msg.id)}
                >
                  <div className="relative">
                    <div
                      className={cn(
                        'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-sm',
                        mine
                          ? 'bg-violet-600 text-white rounded-br-md'
                          : 'bg-white border text-gray-800 rounded-bl-md',
                      )}
                    >
                      <p className="whitespace-pre-wrap break-words leading-relaxed">{msg.content}</p>
                      <p className={cn('text-[10px] mt-1', mine ? 'text-violet-200' : 'text-gray-400')}>
                        {formatMessageTime(msg.createdAt)}
                      </p>
                    </div>

                    {/* Reaction picker */}
                    {reactionMsgId === msg.id && (
                      <div className={cn(
                        'absolute bottom-full mb-1 flex gap-1 bg-white rounded-full shadow-lg border px-2 py-1.5 z-20',
                        mine ? 'right-0' : 'left-0',
                      )}>
                        {REACTIONS.map((r) => (
                          <button
                            key={r.emoji}
                            type="button"
                            onClick={() => {
                              sendQuickReply(r.emoji);
                              setReactionMsgId(null);
                            }}
                            className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-lg transition-transform hover:scale-125"
                          >
                            {r.emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Quick replies */}
      {showQuickReplies && messages.length > 0 && messages.length <= 10 && (
        <div className="flex gap-2 px-4 py-2 overflow-x-auto no-scrollbar border-t bg-white">
          {QUICK_REPLIES.map((qr) => (
            <button
              key={qr}
              type="button"
              onClick={() => sendQuickReply(qr)}
              disabled={send.isPending}
              className="px-3 py-1.5 rounded-full text-xs font-medium bg-violet-50 text-violet-700 border border-violet-100 whitespace-nowrap hover:bg-violet-100 transition-colors"
            >
              {qr}
            </button>
          ))}
        </div>
      )}

      {/* Input area */}
      <form
        className="flex items-end gap-2 px-4 py-2.5 border-t bg-white shrink-0"
        onSubmit={handleSubmit}
      >
        <div className="flex-1 relative">
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={draft.startsWith('/ai') ? 'Ask Rozka AI anything...' : 'Type a message...'}
            className={cn(
              'w-full px-4 py-2.5 border rounded-2xl text-sm outline-none focus:ring-2 focus:ring-violet-500 pr-10',
              draft.startsWith('/ai') && 'border-violet-300 bg-violet-50',
            )}
            autoComplete="off"
            enterKeyHint="send"
          />
          {!draft && (
            <button
              type="button"
              onClick={() => {
                setDraft('/ai ');
                inputRef.current?.focus();
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-violet-600"
              title="Ask AI"
            >
              <Brain size={18} />
            </button>
          )}
        </div>
        <button
          type="submit"
          disabled={!draft.trim() || send.isPending || askAI.isPending}
          className={cn(
            'w-10 h-10 rounded-2xl flex items-center justify-center disabled:opacity-50 shrink-0 transition-colors',
            draft.startsWith('/ai') ? 'bg-violet-600 text-white' : 'bg-indigo-600 text-white',
          )}
        >
          {(send.isPending || askAI.isPending) ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
        </button>
      </form>
    </div>
  );
}

export function ChatPage({ embedded }: { embedded?: boolean } = {}) {
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
      <div className={embedded ? '' : ''}>
        <ChatThread spaceId={spaceId} />
      </div>
    );
  }

  if (embedded) {
    return <ThreadList />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-br from-indigo-600 to-violet-700 px-5 pt-8 pb-6 text-white">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <MessageCircle size={22} /> Messages
        </h1>
        <p className="text-sm text-white/70 mt-1">
          {unreadTotal > 0
            ? `${unreadTotal} unread message${unreadTotal > 1 ? 's' : ''}`
            : 'Chat with your connections'}
        </p>
      </div>
      <ThreadList />
    </div>
  );
}
