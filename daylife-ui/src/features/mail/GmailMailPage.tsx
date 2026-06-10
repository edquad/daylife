import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Mail, Loader2, Sparkles, Inbox, ArrowLeft, Send } from 'lucide-react';
import {
  fetchGmailInbox,
  fetchGmailMessage,
  fetchGmailStatus,
  generateGmailDraftReply,
  gmailApiConfigured,
  runGmailDraftCheck,
  sendGmailReply,
  startGmailConnect,
  type GmailInboxMessage,
} from '../../lib/gmailConnect';
import { toast } from '../../components/Toaster';

export function GmailMailPage({ embedded }: { embedded?: boolean } = {}) {
  const queryClient = useQueryClient();
  const configured = gmailApiConfigured();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [draftId, setDraftId] = useState<string | null>(null);

  const statusQuery = useQuery({
    queryKey: ['gmail-status'],
    queryFn: fetchGmailStatus,
    enabled: configured,
  });

  const inboxQuery = useQuery({
    queryKey: ['gmail-inbox'],
    queryFn: fetchGmailInbox,
    enabled: configured && Boolean(statusQuery.data?.connected),
  });

  const messageQuery = useQuery({
    queryKey: ['gmail-message', selectedId],
    queryFn: () => fetchGmailMessage(selectedId!),
    enabled: Boolean(selectedId),
  });

  useEffect(() => {
    const draft = messageQuery.data?.draft;
    if (draft?.replyText) {
      setReplyText(draft.replyText);
      setDraftId(draft.draftId);
    } else {
      setReplyText('');
      setDraftId(null);
    }
  }, [messageQuery.data?.draft, selectedId]);

  const checkNow = useMutation({
    mutationFn: () => runGmailDraftCheck({ force: true }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['gmail-status'] });
      queryClient.invalidateQueries({ queryKey: ['gmail-inbox'] });
      if (res.draftsCreated > 0) {
        toast.success(`${res.draftsCreated} AI draft${res.draftsCreated === 1 ? '' : 's'} ready in Mail`);
      } else if (res.stats?.scanned) {
        toast.success(`Checked ${res.stats.scanned} messages — no new drafts needed`);
      } else {
        toast.success('No new human emails to draft');
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const generateDraft = useMutation({
    mutationFn: (messageId: string) => generateGmailDraftReply(messageId),
    onSuccess: (draft) => {
      setDraftId(draft.draftId);
      setReplyText(draft.replyText);
      queryClient.invalidateQueries({ queryKey: ['gmail-message', selectedId] });
      toast.success('AI draft ready — edit and send when you want');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const sendReply = useMutation({
    mutationFn: () => sendGmailReply(selectedId!, draftId!, replyText),
    onSuccess: () => {
      toast.success('Email sent');
      setSelectedId(null);
      setDraftId(null);
      setReplyText('');
      queryClient.invalidateQueries({ queryKey: ['gmail-inbox'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (!configured) {
    return (
      <div className="p-4 max-w-2xl">
        <h1 className="text-2xl font-bold mb-2">Mail</h1>
        <p className="text-gray-600 text-sm">Gmail API not configured on this build yet.</p>
      </div>
    );
  }

  if (!statusQuery.data?.connected) {
    return (
      <div className="p-4 max-w-2xl space-y-4">
        <h1 className="text-2xl font-bold">Mail</h1>
        <p className="text-gray-600 text-sm">Connect Gmail to read inbox, see AI drafts, and send replies from Rozka.</p>
        <button
          type="button"
          onClick={() => startGmailConnect()}
          className="rounded-xl bg-teal-700 text-white px-4 py-3 text-sm font-medium"
        >
          Connect my Gmail
        </button>
        <p className="text-xs text-gray-500">
          Or go to <Link to="/settings" className="underline">Settings</Link>
        </p>
      </div>
    );
  }

  if (selectedId) {
    const msg = messageQuery.data?.message;
    const loading = messageQuery.isLoading;

    return (
      <div className="p-4 lg:p-6 max-w-2xl space-y-4">
        <button
          type="button"
          onClick={() => setSelectedId(null)}
          className="inline-flex items-center gap-2 text-sm text-teal-700 font-medium"
        >
          <ArrowLeft size={16} /> Back to inbox
        </button>

        {loading || !msg ? (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin text-gray-400" />
          </div>
        ) : (
          <>
            <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-2">
              <p className="text-sm font-medium">{msg.from}</p>
              <p className="text-lg font-semibold">{msg.subject}</p>
              {msg.date ? <p className="text-xs text-gray-500">{msg.date}</p> : null}
              <div className="text-sm text-gray-800 whitespace-pre-wrap pt-2 border-t border-gray-100 mt-2">
                {msg.body || msg.snippet}
              </div>
            </div>

            <section className="rounded-xl border border-teal-100 bg-teal-50/40 p-4 space-y-3">
              <h2 className="font-semibold text-sm text-gray-800 flex items-center gap-2">
                <Sparkles size={16} className="text-teal-700" />
                AI reply draft
              </h2>
              <p className="text-xs text-gray-600">Edit below. Nothing sends until you tap Send.</p>

              {!draftId ? (
                <button
                  type="button"
                  onClick={() => generateDraft.mutate(selectedId)}
                  disabled={generateDraft.isPending}
                  className="inline-flex items-center gap-2 rounded-xl bg-teal-700 text-white px-4 py-2 text-sm font-medium disabled:opacity-60"
                >
                  {generateDraft.isPending ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                  Generate AI draft
                </button>
              ) : (
                <>
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    rows={6}
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                    placeholder="AI draft will appear here…"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => sendReply.mutate()}
                      disabled={sendReply.isPending || !replyText.trim()}
                      className="inline-flex items-center gap-2 rounded-xl bg-teal-700 text-white px-4 py-2 text-sm font-medium disabled:opacity-60"
                    >
                      {sendReply.isPending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                      Send from Rozka
                    </button>
                    <button
                      type="button"
                      onClick={() => generateDraft.mutate(selectedId)}
                      disabled={generateDraft.isPending}
                      className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700"
                    >
                      Regenerate draft
                    </button>
                  </div>
                </>
              )}
            </section>
          </>
        )}
      </div>
    );
  }

  const messages = inboxQuery.data?.messages || [];

  return (
    <div className="p-4 lg:p-6 max-w-2xl space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Mail size={24} className="text-teal-700" />
            Mail
          </h1>
          <p className="text-sm text-gray-500 mt-1">{statusQuery.data.email}</p>
        </div>
        <button
          type="button"
          onClick={() => checkNow.mutate()}
          disabled={checkNow.isPending}
          className="inline-flex items-center gap-2 rounded-xl bg-teal-700 text-white px-4 py-2 text-sm font-medium disabled:opacity-60"
        >
          {checkNow.isPending ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          Scan inbox
        </button>
      </div>

      <div className="rounded-xl bg-teal-50 border border-teal-100 px-3 py-2 text-xs text-teal-900">
        Tap an email to read it, see the AI draft in Rozka, edit, and send manually — no auto-send.
      </div>

      <section className="space-y-2">
        <h2 className="font-semibold text-sm text-gray-700 flex items-center gap-2">
          <Inbox size={16} /> Inbox
        </h2>
        {inboxQuery.isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="animate-spin text-gray-400" />
          </div>
        ) : messages.length === 0 ? (
          <p className="text-sm text-gray-500">No recent inbox messages.</p>
        ) : (
          <ul className="space-y-2">
            {messages.map((m: GmailInboxMessage) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(m.id)}
                  className={`w-full text-left rounded-xl border p-3 transition-colors hover:border-teal-200 ${m.unread ? 'bg-white border-teal-100' : 'bg-gray-50 border-gray-100'}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium truncate">{m.from}</p>
                    {m.unread ? (
                      <span className="text-[10px] uppercase tracking-wide text-teal-700 font-semibold shrink-0">Unread</span>
                    ) : null}
                  </div>
                  <p className="text-sm text-gray-800 truncate">{m.subject}</p>
                  <p className="text-xs text-gray-500 line-clamp-2 mt-1">{m.snippet}</p>
                  {m.humanLikely ? (
                    <span className="inline-block mt-2 text-[10px] bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded-full">
                      Human message
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
