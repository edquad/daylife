import { uid } from './storage';
import { APP_NAME } from './brand';
import { getActiveAccountId } from './accounts';
import {
  fetchAccountAlertConfig,
  fetchAccountPushSubscription,
  saveAccountAlertConfig,
  saveAccountPushSubscription,
  SHARE_FEATURE_PAGES,
  type ShareFeature,
} from './sharing';
import { loadGitHubConfig, isGitHubConfigured } from './githubSync';

const VAPID_PUBLIC_KEY =
  import.meta.env.VITE_VAPID_PUBLIC_KEY ||
  'BET8I04xeWID8z61Rv6Mj7n-j7jF1rZgYmSOlLFHaZx9Yw29eiahe7IfAudP6OhbW8DuGhks21Z8j9BcvHHYF5g';

const PUSH_RELAY_URL = (import.meta.env.VITE_PUSH_RELAY_URL || '').trim();
const NTFY_BASE = 'https://ntfy.sh';

function appBaseUrl(): string {
  const base = import.meta.env.BASE_URL || '/';
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}${base}`.replace(/\/+$/, '/') ;
}

function featureUrl(feature: ShareFeature): string {
  const path = SHARE_FEATURE_PAGES[feature]?.path || '/';
  const base = import.meta.env.BASE_URL || '/';
  return `${base}${path.startsWith('/') ? path.slice(1) : path}`.replace(/\/+/g, '/');
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) arr[i] = raw.charCodeAt(i);
  return arr;
}

export function pushAlertsSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;
}

export async function ensureAlertTopic(accountId: string): Promise<string> {
  const existing = await fetchAccountAlertConfig(accountId);
  if (existing?.topic) return existing.topic;
  const topic = `rozka-${uid().replace(/-/g, '').slice(0, 16)}`;
  await saveAccountAlertConfig(accountId, { topic });
  return topic;
}

export async function subscribeToHomeScreenPush(): Promise<boolean> {
  if (!pushAlertsSupported()) return false;
  if (!isGitHubConfigured(loadGitHubConfig())) return false;

  const accountId = getActiveAccountId();
  if (!accountId) return false;

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return false;

  await ensureAlertTopic(accountId);

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
    });
  }

  await saveAccountPushSubscription(accountId, subscription.toJSON());
  localStorage.setItem('daylife_home_push_enabled', '1');

  try {
    new Notification(`${APP_NAME} — alerts on`, {
      body: 'You will get home screen popups when someone you share with adds tasks or lists.',
      icon: `${import.meta.env.BASE_URL || '/'}icon.svg`.replace(/\/+/g, '/'),
    });
  } catch {
    /* ignore */
  }

  return true;
}

export function homeScreenPushEnabled(): boolean {
  return localStorage.getItem('daylife_home_push_enabled') === '1' && Notification.permission === 'granted';
}

async function postNtfy(topic: string, title: string, body: string, clickUrl: string): Promise<void> {
  await fetch(`${NTFY_BASE}/${encodeURIComponent(topic)}`, {
    method: 'POST',
    headers: {
      Title: title.slice(0, 120),
      Priority: 'high',
      Tags: 'bell,sparkles',
      Click: clickUrl,
    },
    body: body.slice(0, 500),
  }).catch(() => undefined);
}

async function postWebPush(
  subscription: PushSubscriptionJSON,
  title: string,
  body: string,
  clickUrl: string,
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
    }),
  }).catch(() => undefined);
}

export async function notifyPartnerHomeScreen(params: {
  partnerAccountId: string;
  title: string;
  body: string;
  feature?: ShareFeature;
}): Promise<void> {
  if (!isGitHubConfigured(loadGitHubConfig())) return;

  const clickUrl = new URL(featureUrl(params.feature || 'tasks'), appBaseUrl()).href;
  const title = params.title.startsWith(APP_NAME) ? params.title : `${APP_NAME} — ${params.title}`;

  const [alert, subscription] = await Promise.all([
    fetchAccountAlertConfig(params.partnerAccountId),
    fetchAccountPushSubscription(params.partnerAccountId),
  ]);

  if (alert?.topic) {
    await postNtfy(alert.topic, title, params.body, clickUrl);
  }

  if (subscription?.endpoint) {
    await postWebPush(subscription, title, params.body, clickUrl);
  }
}

export async function notifySharedConnectionPartner(
  partnerAccountId: string,
  fromUsername: string,
  summary: string,
  feature: ShareFeature = 'tasks',
): Promise<void> {
  await notifyPartnerHomeScreen({
    partnerAccountId,
    title: `@${fromUsername} shared something`,
    body: summary,
    feature,
  });
}
