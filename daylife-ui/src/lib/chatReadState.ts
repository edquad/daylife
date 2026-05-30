import { getActiveAccountId } from './accounts';

const readKey = (accountId: string) => `daylife_chat_read_${accountId}`;

function loadReadMap(): Record<string, string> {
  const accountId = getActiveAccountId();
  if (!accountId) return {};
  try {
    const raw = localStorage.getItem(readKey(accountId));
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function saveReadMap(map: Record<string, string>): void {
  const accountId = getActiveAccountId();
  if (!accountId) return;
  localStorage.setItem(readKey(accountId), JSON.stringify(map));
}

export function getChatLastReadAt(spaceId: string): string | null {
  return loadReadMap()[spaceId] || null;
}

export function markChatRead(spaceId: string, at?: string): void {
  const map = loadReadMap();
  map[spaceId] = at || new Date().toISOString();
  saveReadMap(map);
}

export function countUnreadMessages(
  spaceId: string,
  messages: Array<{ authorAccountId: string; createdAt: string }>,
  myAccountId: string,
): number {
  const lastRead = getChatLastReadAt(spaceId);
  return messages.filter((m) => {
    if (m.authorAccountId === myAccountId) return false;
    if (!lastRead) return true;
    return m.createdAt > lastRead;
  }).length;
}
