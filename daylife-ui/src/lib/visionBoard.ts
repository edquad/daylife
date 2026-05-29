import type { VisionCategory } from './api';

export interface VisionCategoryMeta {
  id: VisionCategory;
  label: string;
  color: string;
  emoji: string;
}

export interface VisionCategoryGroup {
  title: string;
  categories: VisionCategoryMeta[];
}

const cat = (id: VisionCategory, label: string, color: string, emoji: string): VisionCategoryMeta => ({
  id,
  label,
  color,
  emoji,
});

/** All life-area categories grouped for the vision board UI. */
export const VISION_CATEGORY_GROUPS: VisionCategoryGroup[] = [
  {
    title: 'Glow-up & self',
    categories: [
      cat('BEAUTY_GLOW', 'Beauty & glow-up', '#F472B6', '✨'),
      cat('SELF_LOVE', 'Self-love', '#EC4899', '💗'),
      cat('CONFIDENCE', 'Confidence', '#DB2777', '👑'),
      cat('FASHION', 'Fashion style', '#A855F7', '👗'),
      cat('SOFT_LIFE', 'Soft life', '#F9A8D4', '🌸'),
      cat('FEMININE', 'Feminine energy', '#FB7185', '🦋'),
      cat('MASCULINE', 'Masculine leadership', '#64748B', '⚡'),
    ],
  },
  {
    title: 'Health & mind',
    categories: [
      cat('HEALTH', 'Health & fitness', '#EF4444', '💪'),
      cat('HEALTH_FITNESS', 'Healthy body', '#F97316', '🏃'),
      cat('HEALING', 'Healing', '#14B8A6', '🌿'),
      cat('CLARITY', 'Mental clarity', '#06B6D4', '🧠'),
      cat('INNER_PEACE', 'Inner peace', '#22D3EE', '🕊️'),
      cat('DISCIPLINE', 'Discipline & routines', '#6366F1', '📋'),
    ],
  },
  {
    title: 'Love & people',
    categories: [
      cat('RELATIONSHIP', 'Relationships', '#EC4899', '❤️'),
      cat('RELATIONSHIPS', 'Healthy love', '#F43F5E', '💕'),
      cat('MARRIAGE', 'Marriage / soulmate', '#E11D48', '💍'),
      cat('FRIENDSHIPS', 'Friendships', '#FB923C', '🤝'),
      cat('FAMILY', 'Family peace', '#F59E0B', '🏡'),
      cat('COMMUNITY', 'Community & networking', '#8B5CF6', '🌐'),
    ],
  },
  {
    title: 'Work & growth',
    categories: [
      cat('CAREER', 'Career', '#6366F1', '💼'),
      cat('DREAM_JOB', 'Dream job', '#4F46E5', '🚀'),
      cat('BUSINESS', 'Business success', '#7C3AED', '📈'),
      cat('EDUCATION', 'Education & learning', '#3B82F6', '📚'),
      cat('CREATIVITY', 'Creativity', '#8B5CF6', '🎨'),
      cat('FAME', 'Fame / social growth', '#A855F7', '📱'),
    ],
  },
  {
    title: 'Money & lifestyle',
    categories: [
      cat('FINANCE', 'Money & abundance', '#F59E0B', '💰'),
      cat('MONEY', 'Wealth mindset', '#EAB308', '🪙'),
      cat('LUXURY', 'Luxury lifestyle', '#CA8A04', '✨'),
      cat('HOME', 'Home & dream room', '#10B981', '🏠'),
      cat('TRAVEL', 'Travel', '#0EA5E9', '✈️'),
      cat('ADVENTURE', 'Adventure', '#0284C7', '🌍'),
      cat('HAPPINESS', 'Happiness & freedom', '#FBBF24', '☀️'),
    ],
  },
  {
    title: 'Spiritual & soul',
    categories: [
      cat('SPIRITUAL', 'Spiritual growth', '#7C3AED', '🔮'),
      cat('PROTECTION', 'Protection & safety', '#6366F1', '🛡️'),
      cat('MOTHERHOOD', 'Fertility / motherhood', '#FDA4AF', '🍼'),
      cat('OTHER', 'Other dreams', '#8B5CF6', '⭐'),
    ],
  },
];

