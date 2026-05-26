import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  api,
  Connection,
  ShareFeature,
  SHARE_FEATURE_GROUPS,
  SHARE_FEATURE_LABELS,
} from '../../lib/api';
import { useAuth } from '../auth/AuthContext';
import { useGitHubSync } from '../sync/GitHubSyncContext';
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
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { normalizeUsername } from '../../lib/accounts';
import { SharedFeatureLinks } from '../../components/SharedFeatureLinks';

const FEATURE_ICONS: Record<ShareFeature, typeof CheckSquare> = {
  tasks: CheckSquare,
  expenses: Receipt,
  splits: HandCoins,
  shopping: ShoppingCart,
  notes: StickyNote,
  reminders: Bell,
  routines: Sun,
  vision: Star,
};

function featureSummary(features: ShareFeature[]): string {
  return features.map((f) => SHARE_FEATURE_LABELS[f]?.title || f).join(', ');
}

function groupSelectionState(features: ShareFeature[], selected: Set<ShareFeature>): 'all' | 'some' | 'none' {
  const on = features.filter((f) => selected.has(f)).length;
  if (on === 0) return 'none';
  if (on === features.length) return 'all';
  return 'some';
}

export function ConnectionsPage() {
  const { user } = useAuth();
  const { cloudReady, pullFromGitHub } = useGitHubSync();
  const queryClient = useQueryClient();
  const [username, setUsername] = useState('');
  const [selected, setSelected] = useState<Set<ShareFeature>>(
    () => new Set(['tasks', 'expenses', 'splits', 'shopping', 'reminders', 'routines', 'vision']),
  );
  const [refreshing, setRefreshing] = useState(false);

  const { data: connections = [], isLoading, refetch } = useQuery<Connection[]>({
    queryKey: ['connections'],
    queryFn: async () => {
      await api.post('/connections/sync-inbox');
      return api.get('/connections');
    },
    enabled: cloudReady,
  });

  const { data: usernameList } = useQuery<{ usernames: string[] }>({
    queryKey: ['account-usernames'],
    queryFn: () => api.get('/accounts/usernames'),
    enabled: cloudReady,
  });

  const availableUsernames = usernameList?.usernames ?? [];

  const filteredUsernames = useMemo(() => {
    const q = normalizeUsername(username);
    if (!q) return availableUsernames;
    return availableUsernames.filter((u) => u.includes(q));
  }, [availableUsernames, username]);

  const invite = useMutation({
    mutationFn: () =>
      api.post<Connection>('/connections/invite', {
        username: username.trim(),
        features: Array.from(selected),
      }),
    onSuccess: () => {
      setUsername('');
      queryClient.invalidateQueries({ queryKey: ['connections'] });
      queryClient.invalidateQueries({ queryKey: ['account-usernames'] });
      toast.success('Invite sent — they can accept from Share page');
    },
    onError: (err: unknown) => {
      const msg = err instanceof ApiError ? err.message : (err as Error).message;
      toast.error(msg);
    },
  });

  const accept = useMutation({
    mutationFn: (inviteId: string) => api.post<Connection>(`/connections/${inviteId}/accept`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connections'] });
      queryClient.invalidateQueries({ queryKey: ['shared-summary'] });
      queryClient.invalidateQueries({ queryKey: ['shared-expenses'] });
      queryClient.invalidateQueries({ queryKey: ['shared-shopping'] });
      queryClient.invalidateQueries({ queryKey: ['shared-reminders'] });
      queryClient.invalidateQueries({ queryKey: ['shared-routines'] });
      queryClient.invalidateQueries({ queryKey: ['shared-splits'] });
      queryClient.invalidateQueries({ queryKey: ['shared-vision'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Connected! Open the links below to see shared lists.');
    },
    onError: (err: unknown) => {
      const msg = err instanceof ApiError ? err.message : (err as Error).message;
      toast.error(msg);
    },
  });

  const decline = useMutation({
    mutationFn: (inviteId: string) => api.post<Connection>(`/connections/${inviteId}/decline`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connections'] });
      toast.success('Invite declined');
    },
    onError: (err: unknown) => {
      const msg = err instanceof ApiError ? err.message : (err as Error).message;
      toast.error(msg);
    },
  });

  const pendingReceived = connections.filter((c) => c.status === 'pending_received');
  const pendingSent = connections.filter((c) => c.status === 'pending_sent');
  const active = connections.filter((c) => c.status === 'active');

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

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    if (selected.size === 0) {
      toast.error('Pick at least one thing to share');
      return;
    }
    invite.mutate();
  };

  const handleRefresh = async () => {
    if (!cloudReady) return;
    setRefreshing(true);
    try {
      await pullFromGitHub();
      await refetch();
      toast.success('Refreshed from cloud');
    } catch {
      toast.error('Could not refresh — check your connection');
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Users size={24} className="text-brand-600" /> Share with someone
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Pick what to share: tasks, money, daily life, vision board — your private stuff stays private.
        </p>
        {user?.username && (
          <p className="text-xs text-gray-400 mt-2">
            You are signed in as <span className="font-medium text-gray-600">@{user.username}</span>
          </p>
        )}
      </div>

      {!cloudReady && (
        <div className="px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
          Cloud sync is required to invite others. Check Settings or try again after the app loads.
        </div>
      )}

      <section className="bg-gradient-to-br from-brand-50 to-violet-50 border border-brand-100 rounded-2xl p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-700 mb-3">How sharing works</p>
        <ol className="space-y-3">
          {[
            { step: '1', title: 'Pick their username', detail: 'Tap a name from the list — they must have signed up already' },
            { step: '2', title: 'Pick what to share', detail: 'Tasks, expenses, shopping — only what you choose' },
            { step: '3', title: 'They tap Accept', detail: 'Shared sections appear on Today and other pages' },
          ].map((item) => (
            <li key={item.step} className="flex gap-3 items-start">
              <span className="w-7 h-7 rounded-full bg-white border border-brand-200 flex items-center justify-center text-xs font-bold text-brand-700 shrink-0">
                {item.step}
              </span>
              <div>
                <p className="text-sm font-medium text-gray-900">{item.title}</p>
                <p className="text-xs text-gray-600">{item.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="bg-white rounded-2xl border shadow-sm p-5 space-y-4">
        <h2 className="font-semibold flex items-center gap-2">
          <UserPlus size={18} className="text-brand-600" /> Send invite
        </h2>
        <form onSubmit={handleInvite} className="space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Their username</label>
            <div className="flex gap-2">
              <span className="flex items-center px-3 border rounded-xl bg-gray-50 text-gray-400 text-sm">@</span>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                placeholder="Pick below or type username"
                list="daylife-usernames"
                autoComplete="off"
                className="flex-1 px-3 py-2.5 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand-500"
                disabled={!cloudReady || invite.isPending}
              />
            </div>
            <datalist id="daylife-usernames">
              {availableUsernames.map((u) => (
                <option key={u} value={u} />
              ))}
            </datalist>
            {cloudReady && (
              <div className="mt-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-2">
                  People on DayLife
                </p>
                {availableUsernames.length === 0 ? (
                  <p className="text-xs text-gray-400">
                    No other accounts yet — they need to sign up first, then refresh this page.
                  </p>
                ) : filteredUsernames.length === 0 ? (
                  <p className="text-xs text-gray-400">No match — check spelling or ask them to sign up.</p>
                ) : (
                  <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                    {filteredUsernames.map((u) => {
                      const picked = normalizeUsername(username) === u;
                      return (
                        <button
                          key={u}
                          type="button"
                          onClick={() => setUsername(u)}
                          className={cn(
                            'px-3 py-1.5 rounded-full text-sm border touch-manipulation transition-colors',
                            picked
                              ? 'bg-brand-600 text-white border-brand-600'
                              : 'bg-white text-gray-700 border-gray-200 hover:border-brand-300 hover:bg-brand-50',
                          )}
                        >
                          @{u}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">What to share</p>
            <div className="space-y-3">
              {SHARE_FEATURE_GROUPS.map((group) => {
                const groupState = groupSelectionState(group.features, selected);
                return (
                  <div
                    key={group.title}
                    className={cn(
                      'rounded-2xl border-2 p-3 transition-colors',
                      groupState !== 'none' ? 'border-brand-200 bg-brand-50/40' : 'border-gray-200 bg-gray-50/50',
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.features)}
                      className="w-full flex items-center gap-3 mb-3 text-left touch-manipulation"
                    >
                      <div
                        className={cn(
                          'w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors',
                          groupState === 'all'
                            ? 'bg-brand-600 border-brand-600 text-white'
                            : groupState === 'some'
                              ? 'bg-brand-100 border-brand-500 text-brand-700'
                              : 'border-gray-300 bg-white',
                        )}
                      >
                        {groupState === 'all' ? (
                          <Check size={12} strokeWidth={3} />
                        ) : groupState === 'some' ? (
                          <span className="w-2 h-0.5 bg-brand-600 rounded-full" />
                        ) : null}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900">{group.title}</p>
                        <p className="text-[11px] text-gray-500">
                          {groupState === 'all'
                            ? 'All selected — tap to clear group'
                            : groupState === 'some'
                              ? 'Some selected — tap to select all'
                              : 'Tap to select whole group'}
                        </p>
                      </div>
                    </button>
                    <div className="grid sm:grid-cols-2 gap-2 pl-1">
                      {group.features.map((feature) => {
                        const Icon = FEATURE_ICONS[feature];
                        const meta = SHARE_FEATURE_LABELS[feature];
                        const isOn = selected.has(feature);
                        return (
                          <label
                            key={feature}
                            className={cn(
                              'flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer touch-manipulation',
                              isOn ? 'bg-white border-brand-300 shadow-sm' : 'bg-white/60 border-gray-200 hover:border-gray-300',
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={isOn}
                              onChange={() => toggleFeature(feature)}
                              className="mt-0.5 shrink-0 accent-brand-600"
                            />
                            <div className="min-w-0">
                              <p className="text-sm font-medium flex items-center gap-1.5">
                                <Icon size={14} className="text-brand-600 shrink-0" /> {meta.title}
                              </p>
                              <p className="text-[11px] text-gray-500 leading-snug">{meta.description}</p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <p className="text-xs text-gray-500">
            {selected.size} feature{selected.size !== 1 ? 's' : ''} selected — use group header or individual checkboxes
          </p>
          <button
            type="submit"
            disabled={!cloudReady || !username.trim() || invite.isPending}
            className="w-full py-3.5 bg-brand-600 text-white rounded-xl text-sm font-semibold hover:bg-brand-700 disabled:opacity-50 flex items-center justify-center gap-2 touch-manipulation active:scale-[0.99]"
          >
            {invite.isPending ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            Send invite
          </button>
        </form>
      </section>

      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Your connections</h2>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={!cloudReady || isLoading || refreshing}
          className="text-xs text-brand-600 hover:underline flex items-center gap-1 touch-manipulation"
        >
          <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} /> Refresh from cloud
        </button>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-gray-400 text-sm">Loading…</div>
      ) : (
        <div className="space-y-4">
          {pendingReceived.map((c) => (
            <section key={c.id} className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3">
              <h3 className="font-medium text-amber-900">@{c.partnerUsername} wants to share with you</h3>
              <p className="text-xs text-gray-600">{featureSummary(c.features)}</p>
              <SharedFeatureLinks features={c.features} />
              <p className="text-xs text-amber-800">Tap Accept — then open the pages above for shared shopping, routines, etc.</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => accept.mutate(c.inviteId)}
                  disabled={accept.isPending}
                  className="flex items-center gap-1 px-4 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium touch-manipulation"
                >
                  <Check size={14} /> Accept
                </button>
                <button
                  type="button"
                  onClick={() => decline.mutate(c.inviteId)}
                  disabled={decline.isPending}
                  className="flex items-center gap-1 px-3 py-2 border rounded-lg text-sm"
                >
                  <X size={14} /> Decline
                </button>
              </div>
            </section>
          ))}

          {pendingSent.length > 0 && (
            <section className="bg-white border rounded-2xl p-4 space-y-2">
              <h3 className="font-medium">Sent — waiting for them</h3>
              {pendingSent.map((c) => (
                <div key={c.id} className="text-sm">
                  <span className="font-medium">@{c.partnerUsername}</span>
                  <span className="text-gray-400 ml-2">{featureSummary(c.features)}</span>
                </div>
              ))}
            </section>
          )}

          {active.length > 0 && (
            <section className="bg-white border rounded-2xl p-4 space-y-2">
              <h3 className="font-medium">Active</h3>
              {active.map((c) => (
                <div key={c.id} className="py-3 border-b last:border-0 space-y-2">
                  <div className="flex justify-between gap-2 text-sm">
                    <div>
                      <span className="font-medium">@{c.partnerUsername}</span>
                      <p className="text-xs text-violet-600 mt-0.5">{featureSummary(c.features)}</p>
                    </div>
                    <Link to="/" className="text-xs text-brand-600 hover:underline shrink-0 flex items-center gap-0.5">
                      Open Today <ArrowRight size={12} />
                    </Link>
                  </div>
                  <SharedFeatureLinks features={c.features} />
                </div>
              ))}
            </section>
          )}

          {connections.length === 0 && (
            <div className="text-center py-10 px-4 rounded-2xl border border-dashed border-gray-200 bg-gray-50/50">
              <Users size={32} className="mx-auto text-gray-300 mb-3" />
              <p className="text-sm font-medium text-gray-600">No connections yet</p>
              <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto">
                Send an invite above — when they accept, shared lists show up on Today.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
