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

function requireBase() {
  if (!API_BASE) {
    throw new Error('Gmail API not configured yet (VITE_GMAIL_API_URL)');
  }
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

export function startGmailConnect(): void {
  requireBase();
  const accountId = getActiveAccountId();
  if (!accountId) throw new Error('Sign in with a cloud account first');
  const returnUrl = '/daylife/settings?gmail=connected';
  const url = `${API_BASE}/gmail/auth/start?accountId=${encodeURIComponent(accountId)}&returnUrl=${encodeURIComponent(returnUrl)}`;
  window.location.href = url;
}

export async function disconnectGmail(): Promise<void> {
  requireBase();
  const accountId = getActiveAccountId();
  if (!accountId) throw new Error('Not signed in');
  const res = await fetch(`${API_BASE}/gmail/disconnect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Disconnect failed');
}

export async function runGmailDraftCheck(): Promise<{ draftsCreated: number }> {
  requireBase();
  const accountId = getActiveAccountId();
  if (!accountId) throw new Error('Not signed in');
  const res = await fetch(`${API_BASE}/gmail/process`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Check failed');
  return { draftsCreated: data.draftsCreated || 0 };
}
