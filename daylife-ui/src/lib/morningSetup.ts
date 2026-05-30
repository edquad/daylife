import { api, type RoutineToday } from './api';
import { todayISO } from './format';
import { getDayPhase } from './dailyFlow';
import type { VoiceAction, VoiceLang } from './voiceCommands';
import { getVoiceLang } from './voiceCommands';
import { executeVoiceActions } from './executeVoiceCommands';

const DONE_KEY = 'rozka_morning_setup_date';
const VOICE_PARSE_URL = (import.meta.env.VITE_VOICE_PARSE_URL || '').trim();

export function morningSetupDoneToday(): boolean {
  return localStorage.getItem(DONE_KEY) === todayISO();
}

export function markMorningSetupDone(): void {
  localStorage.setItem(DONE_KEY, todayISO());
}

export function shouldOfferMorningSetup(): boolean {
  return getDayPhase() === 'morning' && !morningSetupDoneToday();
}

function routineTasks(routines: RoutineToday[]): VoiceAction[] {
  const date = todayISO();
  const titles = new Set<string>();
  for (const r of routines) {
    for (const item of r.items) {
      if (!item.done && item.label.trim()) titles.add(item.label.trim());
    }
  }
  return [...titles].map((title) => ({
    type: 'task' as const,
    title,
    area: 'PERSONAL' as const,
    dueDate: date,
  }));
}

function defaultMorningTasks(): VoiceAction[] {
  const date = todayISO();
  return [
    { type: 'task', title: 'Plan today', area: 'PERSONAL', dueDate: date },
    { type: 'task', title: 'Drink water', area: 'PERSONAL', dueDate: date },
  ];
}

async function fetchAiMorningTasks(routines: RoutineToday[], lang: VoiceLang): Promise<VoiceAction[]> {
  if (!VOICE_PARSE_URL) return [];
  const routineNames = routines.flatMap((r) =>
    r.items.filter((i) => !i.done).map((i) => `${r.name}: ${i.label}`),
  );
  const res = await fetch(VOICE_PARSE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mode: 'morning_setup',
      lang,
      context: {
        today: todayISO(),
        selectedDate: todayISO(),
        routines: routineNames,
        bilingual: true,
      },
    }),
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { ok?: boolean; actions?: VoiceAction[] };
  return data.ok && Array.isArray(data.actions) ? data.actions : [];
}

export async function buildMorningTasks(routines: RoutineToday[]): Promise<VoiceAction[]> {
  const lang = getVoiceLang();
  const fromRoutines = routineTasks(routines);
  try {
    const ai = await fetchAiMorningTasks(routines, lang);
    if (ai.length > 0) return ai;
  } catch {
    /* use local */
  }
  if (fromRoutines.length > 0) return fromRoutines;
  return defaultMorningTasks();
}

export async function runMorningSetup(
  userId: string,
  routines: RoutineToday[],
): Promise<{ added: number; labels: string[] }> {
  const actions = await buildMorningTasks(routines);
  const existing = await api.get<{ data: Array<{ title: string }> }>(
    `/tasks?date=${todayISO()}&status=TODO`,
  );
  const existingTitles = new Set(existing.data.map((t) => t.title.toLowerCase()));
  const toAdd = actions.filter((a) => a.type === 'task' && !existingTitles.has(a.title.toLowerCase()));

  if (toAdd.length === 0) {
    markMorningSetupDone();
    return { added: 0, labels: [] };
  }

  const result = await executeVoiceActions(toAdd, userId);
  markMorningSetupDone();
  return { added: result.ok.length, labels: result.ok };
}
