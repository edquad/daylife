import React, { useState } from 'react';
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
} from 'lucide-react';

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

export function ConnectionsPage() {
  const { user } = useAuth();
  const { cloudReady } = useGitHubSync();
  const queryClient = useQueryClient();
  const [username, setUsername] = useState('');
  const [selected, setSelected] = useState<Set<ShareFeature>>(
    () => new Set(['tasks', 'expenses', 'splits', 'shopping', 'vision']),
  );

  const { data: connections = [], isLoading, refetch } = useQuery<Connection[]>({
    queryKey: ['connections'],
    queryFn: async () => {
      await api.post('/connections/sync-inbox');
      return api.get('/connections');
    },
    enabled: cloudReady,
  });

  const invite = useMutation({
    mutationFn: () =>
      api.post<Connection>('/connections/invite', {
        username: username.trim(),
        features: Array.from(selected),
      }),
    onSuccess: () => {
      setUsername('');
      queryClient.invalidateQueries({ queryKey: ['connections'] });
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
      toast.success('Connected — shared features are ready');
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

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    if (selected.size === 0) {
      toast.error('Pick at least one thing to share');
      return;
    }
    invite.mutate();
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
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. jagat"
                className="flex-1 px-3 py-2.5 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand-500"
                disabled={!cloudReady || invite.isPending}
              />
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">What to share</p>
            <div className="space-y-4">
              {SHARE_FEATURE_GROUPS.map((group) => (
                <div key={group.title}>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-2">{group.title}</p>
                  <div className="space-y-2">
                    {group.features.map((feature) => {
                      const Icon = FEATURE_ICONS[feature];
                      const meta = SHARE_FEATURE_LABELS[feature];
                      return (
                        <label
                          key={feature}
                          className="flex items-start gap-3 p-3 border rounded-xl cursor-pointer hover:bg-gray-50"
                        >
                          <input
                            type="checkbox"
                            checked={selected.has(feature)}
                            onChange={() => toggleFeature(feature)}
                            className="mt-1"
                          />
                          <div>
                            <p className="text-sm font-medium flex items-center gap-1.5">
                              <Icon size={14} className="text-brand-600" /> {meta.title}
                            </p>
                            <p className="text-xs text-gray-500">{meta.description}</p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <button
            type="submit"
            disabled={!cloudReady || !username.trim() || invite.isPending}
            className="w-full py-2.5 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {invite.isPending ? <Loader2 size={16} className="animate-spin" /> : null}
            Send invite
          </button>
        </form>
      </section>

      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Your connections</h2>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={!cloudReady || isLoading}
          className="text-xs text-brand-600 hover:underline flex items-center gap-1"
        >
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-gray-400 text-sm">Loading…</div>
      ) : (
        <div className="space-y-4">
          {pendingReceived.map((c) => (
            <section key={c.id} className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3">
              <h3 className="font-medium text-amber-900">Waiting for you — @{c.partnerUsername}</h3>
              <p className="text-xs text-gray-500">{featureSummary(c.features)}</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => accept.mutate(c.inviteId)}
                  disabled={accept.isPending}
                  className="flex items-center gap-1 px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-medium"
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
                <div key={c.id} className="flex justify-between gap-2 text-sm">
                  <div>
                    <span className="font-medium">@{c.partnerUsername}</span>
                    <p className="text-xs text-violet-600">{featureSummary(c.features)}</p>
                  </div>
                  <Link to="/" className="text-xs text-brand-600 hover:underline shrink-0">Open Today →</Link>
                </div>
              ))}
            </section>
          )}

          {connections.length === 0 && (
            <p className="text-center text-gray-400 text-sm py-8">No connections yet.</p>
          )}
        </div>
      )}
    </div>
  );
}
