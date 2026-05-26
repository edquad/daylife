export type HouseholdType = 'SINGLE' | 'COUPLE' | 'FAMILY';

export type UserRole = 'OWNER' | 'PARTNER' | 'MEMBER';

export const MEMBER_COLORS = [
  '#0F766E',
  '#EC4899',
  '#3B82F6',
  '#F59E0B',
  '#8B5CF6',
  '#10B981',
  '#EF4444',
  '#6366F1',
];

export const MAX_HOUSEHOLD_SIZE = 8;

export const HOUSEHOLD_TYPE_LABELS: Record<HouseholdType, string> = {
  SINGLE: 'Just me',
  COUPLE: 'Me & partner',
  FAMILY: 'Our family',
};

export const HOUSEHOLD_TYPE_DESC: Record<HouseholdType, string> = {
  SINGLE: 'Manage your own daily tasks, expenses & notes',
  COUPLE: 'Plan each day together — two columns, one app',
  FAMILY: 'Everyone gets their own column — parents, kids & more',
};

export function roleLabel(role: string, householdType?: HouseholdType): string {
  if (role === 'OWNER') return 'You';
  if (role === 'PARTNER') return householdType === 'FAMILY' ? 'Partner' : 'Partner';
  return 'Family member';
}

export function nextMemberColor(usedColors: string[]): string {
  const available = MEMBER_COLORS.find((c) => !usedColors.includes(c));
  return available || MEMBER_COLORS[usedColors.length % MEMBER_COLORS.length];
}

export interface SetupPayload {
  householdType: HouseholdType;
  name: string;
  householdName?: string;
  partnerName?: string;
  memberNames?: string[];
}
