import type { AppData } from './storage';
import { loadData, saveDataLocal, normalizeAppData, parseJsonText, sanitizeJsonText, jsonNeedsSanitizing } from './storage';
import { getActiveAccountId, accountCloudPath } from './accounts';
import { mergeConnections } from './sharing';

const CONFIG_KEY = 'daylife_github_sync';
const MAX_CONFLICT_RETRIES = 8;
const TAB_ID = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const CLOUD_LOCK_KEY = 'daylife_cloud_write_lock';

export type JsonMergeFn<T> = (local: T, remote: T) => T;

/** Serialize GitHub writes so concurrent saves do not 409-loop each other. */
let cloudWriteQueue: Promise<unknown> = Promise.resolve();

export function runCloudWrite<T>(task: () => Promise<T>): Promise<T> {
  const next = cloudWriteQueue.then(() => withCloudWriteLock(task), () => withCloudWriteLock(task));
  cloudWriteQueue = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Best-effort lock so two browser tabs do not PUT the same file at the same time. */
async function withCloudWriteLock<T>(task: () => Promise<T>): Promise<T> {
  const deadline = Date.now() + 12000;
  while (Date.now() < deadline) {
    const now = Date.now();
    let lock: { tab: string; until: number } | null = null;
    try {
      lock = JSON.parse(localStorage.getItem(CLOUD_LOCK_KEY) || 'null');
    } catch {
      lock = null;
    }
    if (!lock || lock.until <= now || lock.tab === TAB_ID) {
      localStorage.setItem(CLOUD_LOCK_KEY, JSON.stringify({ tab: TAB_ID, until: now + 8000 }));
      try {
        return await task();
      } finally {
        const current = JSON.parse(localStorage.getItem(CLOUD_LOCK_KEY) || 'null');
        if (current?.tab === TAB_ID) localStorage.removeItem(CLOUD_LOCK_KEY);
      }
    }
    await sleep(250);
  }
  return task();
}

/** Built-in cloud storage — always on, no user setup. */
function resolveCloudPath(): string {
  const accountId = getActiveAccountId();
  if (accountId) return accountCloudPath(accountId);
  return 'data/daylife.json';
}

const CLOUD_BASE = {
  enabled: true,
  owner: 'edquad',
  repo: 'daylife-data',
  branch: 'main',
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
    ...CLOUD_BASE,
    path: resolveCloudPath(),
    enabled: true,
    token: resolveToken(),
    lastSyncedAt: meta.lastSyncedAt,
    lastSha: meta.lastSha,
  };
}

