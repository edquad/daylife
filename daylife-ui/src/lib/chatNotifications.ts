import { getActiveAccountId } from './accounts';
import {
  fetchAccountAlertConfig,
  fetchAccountPushSubscription,
} from './sharing';
import { isGitHubConfigured, loadGitHubConfig } from './githubSync';
import { homeScreenPushEnabled } from './homeScreenPush';
const PUSH_RELAY_URL = (import.meta.env.VITE_PUSH_RELAY_URL || '').trim();
const NTFY_BASE = 'https://ntfy.sh';

const notifiedKey = (accountId: string) => `daylife_chat_notified_${accountId}`;

function appBaseUrl(): string {
  const base = import.meta.env.BASE_URL || '/';
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}${base}`.replace(/\/+$/, '/');
}

export function chatThreadUrl(spaceId: string): string {
  const base = import.meta.env.BASE_URL || '/';
  const path = `${base}${base.endsWith('/') ? '' : '/'}chat/${spaceId}`.replace(/\/+/g, '/');
  return new URL(path, appBaseUrl()).href;
}

function iconUrl(): string {
  return `${import.meta.env.BASE_URL || '/'}icon.svg`.replace(/\/+/g, '/');
}

function loadNotifiedMap(): Record<string, string> {
  const accountId = getActiveAccountId();
  if (!accountId) return {};
  try {
    const raw = localStorage.getItem(notifiedKey(accountId));
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function saveNotifiedMap(map: Record<string, string>): void {
  const accountId = getActiveAccountId();
  if (!accountId) return;
  localStorage.setItem(notifiedKey(accountId), JSON.stringify(map));
}

export function markChatMessageNotified(spaceId: string, messageId: string): void {
  const map = loadNotifiedMap();
  map[spaceId] = messageId;
  saveNotifiedMap(map);
}

export function wasChatMessageNotified(spaceId: string, messageId: string): boolean {
  return loadNotifiedMap()[spaceId] === messageId;
}

/** Short pleasant ping — works when app is open (WhatsApp-style alert). */
export function playChatSound(): void {
  if (typeof window === 'undefined') return;
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.22);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.24);
    osc.onended = () => void ctx.close();
  } catch {
    /* ignore — e.g. iOS silent mode */
  }
}

export function chatAlertsEnabled(): boolean {
  return (
    (homeScreenPushEnabled() || localStorage.getItem('daylife_notifications_enabled') === '1') &&
    typeof Notification !== 'undefined' &&
    Notification.permission === 'granted'
  );
}

export function showChatNotification(params: {
  spaceId: string;
  senderLabel: string;
  body: string;
  messageId: string;
  silent?: boolean;
}): void {
  if (!chatAlertsEnabled()) return;
  if (wasChatMessageNotified(params.spaceId, params.messageId)) return;

  const title = params.senderLabel;
  const body = params.body.slice(0, 240);
  const tag = `rozka-chat-${params.spaceId}`;
  const url = chatThreadUrl(params.spaceId);

  try {
    if (!params.silent) playChatSound();
    const notification = new Notification(title, {
      body,
      tag,
      icon: iconUrl(),
      silent: Boolean(params.silent),
      data: { url, spaceId: params.spaceId },
    } as NotificationOptions & { data?: { url: string; spaceId: string } });
    notification.onclick = () => {
      window.focus();
      window.location.assign(url);
      notification.close();
    };
    markChatMessageNotified(params.spaceId, params.messageId);
  } catch {
    /* blocked */
  }
}

async function postNtfyChat(
  topic: string,
  title: string,
  body: string,
  clickUrl: string,
  spaceId: string,
): Promise<void> {
  await fetch(`${NTFY_BASE}/${encodeURIComponent(topic)}`, {
    method: 'POST',
    headers: {
      Title: title.slice(0, 120),
      Priority: 'high',
      Tags: 'speech_balloon',
      Click: clickUrl,
      Actions: 'view, Open chat, ' + clickUrl,
    },
    body: body.slice(0, 500),
  }).catch(() => undefined);
}

async function postWebPushChat(
  subscription: PushSubscriptionJSON,
  title: string,
  body: string,
  clickUrl: string,
  spaceId: string,
): Promise<void> {
  if (!PUSH_RELAY_URL) return;
  await fetch(PUSH_RELAY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      subscription,
      title,
      body,
      url: clickUrl,
      tag: `rozka-chat-${spaceId}`,
    }),
  }).catch(() => undefined);
}

/** Push to partner when app may be closed (home screen / lock screen). */
export async function notifyChatMessagePush(params: {
  partnerAccountId: string;
  senderLabel: string;
  body: string;
  spaceId: string;
}): Promise<void> {
  if (!isGitHubConfigured(loadGitHubConfig())) return;

  const clickUrl = chatThreadUrl(params.spaceId);
  const title = params.senderLabel;
  const text = params.body.slice(0, 240);

  const [alert, subscription] = await Promise.all([
    fetchAccountAlertConfig(params.partnerAccountId),
    fetchAccountPushSubscription(params.partnerAccountId),
  ]);

  if (alert?.topic) {
    await postNtfyChat(alert.topic, title, text, clickUrl, params.spaceId);
  }
  if (subscription?.endpoint) {
    await postWebPushChat(subscription, title, text, clickUrl, params.spaceId);
  }
}