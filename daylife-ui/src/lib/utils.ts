import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const AREA_LABELS: Record<string, string> = {
  PERSONAL: 'Personal',
  WORK: 'Work',
  HOME: 'Home',
};

export const AREA_COLORS: Record<string, string> = {
  PERSONAL: 'bg-blue-100 text-blue-700',
  WORK: 'bg-amber-100 text-amber-700',
  HOME: 'bg-green-100 text-green-700',
};

export const PRIORITY_COLORS: Record<string, string> = {
  LOW: 'text-gray-400',
  MEDIUM: 'text-brand-600',
  HIGH: 'text-red-600',
};

export function memberGridClass(count: number): string {
  if (count <= 1) return 'grid grid-cols-1 gap-5';
  if (count === 2) return 'grid grid-cols-1 lg:grid-cols-2 gap-5';
  return 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5';
}
