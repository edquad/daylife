import type { Connection } from './api';
import type { ItemVisibility } from './privacy';

export type ShareScope =
  | { kind: 'personal'; visibility: ItemVisibility }
  | { kind: 'connection'; spaceId: string };

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
