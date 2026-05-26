import { loadGitHubConfig, isGitHubConfigured } from './githubSync';
import { parseJsonText, uid } from './storage';
import type { Task } from './api';

export type ShareFeature = 'tasks';

export interface ShareInvite {
  id: string;
  fromAccountId: string;
  fromUsername: string;
  fromName: string;
  features: ShareFeature[];
  createdAt: string;
}

export interface AccountInbox {
  invites: ShareInvite[];
  updatedAt?: string;
}

export interface Connection {
  id: string;
  inviteId: string;
  partnerUsername: string;
  partnerAccountId: string;
  partnerName?: string;
  features: ShareFeature[];
  status: 'pending_sent' | 'pending_received' | 'active' | 'declined';
  sharedSpaceId?: string;
  initiatedByMe: boolean;
  createdAt: string;
}

export interface SharedSpaceData {
  id: string;
  memberAccountIds: [string, string];
  memberUsernames: [string, string];
  features: ShareFeature[];
  tasks: Task[];
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

function inboxPath(accountId: string): string {
  return `data/accounts/${accountId}/inbox.json`;
}

export function sharedSpacePath(spaceId: string): string {
  return `data/shared/${spaceId}.json`;
}

async function readGitHubJson<T>(path: string): Promise<{ data: T; sha?: string } | null> {
  const config = loadGitHubConfig();
  if (!isGitHubConfigured(config)) return null;
  const url = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${path}?ref=${encodeURIComponent(config.branch)}`;
  const res = await fetch(url, { headers: authHeaders(config.token) });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('Could not read cloud data');
  const json = await res.json();
  return { data: parseJsonText<T>(decodeBase64Utf8(json.content)), sha: json.sha as string };
}

async function writeGitHubJson(path: string, data: unknown, sha?: string, message?: string): Promise<string> {
  const config = loadGitHubConfig();
  if (!isGitHubConfigured(config)) throw new Error('Cloud sync not available');
  const url = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${path}`;
  const body: Record<string, string> = {
    message: message || `DayLife update ${path}`,
    content: encodeBase64Utf8(JSON.stringify(data, null, 2)),
    branch: config.branch,
  };
  if (sha) body.sha = sha;
  const res = await fetch(url, {
    method: 'PUT',
    headers: { ...authHeaders(config.token), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (res.status === 409) {
    const latest = await readGitHubJson<unknown>(path);
    return writeGitHubJson(path, data, latest?.sha, message);
  }
  if (!res.ok) throw new Error('Could not save to cloud');
  const json = await res.json();
  return json.content.sha as string;
}

export async function fetchInbox(accountId: string): Promise<AccountInbox> {
  const remote = await readGitHubJson<AccountInbox>(inboxPath(accountId));
  return remote?.data || { invites: [] };
}

export async function pushInbox(accountId: string, inbox: AccountInbox): Promise<void> {
  const remote = await readGitHubJson<AccountInbox>(inboxPath(accountId));
  await writeGitHubJson(
    inboxPath(accountId),
    { ...inbox, updatedAt: new Date().toISOString() },
    remote?.sha,
    'DayLife share invite',
  );
}

export async function fetchSharedSpace(spaceId: string): Promise<SharedSpaceData | null> {
  const remote = await readGitHubJson<SharedSpaceData>(sharedSpacePath(spaceId));
  return remote?.data || null;
}

export async function saveSharedSpace(space: SharedSpaceData): Promise<void> {
  const remote = await readGitHubJson<SharedSpaceData>(sharedSpacePath(space.id));
  const stamped = { ...space, updatedAt: new Date().toISOString() };
  await writeGitHubJson(sharedSpacePath(space.id), stamped, remote?.sha, 'DayLife shared space');
}

export async function updatePartnerConnection(
  partnerAccountId: string,
  connection: Connection,
): Promise<void> {
  const path = `data/accounts/${partnerAccountId}/daylife.json`;
  const remote = await readGitHubJson<{ connections?: Connection[] } & Record<string, unknown>>(path);
  if (!remote) throw new Error('Partner data not found');
  const connections = remote.data.connections || [];
  const idx = connections.findIndex((c) => c.inviteId === connection.inviteId);
  if (idx >= 0) connections[idx] = connection;
  else connections.push(connection);
  await writeGitHubJson(path, { ...remote.data, connections }, remote.sha, 'DayLife connection update');
}

export function emptySharedSpace(
  spaceId: string,
  aId: string,
  bId: string,
  aUser: string,
  bUser: string,
  features: ShareFeature[],
): SharedSpaceData {
  return {
    id: spaceId,
    memberAccountIds: [aId, bId],
    memberUsernames: [aUser, bUser],
    features,
    tasks: [],
  };
}

export { uid as newShareId };
