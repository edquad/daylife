import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Mail, Loader2, Unplug, Sparkles } from 'lucide-react';
import { getActiveAccountId } from '../lib/accounts';
import {
  disconnectGmail,
  fetchGmailStatus,
  gmailApiConfigured,
  runGmailDraftCheck,
  startGmailConnect,
} from '../lib/gmailConnect';
import { toast } from './Toaster';

export function GmailConnectCard() {
  const queryClient = useQueryClient();
  const accountId = getActiveAccountId();
  const configured = gmailApiConfigured();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['gmail-status', accountId],
    queryFn: fetchGmailStatus,
    enabled: configured && Boolean(accountId),
  });

  const disconnect = useMutation({
    mutationFn: disconnectGmail,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gmail-status'] });
      toast.success('Gmail disconnected');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const checkNow = useMutation({
    mutationFn: runGmailDraftCheck,
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['gmail-status'] });
      if (res.draftsCreated > 0) {
        toast.success(`${res.draftsCreated} draft${res.draftsCreated === 1 ? '' : 's'} created in Gmail`);
      } else {
        toast.success('No new human emails needed a draft');
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (!configured) {
    return (
      <section className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 space-y-2">
        <div className="flex items-center gap-2 text-amber-900 font-semibold">
          <Mail size={18} />
          Gmail AI drafts
        </div>
        <p className="text-sm text-amber-900/80">
          Coming soon on this build — backend URL not configured yet.
        </p>
      </section>
    );
  }

  if (!accountId) {
    return (
      <section className="rounded-2xl border border-gray-200 bg-white p-4 space-y-2">
        <div className="flex items-center gap-2 font-semibold text-gray-900">
          <Mail size={18} />
          Gmail AI drafts
        </div>
        <p className="text-sm text-gray-600">
          Sign in with your Rozka username (cloud account) to connect your own Gmail.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 font-semibold text-gray-900">
            <Mail size={18} />
            Gmail AI drafts
          </div>
          <p className="text-sm text-gray-600 mt-1">
            Connect <strong>your</strong> Gmail. Rozka creates reply <strong>drafts only</strong> for real human messages — you send when ready.
          </p>
        </div>
        {isLoading ? <Loader2 size={18} className="animate-spin text-gray-400" /> : null}
      </div>

      <ul className="text-xs text-gray-500 space-y-1 list-disc pl-4">
        <li>Skips newsletters, noreply, receipts, and bots</li>
        <li>Never sends email automatically</li>
        <li>Each user connects their own Gmail account</li>
      </ul>

      {data?.connected ? (
        <div className="space-y-3">
          <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2 text-sm text-emerald-900">
            Connected: <span className="font-medium">{data.email}</span>
            {data.lastRunAt ? (
              <span className="block text-xs text-emerald-800/80 mt-1">
                Last check: {new Date(data.lastRunAt).toLocaleString()}
              </span>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => checkNow.mutate()}
              disabled={checkNow.isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-teal-700 text-white px-4 py-2 text-sm font-medium disabled:opacity-60"
            >
              {checkNow.isPending ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              Check inbox now
            </button>
            <button
              type="button"
              onClick={() => disconnect.mutate()}
              disabled={disconnect.isPending}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm text-gray-700"
            >
              <Unplug size={16} />
              Disconnect
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            try {
              startGmailConnect();
            } catch (err) {
              toast.error(err instanceof Error ? err.message : 'Could not start Gmail setup');
            }
          }}
          className="w-full rounded-xl bg-teal-700 text-white px-4 py-3 text-sm font-medium"
        >
          Connect my Gmail
        </button>
      )}

      <button type="button" onClick={() => refetch()} className="text-xs text-gray-400 underline">
        Refresh status
      </button>
    </section>
  );
}
