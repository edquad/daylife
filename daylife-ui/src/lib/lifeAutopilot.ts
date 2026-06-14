import { todayISO } from './format';
import { getVoiceLang, type VoiceLang } from './voiceCommands';

const VOICE_PARSE_URL = (import.meta.env.VITE_VOICE_PARSE_URL || '').trim();
const MEMORY_KEY = 'rozka_ai_memory';
const AUTOPILOT_KEY = 'rozka_autopilot_cache';

export interface MemoryEntry {
  id: string;
  date: string;
  type: 'promise' | 'idea' | 'goal' | 'note' | 'voice_input';
  content: string;
  actionTaken?: boolean;
  actionDate?: string;
}

export interface AutopilotBriefing {
  doToday: string[];
  dontToday: string[];
  spendingWarning?: string;
  healthWarning?: string;
  relationshipReminder?: string;
  highImpactTask?: string;
  regretAlerts: Array<{ task: string; postponeCount: number; daysSinceCreated: number; warning: string }>;
  aiMessage: string;
  _cached_at?: string;
}

// --- AI Memory ---

export function getMemories(): MemoryEntry[] {
  try {
    return JSON.parse(localStorage.getItem(MEMORY_KEY) || '[]');
  } catch {
    return [];
  }
}

export function addMemory(entry: Omit<MemoryEntry, 'id' | 'date'>): void {
  const memories = getMemories();
  memories.push({
    ...entry,
    id: crypto.randomUUID?.() || Math.random().toString(36).slice(2),
    date: new Date().toISOString(),
  });
  if (memories.length > 500) memories.splice(0, memories.length - 500);
  localStorage.setItem(MEMORY_KEY, JSON.stringify(memories));
}

export function markMemoryActioned(id: string): void {
  const memories = getMemories();
  const m = memories.find((e) => e.id === id);
  if (m) {
    m.actionTaken = true;
    m.actionDate = todayISO();
    localStorage.setItem(MEMORY_KEY, JSON.stringify(memories));
  }
}

export function getUnactionedMemories(): MemoryEntry[] {
  return getMemories().filter((m) => !m.actionTaken && (m.type === 'promise' || m.type === 'idea' || m.type === 'goal'));
}

export function getMemorySummary(): { total: number; promises: number; ideas: number; goals: number; unactioned: number } {
  const all = getMemories();
  return {
    total: all.length,
    promises: all.filter((m) => m.type === 'promise').length,
    ideas: all.filter((m) => m.type === 'idea').length,
    goals: all.filter((m) => m.type === 'goal').length,
    unactioned: all.filter((m) => !m.actionTaken && m.type !== 'voice_input').length,
  };
}

function daysBetween(d1: string, d2: string): number {
  return Math.floor((new Date(d2).getTime() - new Date(d1).getTime()) / (1000 * 60 * 60 * 24));
}

export function getStaleMemories(daysThreshold = 30): MemoryEntry[] {
  const today = todayISO();
  return getMemories()
    .filter((m) => !m.actionTaken && m.type !== 'voice_input')
    .filter((m) => daysBetween(m.date.slice(0, 10), today) >= daysThreshold);
}

// --- Autopilot Briefing ---

function getAutopilotCache(): AutopilotBriefing | null {
  try {
    const raw = localStorage.getItem(AUTOPILOT_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as AutopilotBriefing;
    if (!data._cached_at) return null;
    const cachedAt = new Date(data._cached_at).getTime();
    const hoursSince = (Date.now() - cachedAt) / (1000 * 60 * 60);
    if (hoursSince > 4) return null;
    return data;
  } catch {
    return null;
  }
}

function setAutopilotCache(result: AutopilotBriefing): void {
  result._cached_at = new Date().toISOString();
  localStorage.setItem(AUTOPILOT_KEY, JSON.stringify(result));
}

export interface AutopilotContext {
  userName?: string;
  tasksToday: number;
  tasksDone: number;
  overdue: number;
  missedTasks: string[];
  expensesToday: number;
  expensesThisMonth: number;
  expensesLastMonth: number;
  expenseTrend: string;
  routinesPending: number;
  dreams: string[];
  staleMemories: Array<{ content: string; daysSince: number; type: string }>;
  postponedTasks: Array<{ title: string; daysSinceCreated: number }>;
}

export async function fetchAutopilot(context: AutopilotContext): Promise<AutopilotBriefing> {
  const cached = getAutopilotCache();
  if (cached) return cached;

  if (!VOICE_PARSE_URL) {
    return localAutopilot(context);
  }

  const lang = getVoiceLang();

  try {
    const res = await fetch(VOICE_PARSE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'life_autopilot',
        lang,
        context: {
          today: todayISO(),
          selectedDate: todayISO(),
          autopilot: context,
        },
      }),
    });

    if (!res.ok) return localAutopilot(context);
    const json = await res.json();
    if (!json.ok) return localAutopilot(context);

    const result: AutopilotBriefing = {
      doToday: Array.isArray(json.doToday) ? json.doToday.map(String).slice(0, 5) : [],
      dontToday: Array.isArray(json.dontToday) ? json.dontToday.map(String).slice(0, 3) : [],
      spendingWarning: json.spendingWarning || undefined,
      healthWarning: json.healthWarning || undefined,
      relationshipReminder: json.relationshipReminder || undefined,
      highImpactTask: json.highImpactTask || undefined,
      regretAlerts: Array.isArray(json.regretAlerts) ? json.regretAlerts.slice(0, 3) : [],
      aiMessage: String(json.aiMessage || ''),
    };

    setAutopilotCache(result);
    return result;
  } catch {
    return localAutopilot(context);
  }
}

function localAutopilot(ctx: AutopilotContext): AutopilotBriefing {
  const doToday: string[] = [];
  const dontToday: string[] = [];

  if (ctx.overdue > 0) doToday.push(`Clear ${ctx.overdue} overdue task${ctx.overdue > 1 ? 's' : ''}`);
  if (ctx.routinesPending > 0) doToday.push('Complete your morning routine');
  if (ctx.dreams.length > 0) doToday.push(`10 min on "${ctx.dreams[0]}"`);
  if (doToday.length === 0) doToday.push('Plan your day with voice — just tell Rozka');

  if (ctx.expensesThisMonth > ctx.expensesLastMonth * 1.2 && ctx.expensesLastMonth > 0) {
    dontToday.push('Avoid unnecessary purchases — you\'re over budget this month');
  }

  const spendingWarning = ctx.expensesThisMonth > ctx.expensesLastMonth * 1.3 && ctx.expensesLastMonth > 0
    ? `Spending is ${Math.round(((ctx.expensesThisMonth - ctx.expensesLastMonth) / ctx.expensesLastMonth) * 100)}% higher than last month`
    : undefined;

  const regretAlerts = ctx.postponedTasks
    .filter((t) => t.daysSinceCreated > 14)
    .slice(0, 2)
    .map((t) => ({
      task: t.title,
      postponeCount: 0,
      daysSinceCreated: t.daysSinceCreated,
      warning: `"${t.title}" has been pending for ${t.daysSinceCreated} days`,
    }));

  return {
    doToday,
    dontToday,
    spendingWarning,
    regretAlerts,
    aiMessage: ctx.userName
      ? `${ctx.userName}, focus on what matters most today. Small steps > big plans.`
      : 'Focus on what matters most today.',
  };
}

export function autopilotSupported(): boolean {
  return Boolean(VOICE_PARSE_URL);
}
