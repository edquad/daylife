import type { RoutineItem } from './api';
import { uid } from './storage';

export interface RoutineTemplate {
  id: string;
  label: string;
  items: string[];
}

export const MORNING_ROUTINE_TEMPLATES: RoutineTemplate[] = [
  {
    id: 'morning-1',
    label: 'Option 1',
    items: [
      'Wake up',
      'Drink water',
      'Stretch 5 mins',
      'Deep breathing',
      'Wash face',
      'Simple skincare',
      'Healthy breakfast',
      'Short walk',
      'Journal 3 lines',
      'Plan your day',
    ],
  },
  {
    id: 'morning-2',
    label: 'Option 2',
    items: [
      'Wake up same time',
      'Lemon water',
      'Light workout',
      'Meditation 5 mins',
      'Shower',
      'Tea/coffee',
      'Protein breakfast',
      'Positive affirmations',
      'Clean your space',
      'Start work calmly',
    ],
  },
  {
    id: 'morning-3',
    label: 'Option 3',
    items: [
      'Open windows',
      'Drink water',
      'Neck & shoulder stretch',
      'Calm music',
      'Yoga or walk',
      'Skincare',
      'Fruit breakfast',
      'Gratitude journal',
      'Avoid phone early',
      'Fresh clothes & grooming',
    ],
  },
];

export const EVENING_ROUTINE_TEMPLATES: RoutineTemplate[] = [
  {
    id: 'evening-1',
    label: 'Option 1',
    items: [
      'Evening walk',
      'Wash face',
      'Light stretching',
      'Healthy dinner',
      'Journal thoughts',
      'Meditation',
      'Lip care',
      'Herbal tea',
      'No phone before sleep',
      'Sleep on time',
    ],
  },
  {
    id: 'evening-2',
    label: 'Option 2',
    items: [
      'Shower',
      'Comfortable clothes',
      'Skincare',
      'Calm music',
      'Plan tomorrow',
      'Read something light',
      'Deep breathing',
      'Drink water',
      'Relax',
      'Sleep early',
    ],
  },
  {
    id: 'evening-3',
    label: 'Option 3',
    items: [
      'Clean room a little',
      'Stretch body',
      'Eat light dinner',
      'Talk with loved ones',
      'Gratitude list',
      'Face wash',
      'Hair care optional',
      'Quiet time',
      'Positive thoughts',
      'Sleep peacefully',
    ],
  },
];

export function labelsToRoutineItems(labels: string[]): RoutineItem[] {
  return labels.filter((l) => l.trim()).map((label) => ({ id: uid(), label: label.trim() }));
}

export function templatesForTimeOfDay(timeOfDay: 'MORNING' | 'EVENING' | 'ANY'): RoutineTemplate[] {
  if (timeOfDay === 'MORNING') return MORNING_ROUTINE_TEMPLATES;
  if (timeOfDay === 'EVENING') return EVENING_ROUTINE_TEMPLATES;
  return [];
}

export function defaultMorningItems(): RoutineItem[] {
  return labelsToRoutineItems(MORNING_ROUTINE_TEMPLATES[0].items);
}

export function defaultEveningItems(): RoutineItem[] {
  return labelsToRoutineItems(EVENING_ROUTINE_TEMPLATES[0].items);
}
