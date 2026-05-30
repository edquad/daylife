import { addDays, format, parseISO, startOfWeek, endOfWeek } from 'date-fns';
import { api, type CalendarEvent } from './api';
import { todayISO } from './format';
import type { VoiceAction, VoiceLang } from './voiceCommands';
import { getVoiceLang } from './voiceCommands';

const VOICE_PARSE_URL = (import.meta.env.VITE_VOICE_PARSE_URL || '').trim();

export interface AiCalendarPlan {
  summary: string;
  actions: VoiceAction[];
  source: 'bedrock' | 'local';
}

function weekRange(anchor: string): { from: string; to: string } {
  const d = parseISO(anchor);
  return {
    from: format(startOfWeek(d, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
    to: format(endOfWeek(d, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
  };
}

function localPlan(events: CalendarEvent[], from: string, to: string, lang: VoiceLang): AiCalendarPlan {
  const hi = lang === 'hi-IN';
  const taskEvents = events.filter((e) => e.kind === 'task' && !e.done);
  const reminders = events.filter((e) => e.kind === 'reminder');
  const actions: VoiceAction[] = [];

  let d = from;
  let dayIdx = 0;
  const pending = [...taskEvents];
  while (d <= to && pending.length > 0 && dayIdx < 5) {
    const t = pending.shift()!;
    actions.push({
      type: 'task',
      title: t.title,
      area: 'PERSONAL',
      dueDate: d,
    });
    d = format(addDays(parseISO(d), 1), 'yyyy-MM-dd');
    dayIdx++;
  }

  if (actions.length === 0 && reminders.length === 0) {
    actions.push(
      { type: 'task', title: hi ? 'Subah ki planning' : 'Morning planning', area: 'PERSONAL', dueDate: from },
      { type: 'task', title: hi ? 'Important kaam' : 'Priority task', area: 'PERSONAL', dueDate: format(addDays(parseISO(from), 1), 'yyyy-MM-dd') },
    );
  }

  const summary = hi
    ? `Is hafte ${actions.length} AI tasks plan ki — roz thoda, stress kam.`
    : `AI spread ${actions.length} tasks across your week — steady pace, less stress.`;

  return { summary, actions, source: 'local' };
}

async function fetchBedrockPlan(
  events: CalendarEvent[],
  from: string,
  to: string,
  lang: VoiceLang,
): Promise<AiCalendarPlan | null> {
  if (!VOICE_PARSE_URL) return null;
  const res = await fetch(VOICE_PARSE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mode: 'calendar_plan',
      lang,
      context: {
        from,
        to,
        today: todayISO(),
        events: events.slice(0, 40).map((e) => ({
          kind: e.kind,
          date: e.date,
          title: e.title,
          done: e.done,
        })),
      },
    }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    ok?: boolean;
    summary?: string;
    actions?: VoiceAction[];
  };
  if (!data.ok) return null;
  return {
    summary: data.summary || '',
    actions: Array.isArray(data.actions) ? data.actions : [],
    source: 'bedrock',
  };
}

export async function aiPlanCalendarWeek(anchorDate: string): Promise<AiCalendarPlan> {
  const lang = getVoiceLang();
  const { from, to } = weekRange(anchorDate);
  const { events } = await api.get<{ events: CalendarEvent[] }>(
    `/calendar/events?from=${from}&to=${to}`,
  );

  try {
    const ai = await fetchBedrockPlan(events, from, to, lang);
    if (ai && ai.actions.length > 0 && ai.summary) return ai;
  } catch {
    /* local */
  }

  return localPlan(events, from, to, lang);
}

export function monthBounds(monthKey: string): { from: string; to: string } {
  const [y, m] = monthKey.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  return {
    from: `${monthKey}-01`,
    to: `${monthKey}-${String(last).padStart(2, '0')}`,
  };
}
