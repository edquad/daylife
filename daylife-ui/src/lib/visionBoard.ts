import type { VisionCategory } from './api';

export const VISION_CATEGORIES: { id: VisionCategory; label: string; color: string; emoji: string }[] = [
  { id: 'TRAVEL', label: 'Travel', color: '#0EA5E9', emoji: '✈️' },
  { id: 'HOME', label: 'Home', color: '#10B981', emoji: '🏠' },
  { id: 'CAREER', label: 'Career', color: '#6366F1', emoji: '💼' },
  { id: 'HEALTH', label: 'Health', color: '#EF4444', emoji: '💪' },
  { id: 'FINANCE', label: 'Finance', color: '#F59E0B', emoji: '💰' },
  { id: 'RELATIONSHIP', label: 'Love & family', color: '#EC4899', emoji: '❤️' },
  { id: 'OTHER', label: 'Other', color: '#8B5CF6', emoji: '✨' },
];

export const VISION_INSPIRATIONS = [
  { title: 'Dream vacation', category: 'TRAVEL' as VisionCategory, emoji: '🌴' },
  { title: 'Own our home', category: 'HOME' as VisionCategory, emoji: '🏡' },
  { title: 'Promote at work', category: 'CAREER' as VisionCategory, emoji: '🚀' },
  { title: 'Run a 5K', category: 'HEALTH' as VisionCategory, emoji: '🏃' },
  { title: 'Save emergency fund', category: 'FINANCE' as VisionCategory, emoji: '🎯' },
  { title: 'Weekly date night', category: 'RELATIONSHIP' as VisionCategory, emoji: '💑' },
];

export function categoryMeta(id: VisionCategory) {
  return VISION_CATEGORIES.find((c) => c.id === id) || VISION_CATEGORIES[VISION_CATEGORIES.length - 1];
}
