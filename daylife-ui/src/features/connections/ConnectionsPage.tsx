import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api, Connection } from '../../lib/api';
import { useAuth } from '../auth/AuthContext';
import { useGitHubSync } from '../sync/GitHubSyncContext';
import { toast } from '../../components/Toaster';
import { ApiError } from '../../lib/api';
import { UserPlus, Check, X, Users, RefreshCw, CheckSquare, Loader2 } from 'lucide-react';

const FEATURE_LABELS: Record<string, string> = {
  tasks: 'Tasks (shared column on Today)',
};

export function ConnectionsPage() {
  const { user } = useAuth();
  const { cloudReady } = useGitHubSync();
  const queryClient = useQueryClient();
  const [username, setUsername] = useState('');
  const [shareTasks, setShareTasks] = useState(true);

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
        features: shareTasks ? ['tasks'] : [],
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
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Connected — shared column is on your Today page');
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

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    if (!shareTasks) {
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
          Your data stays private. Invite another DayLife username and choose what to share together.
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
            <p className="text-xs text-gray-400 mt-1">They must already have a DayLife account.</p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">What to share</p>
            <label className="flex items-start gap-3 p-3 border rounded-xl cursor-pointer hover:bg-gray-50">
              <input
                type="checkbox"
                checked={shareTasks}
                onChange={(e) => setShareTasks(e.target.checked)}
                className="mt-1"
              />
              <div>
                <p className="text-sm font-medium flex items-center gap-1.5">
                  <CheckSquare size={14} className="text-brand-600" /> Tasks
                </p>
                <p className="text-xs text-gray-500">{FEATURE_LABELS.tasks}</p>
              </div>
            </label>
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
          {pendingReceived.length > 0 && (
            <section className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3">
              <h3 className="font-medium text-amber-900">Waiting for you</h3>
              {pendingReceived.map((c) => (
                <div key={c.id} className="bg-white rounded-xl border p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">@{c.partnerUsername}</p>
                    {c.partnerName && <p className="text-sm text-gray-500">{c.partnerName}</p>}
                    <p className="text-xs text-gray-400 mt-1">
                      Wants to share: {c.features.map((f) => FEATURE_LABELS[f] || f).join(', ')}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => accept.mutate(c.inviteId)}
                      disabled={accept.isPending}
                      className="flex items-center gap-1 px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                    >
                      <Check size={14} /> Accept
                    </button>
                    <button
                      type="button"
                      onClick={() => decline.mutate(c.inviteId)}
                      disabled={decline.isPending}
                      className="flex items-center gap-1 px-3 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                    >
                      <X size={14} /> Decline
                    </button>
                  </div>
                </div>
              ))}
            </section>
          )}

          {pendingSent.length > 0 && (
            <section className="bg-white border rounded-2xl p-4 space-y-3">
              <h3 className="font-medium text-gray-700">Sent — waiting for them</h3>
              {pendingSent.map((c) => (
                <div key={c.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="font-medium">@{c.partnerUsername}</p>
                    <p className="text-xs text-gray-400">
                      {c.features.map((f) => FEATURE_LABELS[f] || f).join(', ')}
                    </p>
                  </div>
                  <span className="text-xs px-2 py-1 bg-gray-100 rounded-full text-gray-500">Pending</span>
                </div>
              ))}
            </section>
          )}

          {active.length > 0 && (
            <section className="bg-white border rounded-2xl p-4 space-y-3">
              <h3 className="font-medium text-gray-700">Active</h3>
              {active.map((c) => (
                <div key={c.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="font-medium">@{c.partnerUsername}</p>
                    {c.partnerName && <p className="text-sm text-gray-500">{c.partnerName}</p>}
                    <p className="text-xs text-violet-600 mt-0.5">
                      Sharing: {c.features.map((f) => FEATURE_LABELS[f] || f).join(', ')}
                    </p>
                  </div>
                  <Link to="/" className="text-xs text-brand-600 hover:underline shrink-0">
                    View on Today →
                  </Link>
                </div>
              ))}
            </section>
          )}

          {connections.length === 0 && (
            <p className="text-center text-gray-400 text-sm py-8">
              No connections yet. Invite someone by their username above.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
