import { getActiveAccountId } from './accounts';

const API_BASE = (import.meta.env.VITE_GMAIL_API_URL || '').replace(/\/$/, '');

export interface GmailStatus {
  ok: boolean;
  connected: boolean;
  email?: string;
  lastRunAt?: string | null;
  draftsOnly?: boolean;
  humanOnly?: boolean;
  error?: string;
}

export interface GmailInboxMessage {
  id: string;
  threadId?: string;
  from: string;
  subject: string;
  date?: string;
  snippet: string;
  unread: boolean;
  humanLikely: boolean;
}

export interface GmailMessageDetail {
  id: string;
  threadId?: string;
  from: string;
  subject: string;
  date?: string;
  body: string;
  snippet: string;
  unread: boolean;
  humanLikely: boolean;
}

export interface GmailDraft {
  draftId: string;
  replyText: string;
  threadId?: string;
}

export interface GmailProcessResult {
  draftsCreated: number;
  results?: Array<{ messageId: string; subject: string; from: string; draftId?: string; replyText?: string }>;
  stats?: {
    scanned: number;
    skippedFilter: number;
    skippedNoReply: number;
    errors: number;
  };
}

function requireBase() {
  if (!API_BASE) {
    throw new Error('Gmail API not configured yet (VITE_GMAIL_API_URL)');
  }
}

function accountIdOrThrow() {
  const accountId = getActiveAccountId();
  if (!accountId) throw new Error('Sign in with a cloud account first');
  return accountId;
}

export function gmailApiConfigured(): boolean {
  return Boolean(API_BASE);
}

export async function fetchGmailStatus(): Promise<GmailStatus> {
  requireBase();
  const accountId = getActiveAccountId();
  if (!accountId) {
    return { ok: true, connected: false, error: 'Sign in with a cloud account first' };
  }
  const res = await fetch(
    `${API_BASE}/gmail/status?accountId=${encodeURIComponent(accountId)}`,
  );
  const data = (await res.json()) as GmailStatus;
  if (!res.ok) throw new Error(data.error || 'Could not load Gmail status');
  return data;
}

export async function fetchGmailInbox(): Promise<{ email: string; messages: GmailInboxMessage[] }> {
  requireBase();
  const accountId = accountIdOrThrow();
  const res = await fetch(
    `${API_BASE}/gmail/inbox?accountId=${encodeURIComponent(accountId)}`,
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Could not load inbox');
  return { email: data.email, messages: data.messages || [] };
}

export async function fetchGmailMessage(messageId: string): Promise<{ message: GmailMessageDetail; draft: GmailDraft | null }> {
  requireBase();
  const accountId = accountIdOrThrow();
  const res = await fetch(
    `${API_BASE}/gmail/message?accountId=${encodeURIComponent(accountId)}&messageId=${encodeURIComponent(messageId)}`,
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Could not load message');
  return { message: data.message, draft: data.draft || null };
}

export async function generateGmailDraftReply(messageId: string): Promise<GmailDraft> {
  requireBase();
  const accountId = accountIdOrThrow();
  const res = await fetch(`${API_BASE}/gmail/draft-reply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId, messageId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Could not generate draft');
  return data.draft;
}

export async function sendGmailReply(messageId: string, draftId: string, replyText: string): Promise<void> {
  requireBase();
  const accountId = accountIdOrThrow();
  const res = await fetch(`${API_BASE}/gmail/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId, messageId, draftId, replyText }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Could not send email');
}

export function startGmailConnect(): void {
  requireBase();
  const accountId = accountIdOrThrow();
  const returnUrl = '/daylife/settings?gmail=connected';
  const url = `${API_BASE}/gmail/auth/start?accountId=${encodeURIComponent(accountId)}&returnUrl=${encodeURIComponent(returnUrl)}`;
  window.location.href = url;
}

export async function disconnectGmail(): Promise<void> {
  requireBase();
  const accountId = accountIdOrThrow();
  const res = await fetch(`${API_BASE}/gmail/disconnect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Disconnect failed');
}

export async function runGmailDraftCheck(options?: { force?: boolean }): Promise<GmailProcessResult> {
  requireBase();
  const accountId = accountIdOrThrow();
  const res = await fetch(`${API_BASE}/gmail/process`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId, force: Boolean(options?.force) }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Check failed');
  return {
    draftsCreated: data.draftsCreated || 0,
    results: data.results,
    stats: data.stats,
  };
}
