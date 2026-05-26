import { loadGitHubConfig, isGitHubConfigured } from './githubSync';
import { parseJsonText, uid } from './storage';

const ACCOUNT_ID_KEY = 'daylife_account_id';
const REGISTRY_PATH = 'data/accounts/registry.json';

export interface AccountRegistry {
  accounts: Record<string, string>;
  updatedAt?: string;
}

function authHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token.trim()}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

function encodeBase64Utf8(str: string): string {
  return btoa(unescape(encodeURIComponent(str)));
}

function decodeBase64Utf8(b64: string): string {
  return decodeURIComponent(escape(atob(b64.replace(/\s/g, ''))));
}

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
}

export function validateUsername(username: string): string | null {
  if (username.length < 3) return 'Username must be at least 3 characters';
  if (username.length > 20) return 'Username must be 20 characters or less';
  if (!/^[a-z0-9_]+$/.test(username)) return 'Use letters, numbers, and underscore only';
  return null;
}

export function getActiveAccountId(): string | null {
  return localStorage.getItem(ACCOUNT_ID_KEY);
}

export function setActiveAccountId(id: string | null): void {
  if (id) localStorage.setItem(ACCOUNT_ID_KEY, id);
  else localStorage.removeItem(ACCOUNT_ID_KEY);
  window.dispatchEvent(new CustomEvent('daylife-account-changed'));
}

export function accountCloudPath(accountId: string): string {
  return `data/accounts/${accountId}/daylife.json`;
}

async function fetchRegistry(): Promise<{ registry: AccountRegistry; sha?: string }> {
  const config = loadGitHubConfig();
  if (!isGitHubConfigured(config)) {
    return { registry: { accounts: {} } };
  }
  const url = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${REGISTRY_PATH}?ref=${encodeURIComponent(config.branch)}`;
  const res = await fetch(url, { headers: authHeaders(config.token) });
  if (res.status === 404) return { registry: { accounts: {} } };
  if (!res.ok) throw new Error('Could not load accounts');
  const json = await res.json();
  const registry = parseJsonText<AccountRegistry>(decodeBase64Utf8(json.content));
  return { registry, sha: json.sha as string };
}

async function saveRegistry(registry: AccountRegistry, sha?: string): Promise<void> {
  const config = loadGitHubConfig();
  if (!isGitHubConfigured(config)) {
    throw new Error('Cloud sync not available');
  }
  const stamped: AccountRegistry = { ...registry, updatedAt: new Date().toISOString() };
  const url = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${REGISTRY_PATH}`;
  const body: Record<string, string> = {
    message: `Rozka accounts ${stamped.updatedAt}`,
    content: encodeBase64Utf8(JSON.stringify(stamped, null, 2)),
    branch: config.branch,
  };
  if (sha) body.sha = sha;
  const res = await fetch(url, {
    method: 'PUT',
    headers: { ...authHeaders(config.token), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (res.status === 409) {
    const latest = await fetchRegistry();
    return saveRegistry({ ...latest.registry, ...stamped }, latest.sha);
  }
  if (!res.ok) throw new Error('Could not save account');
}

export async function resolveAccountId(username: string): Promise<string | null> {
  const key = normalizeUsername(username);
  if (!key) return null;
  const { registry } = await fetchRegistry();
  return registry.accounts[key] || null;
}

/** All usernames registered in cloud (for invite picker). */
export async function listRegisteredUsernames(): Promise<string[]> {
  const { registry } = await fetchRegistry();
  return Object.keys(registry.accounts).sort((a, b) => a.localeCompare(b));
}

export async function createAccount(username: string): Promise<string> {
  const key = normalizeUsername(username);
  const err = validateUsername(key);
  if (err) throw new Error(err);
  const { registry, sha } = await fetchRegistry();
  if (registry.accounts[key]) throw new Error('Username already taken — try another or sign in');
  const accountId = uid();
  registry.accounts[key] = accountId;
  await saveRegistry(registry, sha);
  return accountId;
}
