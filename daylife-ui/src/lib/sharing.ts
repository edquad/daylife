import { loadGitHubConfig, isGitHubConfigured } from './githubSync';
import { parseJsonText, uid } from './storage';
import type {
  Task,
  StoredExpense,
  ShoppingItem,
  Reminder,
  VisionBoardItem,
  Settlement,
  Routine,
  RoutineDayLog,
} from './api';

export type ShareFeature =
  | 'tasks'
  | 'expenses'
  | 'splits'
  | 'shopping'
  | 'notes'
  | 'reminders'
  | 'routines'
  | 'vision';

export const ALL_SHARE_FEATURES: ShareFeature[] = [
  'tasks',
  'expenses',
  'splits',
  'shopping',
  'notes',
  'reminders',
  'routines',
  'vision',
];

export const SHARE_FEATURE_GROUPS: Array<{ title: string; features: ShareFeature[] }> = [
  { title: 'Today', features: ['tasks', 'notes'] },
  { title: 'Money', features: ['expenses', 'splits'] },
  { title: 'Daily life', features: ['shopping', 'reminders', 'routines'] },
  { title: 'Dreams', features: ['vision'] },
];

export const SHARE_FEATURE_PAGES: Record<ShareFeature, { label: string; path: string }> = {
  tasks: { label: 'Today → tasks', path: '/' },
  expenses: { label: 'Expenses', path: '/expenses' },
  splits: { label: 'Split money', path: '/splits' },
  shopping: { label: 'Daily life → Shopping', path: '/daily?tab=shopping' },
  reminders: { label: 'Daily life → Reminders', path: '/daily?tab=reminders' },
  routines: { label: 'Daily life → Routines', path: '/daily?tab=routines' },
  notes: { label: 'Today → notes', path: '/' },
  vision: { label: 'Vision board', path: '/vision' },
};

function connectionRank(status: Connection['status']): number {
  if (status === 'active') return 4;
  if (status === 'pending_received' || status === 'pending_sent') return 3;
  if (status === 'declined') return 1;
  return 0;
}

/** Keep the best connection state when local and cloud differ (fixes lost accepts). */
export function mergeConnections(local: Connection[] = [], remote: Connection[] = []): Connection[] {
  const map = new Map<string, Connection>();
  for (const c of [...remote, ...local]) {
    const prev = map.get(c.inviteId);
    if (!prev || connectionRank(c.status) >= connectionRank(prev.status)) {
      map.set(c.inviteId, {
        ...prev,
        ...c,
        sharedSpaceId: c.sharedSpaceId || prev?.sharedSpaceId,
        features: c.features?.length ? c.features : prev?.features || [],
      });
    }
  }
  return Array.from(map.values());
}

export const SHARE_FEATURE_LABELS: Record<ShareFeature, { title: string; description: string }> = {
  tasks: { title: 'Tasks', description: 'Shared column on Today — both add & complete' },
  expenses: { title: 'Expenses', description: 'Shared spending log on Expenses & Today' },
  splits: { title: 'Money split', description: 'Who owes who — settle up on Split money page' },
  shopping: { title: 'Shopping list', description: 'Shared buy list in Daily life' },
  notes: { title: 'Day notes', description: 'Shared notes on Today dashboard' },
  reminders: { title: 'Reminders', description: 'Shared upcoming dates in Daily life' },
  routines: { title: 'Routines', description: 'Shared morning/evening habits in Daily life' },
  vision: { title: 'Vision board', description: 'Shared goals & dreams on Vision page' },
};

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

export interface SharedNote {
  id: string;
  content: string;
  area: 'PERSONAL' | 'WORK' | 'HOME';
  noteDate: string;
  authorId: string;
  createdAt: string;
}

export interface SharedSpaceData {
  id: string;
  memberAccountIds: [string, string];
  memberUsernames: [string, string];
  memberUserIds?: [string, string];
  memberNames?: [string, string];
  features: ShareFeature[];
  tasks: Task[];
  expenses: StoredExpense[];
  settlements: Settlement[];
  shoppingItems: ShoppingItem[];
  notes: SharedNote[];
  reminders: Reminder[];
  routines: Routine[];
  routineLogs: RoutineDayLog[];
  visionBoard: VisionBoardItem[];
  updatedAt?: string;
}

export function normalizeSharedSpace(space: SharedSpaceData): SharedSpaceData {
  return {
    ...space,
    tasks: space.tasks ?? [],
    expenses: space.expenses ?? [],
    settlements: space.settlements ?? [],
    shoppingItems: space.shoppingItems ?? [],
    notes: space.notes ?? [],
    reminders: space.reminders ?? [],
    routines: space.routines ?? [],
    routineLogs: space.routineLogs ?? [],
    visionBoard: space.visionBoard ?? [],
  };
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

export function accountDataPath(accountId: string): string {
  return `data/accounts/${accountId}/daylife.json`;
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
    message: message || `Rozka update ${path}`,
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

export async function fetchAccountUserProfile(
  accountId: string,
): Promise<{ id: string; name: string; color: string } | null> {
  const remote = await readGitHubJson<{ users?: Array<{ id: string; name: string; color: string }> }>(
    accountDataPath(accountId),
  );
  const user = remote?.data.users?.[0];
  return user ? { id: user.id, name: user.name, color: user.color } : null;
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
    'Rozka share invite',
  );
}

export async function fetchSharedSpace(spaceId: string): Promise<SharedSpaceData | null> {
  const remote = await readGitHubJson<SharedSpaceData>(sharedSpacePath(spaceId));
  return remote?.data ? normalizeSharedSpace(remote.data) : null;
}

export async function saveSharedSpace(space: SharedSpaceData): Promise<void> {
  const remote = await readGitHubJson<SharedSpaceData>(sharedSpacePath(space.id));
  const stamped = normalizeSharedSpace({ ...space, updatedAt: new Date().toISOString() });
  await writeGitHubJson(sharedSpacePath(space.id), stamped, remote?.sha, 'Rozka shared space');
}

export async function updatePartnerConnection(
  partnerAccountId: string,
  connection: Connection,
): Promise<void> {
  const path = accountDataPath(partnerAccountId);
  const remote = await readGitHubJson<{ connections?: Connection[] } & Record<string, unknown>>(path);
  if (!remote) throw new Error('Partner data not found');
  const connections = remote.data.connections || [];
  const idx = connections.findIndex((c) => c.inviteId === connection.inviteId);
  if (idx >= 0) connections[idx] = connection;
  else connections.push(connection);
  await writeGitHubJson(
    path,
    { ...remote.data, connections, updatedAt: new Date().toISOString() },
    remote.sha,
    'Rozka connection update',
  );
}

export function emptySharedSpace(
  spaceId: string,
  aId: string,
  bId: string,
  aUser: string,
  bUser: string,
  features: ShareFeature[],
): SharedSpaceData {
  return normalizeSharedSpace({
    id: spaceId,
    memberAccountIds: [aId, bId],
    memberUsernames: [aUser, bUser],
    features,
    tasks: [],
    expenses: [],
    settlements: [],
    shoppingItems: [],
    notes: [],
    reminders: [],
    routines: [],
    routineLogs: [],
    visionBoard: [],
  });
}

export { uid as newShareId };