export function saveGitHubConfig(config: Partial<Pick<GitHubSyncConfig, 'lastSyncedAt' | 'lastSha'>>): void {
  let meta: StoredSyncMeta = {};
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (raw) meta = parseJsonText<StoredSyncMeta>(raw);
  } catch {
    /* ignore */
  }
  localStorage.setItem(
    CONFIG_KEY,
    JSON.stringify({
      lastSyncedAt: config.lastSyncedAt ?? meta.lastSyncedAt,
      lastSha: config.lastSha !== undefined ? config.lastSha : meta.lastSha,
    }),
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

async function putGitHubContents<T>(
  config: GitHubSyncConfig,
  path: string,
  payload: T,
  message: string,
  merge?: JsonMergeFn<T>,
  attempt = 0,
): Promise<string> {
  if (attempt >= MAX_CONFLICT_RETRIES) {
    throw new Error('Cloud sync conflict — wait a few seconds, then tap Refresh from cloud in Settings');
  }

  const owner = config.owner.trim();
  const repo = config.repo.trim();
  const branch = config.branch.trim() || 'main';
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${encodeURIComponent(branch)}`;
  const getRes = await fetch(url, { headers: authHeaders(config.token) });

  let fileSha: string | undefined;
  let toWrite = payload;

  if (getRes.ok) {
    const json = await getRes.json();
    fileSha = json.sha as string;
    if (merge) {
      try {
        const remoteData = parseJsonText<T>(decodeBase64Utf8(json.content));
        toWrite = merge(payload, remoteData);
      } catch {
        /* keep payload */
      }
    }
  } else if (getRes.status !== 404) {
    throw new Error(`Could not read cloud data (${getRes.status})`);
  }

  const putUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  const body: Record<string, string> = {
    message,
    content: encodeBase64Utf8(JSON.stringify(toWrite, null, 2)),
    branch,
  };
  if (fileSha) body.sha = fileSha;

  const res = await fetch(putUrl, {
    method: 'PUT',
    headers: { ...authHeaders(config.token), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (res.status === 409) {
    await sleep(400 * (attempt + 1));
    return putGitHubContents(config, path, payload, message, merge, attempt + 1);
  }

  if (!res.ok) {
    throw new Error(res.status === 401 ? 'Cloud sync auth failed' : `Could not save cloud data (${res.status})`);
  }

  const json = await res.json();
  return json.content.sha as string;
}

/** Write any JSON blob to the cloud repo (shared spaces, inbox, registry, etc.). */
export async function putGitHubJsonAtPath<T = unknown>(
  path: string,
  data: T,
  message?: string,
  merge?: JsonMergeFn<T>,
): Promise<string> {
  return runCloudWrite(async () => {
    const config = loadGitHubConfig();
    if (!isGitHubConfigured(config)) throw new Error('Cloud sync not available');
    return putGitHubContents(config, path, data, message || `Rozka update ${path}`, merge);
  });
}

async function pushToGitHubOnce(config: GitHubSyncConfig, data: AppData): Promise<string> {
  const path = config.path.trim() || 'data/daylife.json';
  const stamped: AppData = { ...data, updatedAt: data.updatedAt || new Date().toISOString() };
  const remote = await fetchFromGitHub(config);
  const merged = remote ? mergeAppData(stamped, remote.data) : stamped;
  saveDataLocal(merged);

  return putGitHubContents(
    config,
    path,
    merged,
    `Rozka sync ${merged.updatedAt}`,
    mergeAppData,
  );
}

export async function pushToGitHub(config: GitHubSyncConfig, data: AppData): Promise<string> {
  return runCloudWrite(() => pushToGitHubOnce(config, data));
}

export function pickNewerData(local: AppData, remote: AppData): 'local' | 'remote' {
  const localTime = local.updatedAt || '1970-01-01T00:00:00.000Z';
  const remoteTime = remote.updatedAt || '1970-01-01T00:00:00.000Z';
  return remoteTime > localTime ? 'remote' : 'local';
}

export function mergeAppData(local: AppData, remote: AppData): AppData {
  const winner = pickNewerData(local, remote);
  const base = winner === 'remote' ? remote : local;
  const other = winner === 'remote' ? local : remote;
  return {
    ...base,
    connections: mergeConnections(other.connections, base.connections),
    updatedAt: new Date().toISOString(),
  };
}

/** Push local data to cloud immediately (used after accepting a share invite). */
export async function flushCloudSyncNow(): Promise<void> {
  return runCloudWrite(async () => {
    const config = loadGitHubConfig();
    if (!isGitHubConfigured(config)) return;
    const local = loadData();
    const sha = await pushToGitHubOnce(config, local);
    saveGitHubConfig({ lastSha: sha, lastSyncedAt: new Date().toISOString() });
  });
}

export async function pullAndMerge(config: GitHubSyncConfig): Promise<'local' | 'remote' | 'none'> {
  return runCloudWrite(async () => {
    const remote = await fetchFromGitHub(config);
    if (!remote) return 'none';

    const local = loadData();
    const merged = mergeAppData(local, remote.data);
    saveDataLocal(merged);

    saveGitHubConfig({ lastSha: remote.sha, lastSyncedAt: new Date().toISOString() });
    return pickNewerData(local, remote.data);
  });
}

export async function syncNow(config: GitHubSyncConfig): Promise<void> {
  return runCloudWrite(async () => {
    const local = loadData();
    const sha = await pushToGitHubOnce(config, local);
    saveGitHubConfig({ lastSha: sha, lastSyncedAt: new Date().toISOString() });
  });
}

let pushTimer: ReturnType<typeof setTimeout> | null = null;
let pushInFlight = false;
let pushPending = false;

export function scheduleGitHubPush(config: GitHubSyncConfig): void {
  if (!isGitHubConfigured(config)) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    if (pushInFlight) {
      pushPending = true;
      return;
    }
    pushInFlight = true;
    syncNow(loadGitHubConfig())
      .then(() => {
        window.dispatchEvent(new CustomEvent('daylife-sync', { detail: { status: 'synced' } }));
      })
      .catch((err) => {
        window.dispatchEvent(
          new CustomEvent('daylife-sync', { detail: { status: 'error', message: (err as Error).message } }),
        );
      })
      .finally(() => {
        pushInFlight = false;
        if (pushPending) {
          pushPending = false;
          scheduleGitHubPush(loadGitHubConfig());
        }
      });
  }, 2500);
}