export const VISION_CATEGORIES: VisionCategoryMeta[] = VISION_CATEGORY_GROUPS.flatMap((g) => g.categories);

const CATEGORY_MAP = new Map(VISION_CATEGORIES.map((c) => [c.id, c]));

export const VISION_BOARD_PRESETS: Array<{
  id: string;
  label: string;
  emoji: string;
  filter: VisionCategory[];
}> = [
  {
    id: 'glow-up',
    label: 'Glow-up board',
    emoji: '✨',
    filter: ['BEAUTY_GLOW', 'SELF_LOVE', 'CONFIDENCE', 'FASHION', 'SOFT_LIFE', 'FEMININE', 'HEALTH', 'HEALTH_FITNESS'],
  },
  {
    id: 'money',
    label: 'Money & luxury',
    emoji: '💰',
    filter: ['FINANCE', 'MONEY', 'LUXURY', 'BUSINESS', 'CAREER'],
  },
  {
    id: 'spiritual',
    label: 'Spiritual & healing',
    emoji: '🕯️',
    filter: ['SPIRITUAL', 'INNER_PEACE', 'HEALING', 'PROTECTION', 'CLARITY'],
  },
  {
    id: 'travel',
    label: 'Travel & dream life',
    emoji: '🌴',
    filter: ['TRAVEL', 'ADVENTURE', 'LUXURY', 'HOME', 'HAPPINESS'],
  },
];

export const VISION_AFFIRMATIONS: Array<{ text: string; category: VisionCategory; emoji: string }> = [
  { text: 'I am magnetic.', category: 'CONFIDENCE', emoji: '✨' },
  { text: 'Money flows easily.', category: 'MONEY', emoji: '💫' },
  { text: 'My life is expanding.', category: 'HAPPINESS', emoji: '🌟' },
  { text: 'I attract healthy love.', category: 'RELATIONSHIPS', emoji: '💕' },
  { text: 'I glow mentally, physically, spiritually.', category: 'BEAUTY_GLOW', emoji: '🌸' },
  { text: 'Everything works in my favor.', category: 'SPIRITUAL', emoji: '🙏' },
  { text: 'I live peacefully and richly.', category: 'LUXURY', emoji: '🏡' },
  { text: 'I am protected and guided.', category: 'PROTECTION', emoji: '🛡️' },
];

export const VISION_INSPIRATIONS: Array<{ title: string; category: VisionCategory; emoji: string }> = [
  { title: 'Dream vacation', category: 'TRAVEL', emoji: '🌴' },
  { title: 'Dream home', category: 'HOME', emoji: '🏡' },
  { title: 'Promote at work', category: 'CAREER', emoji: '🚀' },
  { title: 'Healthy glow-up', category: 'BEAUTY_GLOW', emoji: '✨' },
  { title: 'Emergency fund', category: 'FINANCE', emoji: '🎯' },
  { title: 'Soulmate energy', category: 'MARRIAGE', emoji: '💍' },
  { title: 'Morning routine queen', category: 'DISCIPLINE', emoji: '☀️' },
  { title: 'Peaceful mind', category: 'INNER_PEACE', emoji: '🕊️' },
  { title: 'Dream business', category: 'BUSINESS', emoji: '📈' },
  { title: 'Soft life era', category: 'SOFT_LIFE', emoji: '🌸' },
];

export function categoryMeta(id: VisionCategory): VisionCategoryMeta {
  return CATEGORY_MAP.get(id) || CATEGORY_MAP.get('OTHER')!;
}

export function categoriesInGroup(groupTitle: string): VisionCategoryMeta[] {
  return VISION_CATEGORY_GROUPS.find((g) => g.title === groupTitle)?.categories ?? [];
}
