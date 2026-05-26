export type ItemVisibility = 'PRIVATE' | 'SHARED';

export function defaultVisibility(memberCount: number): ItemVisibility {
  return memberCount <= 1 ? 'SHARED' : 'PRIVATE';
}

export function isVisibleToViewer(
  visibility: ItemVisibility | undefined,
  ownerId: string | undefined,
  viewerId: string | undefined,
): boolean {
  if (visibility !== 'PRIVATE') return true;
  if (!viewerId) return false;
  return ownerId === viewerId;
}

export function visibilityLabel(visibility?: ItemVisibility): string {
  return visibility === 'PRIVATE' ? 'Private' : 'Shared';
}
