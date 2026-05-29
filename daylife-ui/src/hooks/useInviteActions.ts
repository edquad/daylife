import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, Connection, ApiError } from '../lib/api';
import { toast } from '../components/Toaster';
import { notifyInviteAccepted } from '../lib/pendingNotifications';

function invalidateShareQueries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['connections'] });
  queryClient.invalidateQueries({ queryKey: ['shared-summary'] });
  queryClient.invalidateQueries({ queryKey: ['shared-expenses'] });
  queryClient.invalidateQueries({ queryKey: ['shared-shopping'] });
  queryClient.invalidateQueries({ queryKey: ['dashboard'] });
}

export function useInviteActions() {
  const queryClient = useQueryClient();
  const [actingInviteId, setActingInviteId] = useState<string | null>(null);

  const accept = useMutation({
    mutationFn: (inviteId: string) => api.post<Connection>(`/connections/${inviteId}/accept`),
    onMutate: async (inviteId) => {
      setActingInviteId(inviteId);
      await queryClient.cancelQueries({ queryKey: ['connections'] });
      const prev = queryClient.getQueryData<Connection[]>(['connections']);
      queryClient.setQueryData<Connection[]>(['connections'], (old) =>
        old?.filter((c) => c.inviteId !== inviteId),
      );
      return { prev };
    },
    onSuccess: () => {
      invalidateShareQueries(queryClient);
      toast.success('Connected! You can now share tasks and lists.');
    },
    onError: (err: unknown, _id, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['connections'], ctx.prev);
      toast.error(err instanceof ApiError ? err.message : (err as Error).message);
    },
    onSettled: () => setActingInviteId(null),
  });

  const decline = useMutation({
    mutationFn: (inviteId: string) => api.post<Connection>(`/connections/${inviteId}/decline`),
    onMutate: async (inviteId) => {
      setActingInviteId(inviteId);
      await queryClient.cancelQueries({ queryKey: ['connections'] });
      const prev = queryClient.getQueryData<Connection[]>(['connections']);
      queryClient.setQueryData<Connection[]>(['connections'], (old) =>
        old?.filter((c) => c.inviteId !== inviteId),
      );
      return { prev };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connections'] });
      toast.success('Invite declined');
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['connections'], ctx.prev);
    },
    onSettled: () => setActingInviteId(null),
  });

  const cancel = useMutation({
    mutationFn: (inviteId: string) => api.post<Connection>(`/connections/${inviteId}/cancel`),
    onMutate: async (inviteId) => {
      setActingInviteId(inviteId);
      await queryClient.cancelQueries({ queryKey: ['connections'] });
      const prev = queryClient.getQueryData<Connection[]>(['connections']);
      queryClient.setQueryData<Connection[]>(['connections'], (old) =>
        old?.filter((c) => c.inviteId !== inviteId),
      );
      return { prev };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connections'] });
      toast.success('Invite cancelled');
    },
    onError: (err: unknown, _id, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['connections'], ctx.prev);
      toast.error(err instanceof ApiError ? err.message : (err as Error).message);
    },
    onSettled: () => setActingInviteId(null),
  });

  return { accept, decline, cancel, actingInviteId };
}

export function useInviteAcceptedNotifier(connections: Connection[]) {
  const queryClient = useQueryClient();
  const statusByInvite = useRef(new Map<string, string>());

  useEffect(() => {
    for (const conn of connections) {
      if (!conn.initiatedByMe) continue;
      const prev = statusByInvite.current.get(conn.inviteId);
      if (prev === 'pending_sent' && conn.status === 'active') {
        notifyInviteAccepted(conn.partnerUsername);
        toast.success(`@${conn.partnerUsername} accepted your invite!`);
        invalidateShareQueries(queryClient);
      }
      statusByInvite.current.set(conn.inviteId, conn.status);
    }
  }, [connections, queryClient]);
}
