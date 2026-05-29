export type DayPhase = 'morning' | 'afternoon' | 'evening';

export function getDayPhase(date = new Date()): DayPhase {
  const hour = date.getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

export function phaseLabel(phase: DayPhase): string {
  if (phase === 'morning') return 'Morning';
  if (phase === 'afternoon') return 'Afternoon';
  return 'Evening';
}

export function phaseGreeting(name?: string, phase = getDayPhase()): string {
  const first = name?.split(' ')[0] || 'there';
  if (phase === 'morning') return `Good morning, ${first}`;
  if (phase === 'afternoon') return `Good afternoon, ${first}`;
  return `Good evening, ${first}`;
}

export function phaseHint(phase: DayPhase): string {
  if (phase === 'morning') return 'Start with your dreams, then morning habits, then today\'s list.';
  if (phase === 'afternoon') return 'Check tasks and shopping — finish strong.';
  return 'Wind down with evening habits and reflect on your day.';
}

export function defaultDailyTab(phase: DayPhase): 'shopping' | 'routines' | 'reminders' {
  if (phase === 'morning' || phase === 'evening') return 'routines';
  return 'shopping';
}

const WELCOME_KEY = 'rozka_welcome_done';

export function isWelcomeDone(): boolean {
  return localStorage.getItem(WELCOME_KEY) === '1';
}

export function markWelcomeDone(): void {
  localStorage.setItem(WELCOME_KEY, '1');
}
