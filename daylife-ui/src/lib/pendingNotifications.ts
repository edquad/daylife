import type { Connection } from './api';
import { APP_NAME } from './brand';

const ENABLED_KEY = 'daylife_notifications_enabled';
const SEEN_INVITES_KEY = 'daylife_seen_invite_ids';
const PROMPT_DISMISSED_KEY = 'daylife_notif_prompt_dismissed';

export function notificationsSupported(): boolean {
  return typeof Notification !== 'undefined';
}

export function notificationsPermission(): NotificationPermission | 'unsupported' {
  if (!notificationsSupported()) return 'unsupported';
  return Notification.permission;
}

export function notificationsOptIn(): boolean {
  return localStorage.getItem(ENABLED_KEY) === '1' && Notification.permission === 'granted';
}

export function isNotificationPromptDismissed(): boolean {
  return localStorage.getItem(PROMPT_DISMISSED_KEY) === '1';
}

export function dismissNotificationPrompt(): void {
  localStorage.setItem(PROMPT_DISMISSED_KEY, '1');
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!notificationsSupported()) return false;
  const result = await Notification.requestPermission();
  if (result === 'granted') {
    localStorage.setItem(ENABLED_KEY, '1');
    return true;
  }
  return false;
}

export function updatePendingBadge(count: number): void {
  const nav = navigator as Navigator & {
    setAppBadge?: (count: number) => Promise<void>;
    clearAppBadge?: () => Promise<void>;
  };
  if (!nav.setAppBadge) return;
  if (count > 0) {
    nav.setAppBadge(count).catch(() => undefined);
  } else {
    nav.clearAppBadge?.().catch(() => undefined);
  }
}

function loadSeenInviteIds(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_INVITES_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function saveSeenInviteIds(ids: Set<string>): void {
  localStorage.setItem(SEEN_INVITES_KEY, JSON.stringify([...ids].slice(-50)));
}

function sharePageUrl(): string {
  const base = import.meta.env.BASE_URL || '/';
  return `${base}${base.endsWith('/') ? '' : '/'}share`.replace(/\/+/g, '/');
}

export function notifyNewInvites(invites: Connection[]): void {
  if (!notificationsOptIn() || invites.length === 0) return;

  const seen = loadSeenInviteIds();
  const fresh = invites.filter((i) => !seen.has(i.inviteId));
  if (fresh.length === 0) return;

  const iconUrl = `${import.meta.env.BASE_URL || '/'}icon.svg`.replace(/\/+/g, '/');

  for (const inv of fresh) {
    try {
      const title =
        fresh.length === 1
          ? `${APP_NAME} — invite from @${inv.partnerUsername}`
          : `${APP_NAME} — ${fresh.length} new invites`;
      const body =
        fresh.length === 1
          ? `${inv.partnerName || inv.partnerUsername} wants to share with you. Tap to accept.`
          : `@${inv.partnerUsername} and others want to connect.`;

      const notification = new Notification(title, {
        body,
        tag: `invite-${inv.inviteId}`,
        icon: iconUrl,
      });
      notification.onclick = () => {
        window.focus();
        window.location.assign(sharePageUrl());
        notification.close();
      };
    } catch {
      /* ignore blocked notifications */
    }
    seen.add(inv.inviteId);
  }

  saveSeenInviteIds(seen);
}

export function notifyInviteAccepted(partnerUsername: string): void {
  if (!notificationsOptIn()) return;
  try {
    new Notification(`${APP_NAME} — connected!`, {
      body: `@${partnerUsername} accepted your invite. You can share tasks and lists now.`,
      tag: 'invite-accepted',
      icon: `${import.meta.env.BASE_URL || '/'}icon.svg`.replace(/\/+/g, '/'),
    });
  } catch {
    /* ignore */
  }
}
