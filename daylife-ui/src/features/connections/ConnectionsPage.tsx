import React, { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  api,
  Connection,
  ShareFeature,
  SHARE_FEATURE_LABELS,
  ALL_SHARE_FEATURES,
} from '../../lib/api';
import { useAuth } from '../auth/AuthContext';
import { useGitHubSync } from '../sync/GitHubSyncContext';
import { useConnections } from '../../hooks/useConnections';
import { useInviteActions } from '../../hooks/useInviteActions';
import { toast } from '../../components/Toaster';
import { ApiError } from '../../lib/api';
import {
  UserPlus, Check, X, Users, MessageCircle, Loader2,
  Search, Copy, ChevronRight, Sparkles,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { normalizeUsername } from '../../lib/accounts';

const QUICK_PRESETS: Array<{ id: string; label: string; emoji: string; features: ShareFeature[] }> = [
  { id: 'everything', label: 'Everything', emoji: '✨', features: ALL_SHARE_FEATURES },
  { id: 'family', label: 'Family', emoji: '🏡', features: ['tasks', 'shopping', 'reminders', 'routines', 'expenses'] },
  { id: 'money', label: 'Money', emoji: '💰', features: ['expenses', 'splits'] },
  { id: 'lists', label: 'Lists', emoji: '📋', features: ['tasks', 'shopping', 'reminders'] },
];

export function ConnectionsPage() {
  const { user } = useAuth();
  const { cloudReady } = useGitHubSync();
  const queryClient = useQueryClient();
  const [username, setUsername] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sending, setSending] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState('everything');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const { data: connections = [], isLoading } = useConnections();
  const { accept, decline, cancel, actingInviteId } = useInviteActions();

  const pendingReceived = connections.filter((c) => c.status === 'pending_received');
  const pendingSent = connections.filter((c) => c.status === 'pending_sent');
  const active = connections.filter((c) => c.status === 'active');

  const { data: searchResults } = useQuery<{ usernames: string[] }>({
    queryKey: ['account-usernames-search', debouncedSearch],
    queryFn: () => api.get(`/accounts/usernames/search?q=${encodeURIComponent(debouncedSearch)}&limit=5`),
    enabled: cloudReady && debouncedSearch.length >= 2,
  });

  const searchMatches = searchResults?.usernames ?? [];

  const getFeatures = (): ShareFeature[] => {
    return QUICK_PRESETS.find((p) => p.id === selectedPreset)?.features || ALL_SHARE_FEATURES;
  };

  const handleInvite = async (targetUsername?: string) => {
    const target = normalizeUsername(targetUsername || username);
    if (!target || target.length < 3) {
      toast.error('Enter a valid username');
      return;
    }
    setSending(true);
    try {
      await api.post<Connection>('/connections/invite', {
        username: target,
        features: getFeatures(),
      });
      setUsername('');
      setSearchQuery('');
      queryClient.invalidateQueries({ queryKey: ['connections'] });
      toast.success(`Invite sent to @${target}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not send invite');
    } finally {
      setSending(false);
    }
  };

  const copyUsername = () => {
    if (user?.username) {
      navigator.clipboard.writeText(user.username);
      toast.success('Username copied!');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-gradient-to-br from-violet-600 to-indigo-700 px-5 pt-8 pb-6 text-white">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Users size={22} /> Share & Connect
        </h1>
        <p className="text-sm text-white/70 mt-1">
          {active.length} connected{pendingReceived.length > 0 ? ` · ${pendingReceived.length} pending` : ''}
        </p>
      </div>

      <div className="px-4 -mt-3 space-y-4">
        {/* Your username card */}
        {user?.username && (
          <div className="bg-white rounded-2xl border p-4 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">Your username</p>
              <p className="text-base font-bold text-violet-700">@{user.username}</p>
            </div>
            <button
              type="button"
              onClick={copyUsername}
              className="p-2.5 rounded-xl bg-violet-50 text-violet-600"
            >
              <Copy size={18} />
            </button>
          </div>
        )}

        {/* Pending invites */}
        {pendingReceived.length > 0 && (
          <div className="bg-white rounded-2xl border border-amber-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-amber-50 border-b border-amber-100">
              <p className="text-sm font-bold text-amber-900">
                {pendingReceived.length} invite{pendingReceived.length > 1 ? 's' : ''} for you
              </p>
            </div>
            <div className="divide-y">
              {pendingReceived.map((c) => (
                <div key={c.id} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center font-bold text-sm shrink-0">
                      {c.partnerUsername[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">@{c.partnerUsername}</p>
                      {c.partnerName && <p className="text-xs text-gray-400 truncate">{c.partnerName}</p>}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => accept.mutate(c.inviteId)}
                      disabled={actingInviteId === c.inviteId}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-medium"
                    >
                      <Check size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => decline.mutate(c.inviteId)}
                      disabled={actingInviteId === c.inviteId}
                      className="px-3 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-medium border border-red-200"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Active connections */}
        {active.length > 0 && (
          <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b bg-gray-50">
              <p className="text-sm font-semibold text-gray-800">Your people</p>
            </div>
            <div className="divide-y">
              {active.map((c) => (
                <div key={c.id} className="px-4 py-3 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center font-bold shrink-0">
                    {c.partnerUsername[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      @{c.partnerUsername}
                      {c.partnerName && <span className="text-gray-400 font-normal"> · {c.partnerName}</span>}
                    </p>
                    <p className="text-xs text-violet-600 mt-0.5">
                      {c.features.slice(0, 3).map((f) => SHARE_FEATURE_LABELS[f]?.title || f).join(', ')}
                      {c.features.length > 3 && ` +${c.features.length - 3}`}
                    </p>
                  </div>
                  {c.sharedSpaceId && (
                    <Link
                      to={`/chat/${c.sharedSpaceId}`}
                      className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0"
                    >
                      <MessageCircle size={16} />
                    </Link>
                  )}
                  <ChevronRight size={16} className="text-gray-300 shrink-0" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pending sent */}
        {pendingSent.length > 0 && (
          <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b bg-gray-50">
              <p className="text-xs font-medium text-gray-500">Waiting for them</p>
            </div>
            <div className="divide-y">
              {pendingSent.map((c) => (
                <div key={c.id} className="px-4 py-3 flex items-center justify-between">
                  <p className="text-sm text-gray-600">@{c.partnerUsername}</p>
                  <button
                    type="button"
                    onClick={() => cancel.mutate(c.inviteId)}
                    className="text-xs text-red-500 font-medium"
                  >
                    Cancel
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {connections.length === 0 && !isLoading && (
          <div className="text-center py-10 px-4 rounded-2xl border border-dashed bg-white">
            <Users size={40} className="mx-auto text-gray-200 mb-3" />
            <p className="font-medium text-gray-700">No connections yet</p>
            <p className="text-sm text-gray-400 mt-1">Invite someone below to start sharing</p>
          </div>
        )}

        {/* Invite section */}
        <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b bg-gradient-to-r from-violet-50 to-indigo-50">
            <p className="text-sm font-bold text-indigo-900 flex items-center gap-2">
              <UserPlus size={16} /> Invite someone
            </p>
          </div>
          <div className="p-4 space-y-4">
            {/* Preset chips */}
            <div>
              <p className="text-xs text-gray-500 mb-2">What to share</p>
              <div className="flex gap-2 flex-wrap">
                {QUICK_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setSelectedPreset(preset.id)}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                      selectedPreset === preset.id
                        ? 'bg-violet-600 text-white border-violet-600'
                        : 'bg-white text-gray-700 border-gray-200',
                    )}
                  >
                    {preset.emoji} {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Search */}
            {!cloudReady ? (
              <p className="text-xs text-amber-700 bg-amber-50 p-3 rounded-xl">
                Enable cloud sync in Settings first
              </p>
            ) : (
              <div>
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    value={username}
                    onChange={(e) => {
                      const v = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
                      setUsername(v);
                      setSearchQuery(v);
                    }}
                    placeholder="Search username..."
                    autoComplete="off"
                    className="w-full pl-9 pr-3 py-3 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-violet-500"
                    disabled={sending}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleInvite(); } }}
                  />
                </div>

                {/* Search results */}
                {debouncedSearch.length >= 2 && searchMatches.length > 0 && (
                  <div className="mt-2 border rounded-xl overflow-hidden divide-y bg-white shadow-sm">
                    {searchMatches.map((u) => (
                      <button
                        key={u}
                        type="button"
                        onClick={() => handleInvite(u)}
                        disabled={sending}
                        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-violet-50 transition-colors"
                      >
                        <span className="text-sm font-medium">@{u}</span>
                        <span className="text-xs text-violet-600 font-medium flex items-center gap-1">
                          <Sparkles size={12} /> Invite
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {debouncedSearch.length >= 2 && searchMatches.length === 0 && (
                  <p className="text-xs text-gray-400 mt-2 text-center">No user found — check spelling</p>
                )}

                {/* Send button when typing */}
                {username.length >= 3 && searchMatches.length === 0 && (
                  <button
                    type="button"
                    onClick={() => handleInvite()}
                    disabled={sending}
                    className="w-full mt-3 py-3 bg-violet-600 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {sending ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
                    Invite @{username}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
