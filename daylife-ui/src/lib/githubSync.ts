import type { AppData } from './storage';
import { loadData, saveDataLocal, normalizeAppData, parseJsonText, sanitizeJsonText, jsonNeedsSanitizing } from './storage';

const CONFIG_KEY = 'daylife_github_sync';

/** Built-in cloud storage — always on, no user setup. */
const CLOUD = {
  enabled: true,
  owner: 'edquad',
  repo: 'daylife-data',
  branch: 'main',
  path: 'data/daylife.json',
} as const;

export interface GitHubSyncConfig {
  enabled: boolean;
  owner: string;
  repo: string;
  branch: string;
  path: string;
  token: string;
  lastSyncedAt?: string;
  lastSha?: string;
}

export type SyncStatus = 'off' | 'idle' | 'syncing' | 'synced' | 'error';

interface StoredSyncMeta {
  lastSyncedAt?: string;
  lastSha?: string;
}

function resolveToken(): string {
  return import.meta.env.VITE_GITHUB_SYNC_TOKEN?.trim() || '';
}

export function loadGitHubConfig(): GitHubSyncConfig {
  let meta: StoredSyncMeta = {};
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (raw) meta = parseJsonText<StoredSyncMeta>(raw);
  } catch {
    /* ignore */
  }
  return {
    ...CLOUD,
    enabled: true,
    token: resolveToken(),
    lastSyncedAt: meta.lastSyncedAt,
    lastSha: meta.lastSha,
  };
}

export function saveGitHubConfig(config: Pick<GitHubSyncConfig, 'lastSyncedAt' | 'lastSha'>): void {
  localStorage.setItem(
    CONFIG_KEY,
    JSON.stringify({ lastSyncedAt: config.lastSyncedAt, lastSha: config.lastSha }),
  );
}

export function isGitHubConfigured(config: GitHubSyncConfig): boolean {
  return Boolean(config.token.trim() && config.owner.trim() && config.repo.trim());
}

function encodeBase64Utf8(str: string): string {
  return btoa(unescape(encodeURIComponent(str)));
}

function decodeBase64Utf8(b64: string): string {
  return decodeURIComponent(escape(atob(b64.replace(/\s/g, ''))));
}

function authHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token.trim()}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

interface RemoteFile {
  data: AppData;
  sha: string;
  needsRepair?: boolean;
}

export async function fetchFromGitHub(config: GitHubSyncConfig): Promise<RemoteFile | null> {
  const owner = config.owner.trim();
  const repo = config.repo.trim();
  const path = config.path.trim() || 'data/daylife.json';
  const branch = config.branch.trim() || 'main';
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${encodeURIComponent(branch)}`;
  const res = await fetch(url, { headers: authHeaders(config.token) });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(res.status === 401 ? 'Cloud sync auth failed' : `Could not read cloud data (${res.status})`);
  }
  const json = await res.json();
  const decoded = decodeBase64Utf8(json.content);
  const needsRepair = jsonNeedsSanitizing(decoded);
  let parsed: AppData;
  try {
    parsed = parseJsonText<AppData>(decoded);
  } catch {
    try {
      parsed = JSON.parse(sanitizeJsonText(decoded)) as AppData;
    } catch {
      throw new Error('Cloud backup file is corrupted — export a local backup, then import it in Settings');
    }
  }
  return { data: normalizeAppData(parsed), sha: json.sha as string, needsRepair };
}

export async function pushToGitHub(config: GitHubSyncConfig, data: AppData, sha?: string): Promise<string> {
  const owner = config.owner.trim();
  const repo = config.repo.trim();
  const path = config.path.trim() || 'data/daylife.json';
  const branch = config.branch.trim() || 'main';
  const stamped: AppData = { ...data, updatedAt: data.updatedAt || new Date().toISOString() };
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  const body: Record<string, string> = {
    message: `DayLife sync ${stamped.updatedAt}`,
    content: encodeBase64Utf8(JSON.stringify(stamped, null, 2)),
    branch,
  };
  if (sha) body.sha = sha;

  const res = await fetch(url, {
    method: 'PUT',
    headers: { ...authHeaders(config.token), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    if (res.status === 409) {
      const remote = await fetchFromGitHub(config);
      if (remote) {
        return pushToGitHub(config, data, remote.sha);
      }
    }
    throw new Error(res.status === 401 ? 'Cloud sync auth failed' : `Could not save cloud data (${res.status})`);
  }

  const json = await res.json();
  return json.content.sha as string;
}

export function pickNewerData(local: AppData, remote: AppData): 'local' | 'remote' {
  const localTime = local.updatedAt || '1970-01-01T00:00:00.000Z';
  const remoteTime = remote.updatedAt || '1970-01-01T00:00:00.000Z';
  return remoteTime > localTime ? 'remote' : 'local';
}

export async function pullAndMerge(config: GitHubSyncConfig): Promise<'local' | 'remote' | 'none'> {
  const remote = await fetchFromGitHub(config);
  if (!remote) return 'none';

  const local = loadData();
  const winner = pickNewerData(local, remote.data);

  if (winner === 'remote') {
    saveDataLocal(remote.data);
  }

  saveGitHubConfig({ lastSha: remote.sha, lastSyncedAt: new Date().toISOString() });
  return winner;
}

export async function syncNow(config: GitHubSyncConfig): Promise<void> {
  const remote = await fetchFromGitHub(config);
  const local = loadData();

  if (!remote) {
    const sha = await pushToGitHub(config, local);
    saveGitHubConfig({ lastSha: sha, lastSyncedAt: new Date().toISOString() });
    return;
  }

  const winner = pickNewerData(local, remote.data);
  const chosen = winner === 'remote' ? remote.data : local;
  if (winner === 'remote') {
    saveDataLocal(remote.data);
  }

  const sha = await pushToGitHub(config, chosen, remote.sha);
  saveGitHubConfig({ lastSha: sha, lastSyncedAt: new Date().toISOString() });
}

let pushTimer: ReturnType<typeof setTimeout> | null = null;
let pushInFlight = false;

export function scheduleGitHubPush(config: GitHubSyncConfig): void {
  if (!isGitHubConfigured(config)) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(async () => {
    if (pushInFlight) return;
    pushInFlight = true;
    try {
      const local = loadData();
      const cfg = loadGitHubConfig();
      const sha = await pushToGitHub(cfg, local, cfg.lastSha);
      saveGitHubConfig({ lastSha: sha, lastSyncedAt: new Date().toISOString() });
      window.dispatchEvent(new CustomEvent('daylife-sync', { detail: { status: 'synced' } }));
    } catch (err) {
      window.dispatchEvent(new CustomEvent('daylife-sync', { detail: { status: 'error', message: (err as Error).message } }));
    } finally {
      pushInFlight = false;
    }
  }, 1500);
}
