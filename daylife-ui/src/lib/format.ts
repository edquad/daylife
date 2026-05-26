import { addDays, format, isToday, isTomorrow, isYesterday, parseISO } from 'date-fns';

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function shiftDay(iso: string, delta: number): string {
  const d = parseISO(iso);
  return format(addDays(d, delta), 'yyyy-MM-dd');
}

export function formatMoney(value: string | number | null | undefined): string {
  if (value == null || value === '') return '$0.00';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '';
  const date = typeof value === 'string' ? parseISO(value) : value;
  return format(date, 'MMM d, yyyy');
}

export function formatDayHeading(iso: string): string {
  const date = parseISO(iso);
  if (isToday(date)) return 'Today';
  if (isTomorrow(date)) return 'Tomorrow';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'EEEE, MMM d');
}

export function formatDayShort(iso: string): string {
  return format(parseISO(iso), 'EEE, MMM d');
}

export function isSameDay(a: string, b: string): boolean {
  return a.slice(0, 10) === b.slice(0, 10);
}

export function formatMonthHeading(isoMonth: string): string {
  const [year, month] = isoMonth.split('-').map(Number);
  return format(new Date(year, month - 1, 1), 'MMMM yyyy');
}

export function formatYearHeading(year: string | number): string {
  return String(year);
}
