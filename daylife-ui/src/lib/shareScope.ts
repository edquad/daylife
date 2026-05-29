import type { Connection, ShareFeature } from './api';
import type { ItemVisibility } from './privacy';
import { defaultVisibility } from './privacy';

export type ShareScope =
  | { kind: 'personal'; visibility: ItemVisibility }
  | { kind: 'connection'; spaceId: string };

const SCOPE_STORAGE_PREFIX = 'daylife_share_scope_';

export function loadShareScope(feature: ShareFeature, membersCount: number): ShareScope {
  try {
    const raw = sessionStorage.getItem(SCOPE_STORAGE_PREFIX + feature);
    if (raw) return JSON.parse(raw) as ShareScope;
  } catch {
    /* ignore */
  }
  return { kind: 'personal', visibility: defaultVisibility(membersCount) };
}

export function saveShareScope(feature: ShareFeature, scope: ShareScope): void {
  sessionStorage.setItem(SCOPE_STORAGE_PREFIX + feature, JSON.stringify(scope));
}

export function connectionLabel(c: Connection): string {
  const name = c.partnerName?.trim();
  return name ? `@${c.partnerUsername} (${name})` : `@${c.partnerUsername}`;
}

export function findConnectionBySpaceId(connections: Connection[], spaceId: string): Connection | undefined {
  return connections.find((c) => c.sharedSpaceId === spaceId);
}

export function activeShareConnections(connections: Connection[], feature: Connection['features'][number]): Connection[] {
  return connections.filter(
    (c) => c.status === 'active' && c.sharedSpaceId && c.features.includes(feature),
  );
}
