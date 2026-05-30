import React, { useMemo, useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  api,
  Connection,
  ShareFeature,
  SHARE_FEATURE_GROUPS,
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
  UserPlus,
  Check,
  X,
  Users,
  RefreshCw,
  CheckSquare,
  Receipt,
  ShoppingCart,
  StickyNote,
  Bell,
  Star,
  HandCoins,
  Sun,
  Loader2,
  ArrowRight,
  Sparkles,
  Search,
  Tag,
  ChevronDown,
  ChevronUp,
  UserRound,
  MessageCircle,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { normalizeUsername } from '../../lib/accounts';
import { PageHeader } from '../../components/PageHeader';
import { SharedFeatureLinks } from '../../components/SharedFeatureLinks';
import { PendingInvitesBanner, shareScopeLabel } from '../../components/PendingInvitesBanner';

const FEATURE_ICONS: Record<ShareFeature, typeof CheckSquare> = {
  tasks: CheckSquare,
  expenses: Receipt,
  splits: HandCoins,
  shopping: ShoppingCart,
  notes: StickyNote,
  reminders: Bell,
  routines: Sun,
  vision: Star,
  chat: MessageCircle,
};

const SHARE_PRESETS: Array<{ id: string; label: string; features: ShareFeature[] }> = [
  { id: 'family', label: 'Family daily', features: ['tasks', 'shopping', 'reminders', 'routines', 'expenses'] },
  { id: 'money', label: 'Money together', features: ['expenses', 'splits'] },
  { id: 'lists', label: 'Lists & tasks', features: ['tasks', 'shopping', 'reminders'] },
  { id: 'full', label: 'Share all', features: ALL_SHARE_FEATURES },
];

const GROUP_SUGGESTIONS = ['Family', 'Friends', 'Work', 'Roommates', 'Partner'];

function groupSelectionState(features: ShareFeature[], selected: Set<ShareFeature>): 'all' | 'some' | 'none' {
  const on = features.filter((f) => selected.has(f)).length;
  if (on === 0) return 'none';
  if (on === features.length) return 'all';
  return 'some';
}

function parseUsernames(raw: string): string[] {
  return [
    ...new Set(
      raw
        .split(/[\s,;\n]+/)
        .map((part) => normalizeUsername(part))
        .filter((u) => u.length >= 3),
    ),
  ];
}

export function ConnectionsPage() {
  const { user } = useAuth();
  const { cloudReady, pullFromGitHub } = useGitHubSync();
  const queryClient = useQueryClient();
  const [username, setUsername] = useState('');
  const [batchMode, setBatchMode] = useState(false);
  const [batchUsernames, setBatchUsernames] = useState('');
  const [groupLabel, setGroupLabel] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [connectionFilter, setConnectionFilter] = useState('');
  const [selected, setSelected] = useState<Set<ShareFeature>>(
    () => new Set(['tasks', 'expenses', 'splits', 'shopping', 'reminders', 'routines']),
  );
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const { data: connections = [], isLoading, refetch } = useConnections();
  const { accept, decline, cancel, actingInviteId } = useInviteActions();

  const pendingReceived = connections.filter((c) => c.status === 'pending_received');
  const pendingSent = connections.filter((c) => c.status === 'pending_sent');
  const active = connections.filter((c) => c.status === 'active');

  useEffect(() => {
    if (active.length > 0 && pendingReceived.length === 0) {
      setInviteOpen(false);
    }
  }, [active.length, pendingReceived.length]);

  const { data: searchResults } = useQuery<{ usernames: string[] }>({
    queryKey: ['account-usernames-search', debouncedSearch],
    queryFn: () =>
      api.get(`/accounts/usernames/search?q=${encodeURIComponent(debouncedSearch)}&limit=8`),
    enabled: cloudReady && !batchMode && debouncedSearch.length >= 2,
  });

  const searchMatches = searchResults?.usernames ?? [];

  const inviteOne = async (targetUsername: string, label?: string) => {
    await api.post<Connection>('/connections/invite', {
      username: targetUsername,
      features: Array.from(selected),
      groupLabel: label?.trim() || undefined,
    });
  };

  const updateLabel = useMutation({
    mutationFn: ({ id, groupLabel: label }: { id: string; groupLabel: string }) =>
      api.put<Connection>(`/connections/${id}/label`, { groupLabel: label }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['connections'] }),
  });

  const filteredActive = useMemo(() => {
    const q = normalizeUsername(connectionFilter);
    if (!q) return active;
    return active.filter(
      (c) =>
        c.partnerUsername.includes(q) ||
        (c.partnerName && normalizeUsername(c.partnerName).includes(q)) ||
        (c.groupLabel && c.groupLabel.toLowerCase().includes(q)),
    );
  }, [active, connectionFilter]);

  const activeByGroup = useMemo(() => {
    const map = new Map<string, Connection[]>();
    for (const c of filteredActive) {
      const key = c.groupLabel?.trim() || 'Ungrouped';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    return [...map.entries()].sort((a, b) => {
      if (a[0] === 'Ungrouped') return 1;
      if (b[0] === 'Ungrouped') return -1;
      return a[0].localeCompare(b[0]);
    });
  }, [filteredActive]);

  const toggleFeature = (feature: ShareFeature) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(feature)) next.delete(feature);
      else next.add(feature);
      return next;
    });
  };

  const toggleGroup = (features: ShareFeature[]) => {
    setSelected((prev) => {
      const next = new Set(prev);
      const state = groupSelectionState(features, prev);
      if (state === 'all') features.forEach((f) => next.delete(f));
      else features.forEach((f) => next.add(f));
      return next;
    });
  };

  const applyPreset = (features: ShareFeature[]) => {
    setSelected(new Set(features));
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selected.size === 0) {
      toast.error('Pick at least one thing to share');
      return;
    }

    const targets = batchMode ? parseUsernames(batchUsernames) : parseUsernames(username);
    if (targets.length === 0) {
      toast.error(batchMode ? 'Enter at least one username (3+ letters)' : 'Enter a username to search');
      return;
    }

    setSending(true);
    const results = await Promise.allSettled(
      targets.map((target) => inviteOne(target, groupLabel)),
    );
    let ok = 0;
    const failed: string[] = [];
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === 'fulfilled') ok += 1;
      else {
        const err = result.reason;
        failed.push(`${targets[i]}: ${err instanceof ApiError ? err.message : (err as Error).message}`);
      }
    }
    try {
      if (ok > 0) {
        setUsername('');
        setBatchUsernames('');
        queryClient.invalidateQueries({ queryKey: ['connections'] });
        queryClient.invalidateQueries({ queryKey: ['account-usernames-search'] });
        toast.success(
          ok === 1 ? `Invite sent to @${targets[0]}` : `${ok} invites sent — waiting for accept`,
        );
      }
      if (failed.length > 0) {
        toast.error(failed.slice(0, 2).join(' · ') + (failed.length > 2 ? ` (+${failed.length - 2} more)` : ''));
      }
    } finally {
      setSending(false);
    }
  };

  const handleRefresh = async () => {
    if (!cloudReady) return;
    setRefreshing(true);
    try {
      await pullFromGitHub();
      await refetch();
      toast.success('Refreshed from cloud');
    } catch {
      toast.error('Could not refresh');
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto space-y-5">
      <PageHeader
        theme="share"
        icon={Users}
        title="Share"
        subtitle={`${active.length} connected · ${pendingSent.length} waiting · ${pendingReceived.length} for you`}
        hint="One private link per person. Tag a group (Family, Work) to stay organized when you share with many."
      />

      {!cloudReady && (
        <div className="px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
          Cloud sync is required to invite others.
        </div>
      )}

      <PendingInvitesBanner
        invites={pendingReceived}
        onAccept={(id) => accept.mutate(id)}
        onDecline={(id) => decline.mutate(id)}
        acceptingId={actingInviteId}
      />

      {user?.username && (
        <div className="flex items-start gap-2 px-3 py-2.5 bg-violet-50 border border-violet-100 rounded-xl text-sm">
          <UserRound size={16} className="text-violet-500 shrink-0 mt-0.5" />
          <span className="text-violet-900 break-words min-w-0">
            Your username: <strong className="text-violet-950">@{user.username}</strong>
            <span className="text-violet-700"> — tell friends this so they can invite you</span>
          </span>
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold text-gray-900">Your people</h2>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={!cloudReady || refreshing}
          className="text-xs text-brand-600 flex items-center gap-1 touch-manipulation"
        >
          <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {active.length > 3 && (
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={connectionFilter}
            onChange={(e) => setConnectionFilter(e.target.value)}
            placeholder="Filter connections…"
            className="w-full pl-8 pr-3 py-2 border rounded-xl text-sm"
          />
        </div>
      )}

      {isLoading ? (
        <div className="py-12 text-center text-gray-400 text-sm">Loading…</div>
      ) : (
        <div className="space-y-4">
          {pendingSent.length > 0 && (
            <section className="bg-white border border-amber-100 rounded-2xl p-4">
              <h3 className="font-medium text-sm mb-2 text-amber-900">Waiting for them to accept ({pendingSent.length})</h3>
              <div className="space-y-2">
                {pendingSent.map((c) => (
                  <div key={c.id} className="flex items-start justify-between gap-2 py-1.5 border-b border-gray-50 last:border-0">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">@{c.partnerUsername}</p>
                      <p className="text-xs text-gray-500 truncate">{shareScopeLabel(c.features)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => cancel.mutate(c.inviteId)}
                      disabled={actingInviteId === c.inviteId}
                      className="text-xs text-red-600 shrink-0 px-2 py-1 rounded-lg border border-red-100 touch-manipulation"
                    >
                      Cancel
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {activeByGroup.map(([group, list]) => (
            <section key={group} className="bg-white border rounded-2xl overflow-hidden shadow-sm">
              <div className="px-4 py-2.5 bg-gradient-to-r from-violet-50 to-fuchsia-50 border-b flex items-center justify-between">
                <h3 className="font-medium text-sm text-gray-800">
                  {group} <span className="text-gray-400 font-normal">({list.length})</span>
                </h3>
              </div>
              <div className="divide-y">
                {list.map((c) => (
                  <div key={c.id} className="p-4 space-y-2">
                    <div className="flex justify-between gap-2">
                      <div>
                        <p className="font-medium text-sm">
                          @{c.partnerUsername}
                          {c.partnerName && (
                            <span className="text-gray-400 font-normal ml-1">({c.partnerName})</span>
                          )}
                        </p>
                        <p className="text-xs text-violet-600 mt-0.5">
                          Together: <strong>{shareScopeLabel(c.features)}</strong>
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <Link to="/" className="text-xs text-brand-600 flex items-center gap-0.5 touch-manipulation">
                          Today <ArrowRight size={12} />
                        </Link>
                        {c.sharedSpaceId && (
                          <Link
                            to={`/chat/${c.sharedSpaceId}`}
                            className="text-xs text-violet-700 flex items-center gap-0.5 touch-manipulation font-medium"
                          >
                            <MessageCircle size={12} /> Chat
                          </Link>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        defaultValue={c.groupLabel || ''}
                        placeholder="Group tag"
                        onBlur={(e) => {
                          const next = e.target.value.trim();
                          if (next !== (c.groupLabel || '')) {
                            updateLabel.mutate({ id: c.id, groupLabel: next });
                          }
                        }}
                        className="flex-1 px-2 py-1 border rounded-lg text-xs"
                      />
                    </div>
                    <SharedFeatureLinks features={c.features} />
                  </div>
                ))}
              </div>
            </section>
          ))}

          {connections.length === 0 && pendingReceived.length === 0 && (
            <div className="text-center py-10 px-4 rounded-2xl border border-dashed bg-gray-50/50">
              <Users size={32} className="mx-auto text-gray-300 mb-3" />
              <p className="text-sm font-medium text-gray-600">No connections yet</p>
              <p className="text-xs text-gray-400 mt-1">Send an invite below — it feels just like your own app, shared with them.</p>
            </div>
          )}
        </div>
      )}

      <section className="bg-white rounded-2xl border shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={() => setInviteOpen((v) => !v)}
          className="w-full flex items-center justify-between gap-2 p-4 text-left touch-manipulation"
        >
          <h2 className="font-semibold flex items-center gap-2">
            <UserPlus size={18} className="text-brand-600" /> Invite someone
          </h2>
          {inviteOpen ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
        </button>

        {inviteOpen && (
          <div className="px-5 pb-5 space-y-4 border-t">
            <p className="text-xs text-gray-500 pt-3">
              Pick exactly what to share — tasks only, money, or everything. Notes &amp; Dreams are off by default.
            </p>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setBatchMode(false)}
            className={cn(
              'flex-1 py-2 rounded-lg text-sm font-medium border',
              !batchMode ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-600',
            )}
          >
            One person
          </button>
          <button
            type="button"
            onClick={() => setBatchMode(true)}
            className={cn(
              'flex-1 py-2 rounded-lg text-sm font-medium border',
              batchMode ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-600',
            )}
          >
            Several people
          </button>
        </div>

        <form onSubmit={handleInvite} className="space-y-3">
          {!batchMode ? (
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Search username</label>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''));
                    setSearchQuery(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''));
                  }}
                  placeholder="Type at least 2 letters…"
                  autoComplete="off"
                  className="w-full pl-9 pr-3 py-2.5 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand-500"
                  disabled={!cloudReady || sending}
                />
              </div>
              {debouncedSearch.length >= 2 && searchMatches.length > 0 && (
                <ul className="mt-2 border rounded-xl overflow-hidden divide-y bg-white shadow-sm">
                  {searchMatches.map((u) => (
                    <li key={u}>
                      <button
                        type="button"
                        onClick={() => {
                          setUsername(u);
                          setSearchQuery(u);
                        }}
                        className={cn(
                          'w-full text-left px-3 py-2.5 text-sm hover:bg-brand-50 flex items-center justify-between',
                          normalizeUsername(username) === u && 'bg-brand-50 text-brand-700 font-medium',
                        )}
                      >
                        @{u}
                        {normalizeUsername(username) === u && <Check size={14} />}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {debouncedSearch.length >= 2 && searchMatches.length === 0 && (
                <p className="text-xs text-gray-400 mt-2">No match — check spelling or ask them to sign up first.</p>
              )}
              {debouncedSearch.length > 0 && debouncedSearch.length < 2 && (
                <p className="text-xs text-gray-400 mt-2">Keep typing to search…</p>
              )}
            </div>
          ) : (
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">
                Usernames (one per line or comma-separated)
              </label>
              <textarea
                value={batchUsernames}
                onChange={(e) => setBatchUsernames(e.target.value)}
                placeholder={'maya\nraj\npriya'}
                rows={4}
                className="w-full px-3 py-2.5 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand-500 font-mono"
                disabled={!cloudReady || sending}
              />
              <p className="text-xs text-gray-400 mt-1">
                Same features for everyone · {parseUsernames(batchUsernames).length} valid username(s)
              </p>
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1 flex items-center gap-1">
              <Tag size={12} /> Group tag (optional)
            </label>
            <input
              value={groupLabel}
              onChange={(e) => setGroupLabel(e.target.value)}
              placeholder="e.g. Family, Work team"
              className="w-full px-3 py-2 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand-500"
              disabled={!cloudReady || sending}
            />
            <div className="flex flex-wrap gap-1.5 mt-2">
              {GROUP_SUGGESTIONS.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGroupLabel(g)}
                  className={cn(
                    'px-2.5 py-1 rounded-full text-xs border',
                    groupLabel === g ? 'bg-violet-100 border-violet-300 text-violet-800' : 'bg-gray-50 text-gray-600',
                  )}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">Quick presets</p>
            <div className="flex flex-wrap gap-2">
              {SHARE_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyPreset(preset.features)}
                  className="px-3 py-1.5 rounded-full text-xs border bg-white hover:bg-brand-50 hover:border-brand-200"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">
              What to share <span className="text-gray-400">({selected.size} selected)</span>
            </p>
            <p className="text-xs text-violet-800 bg-violet-50 border border-violet-100 rounded-lg px-2.5 py-2 mb-2">
              They will see: <strong>{shareScopeLabel(Array.from(selected))}</strong>
            </p>
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {SHARE_FEATURE_GROUPS.map((group) => (
                <div key={group.title} className="rounded-xl border p-2.5 bg-gray-50/80">
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.features)}
                    className="text-xs font-semibold text-gray-700 mb-2 hover:text-brand-700"
                  >
                    {group.title}
                  </button>
                  <div className="flex flex-wrap gap-1.5">
                    {group.features.map((feature) => {
                      const Icon = FEATURE_ICONS[feature];
                      const isOn = selected.has(feature);
                      return (
                        <button
                          key={feature}
                          type="button"
                          onClick={() => toggleFeature(feature)}
                          className={cn(
                            'inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs border',
                            isOn ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-600',
                          )}
                        >
                          <Icon size={12} /> {SHARE_FEATURE_LABELS[feature].title}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={!cloudReady || sending || selected.size === 0}
            className="w-full py-3.5 bg-brand-600 text-white rounded-xl text-sm font-semibold hover:bg-brand-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {sending ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {batchMode ? 'Send invites' : 'Send invite'}
          </button>
        </form>
          </div>
        )}
      </section>
    </div>
  );
}
