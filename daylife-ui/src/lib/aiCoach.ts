import { todayISO } from './format';
import type { VoiceAction, VoiceLang } from './voiceCommands';
import { getVoiceLang } from './voiceCommands';

const VOICE_PARSE_URL = (import.meta.env.VITE_VOICE_PARSE_URL || '').trim();
const CACHE_KEY = 'rozka_ai_coach_cache';

export interface LifeSnapshot {
  userName?: string;
  today: string;
  tasksDone: number;
  tasksTotal: number;
  overdueCount: number;
  dreams: string[];
  routinesPending: number;
  shoppingPending: number;
  monthTasksPending: number;
  todayExpenseTotal?: string;
}

export interface AiCoachInsight {
  lesson: string;
  futureStep: string;
  encouragement: string;
  suggestedTasks: VoiceAction[];
  source: 'bedrock' | 'local';
}

function cacheKey(date: string): string {
  return `${CACHE_KEY}_${date}`;
}

function readCache(date: string): AiCoachInsight | null {
  try {
    const raw = localStorage.getItem(cacheKey(date));
    if (!raw) return null;
    return JSON.parse(raw) as AiCoachInsight;
  } catch {
    return null;
  }
}

function writeCache(date: string, insight: AiCoachInsight): void {
  localStorage.setItem(cacheKey(date), JSON.stringify(insight));
}

function localInsight(snapshot: LifeSnapshot, lang: VoiceLang): AiCoachInsight {
  const first = snapshot.userName?.split(' ')[0] || 'friend';
  const hi = lang === 'hi-IN';
  let lesson: string;
  let futureStep: string;
  const suggestedTasks: VoiceAction[] = [];
  const date = snapshot.today || todayISO();

  if (snapshot.overdueCount > 0) {
    lesson = hi
      ? `${snapshot.overdueCount} purane kaam pending hain — aaj sirf ek chota step lo. Perfect hona zaroori nahi.`
      : `${snapshot.overdueCount} overdue items — pick just one small step today. Progress beats perfect.`;
    futureStep = hi
      ? 'Har din ek purana kaam clear karo — future tum khud banate ho.'
      : 'Clear one old task each day — that is how you build your future.';
    suggestedTasks.push({
      type: 'task',
      title: hi ? 'Ek overdue kaam khatam karo' : 'Finish one overdue task',
      area: 'PERSONAL',
      dueDate: date,
    });
  } else if (snapshot.tasksTotal > 0 && snapshot.tasksDone >= snapshot.tasksTotal) {
    lesson = hi
      ? 'Aaj ke saare kaam ho gaye — yahi discipline badi zindagi banati hai.'
      : 'You finished today\'s list — this steady rhythm is how big lives are built.';
    futureStep =
      snapshot.dreams.length > 0
        ? hi
          ? `"${snapshot.dreams[0]}" ke liye kal ek chota step plan karo.`
          : `Plan one small step tomorrow toward "${snapshot.dreams[0]}".`
        : hi
          ? 'Kal ke liye ek naya sapna ya goal likho — AI madad karega.'
          : 'Write one dream or goal for tomorrow — AI will help you plan it.';
  } else if (snapshot.dreams.length > 0) {
    lesson = hi
      ? `Sapna "${snapshot.dreams[0]}" roz ke chote kaam se sach hota hai — aaj 10 minute do.`
      : `Your dream "${snapshot.dreams[0]}" grows with daily action — give it 10 minutes today.`;
    futureStep = hi
      ? 'Har hafte ek task apne sapne se jodo — Rozka AI yaad dilayega.'
      : 'Link one task each week to your dream — Rozka AI will remind you.';
    suggestedTasks.push({
      type: 'task',
      title: hi ? `${snapshot.dreams[0]} — aaj ka step` : `Step toward ${snapshot.dreams[0]}`,
      area: 'PERSONAL',
      dueDate: date,
    });
  } else if (snapshot.routinesPending > 0) {
    lesson = hi
      ? 'Subah ki aadaten tumhari zindagi banati hain — ek routine aaj poori karo.'
      : 'Morning habits shape your life — complete one routine item today.';
    futureStep = hi
        ? 'Daily lists se future plan banta hai — roz thoda, lambi race jeetoge.'
        : 'Daily lists become your future plan — small steps win the long race.';
  } else {
    lesson = hi
      ? 'Choti aadaten badi zindagi banati hain — aaj ek kaam likho aur karo.'
      : 'Small habits build a big life — write one task and do it today.';
    futureStep = hi
      ? 'Dreams page par apna future likho — AI usse daily tasks banayega.'
      : 'Add your dreams on the Dreams page — AI turns them into daily tasks.';
    suggestedTasks.push({
      type: 'task',
      title: hi ? 'Aaj ka plan likho' : 'Plan today',
      area: 'PERSONAL',
      dueDate: date,
    });
  }

  const encouragement = hi
    ? `${first}, tum sahi raaste par ho — Rozka AI tumhare saath hai.`
    : `${first}, you're on the right path — Rozka AI is with you.`;

  return { lesson, futureStep, encouragement, suggestedTasks, source: 'local' };
}

async function fetchBedrockInsight(snapshot: LifeSnapshot, lang: VoiceLang): Promise<AiCoachInsight | null> {
  if (!VOICE_PARSE_URL) return null;
  const res = await fetch(VOICE_PARSE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mode: 'life_coach',
      lang,
      context: {
        today: snapshot.today,
        snapshot,
        bilingual: true,
      },
    }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    ok?: boolean;
    lesson?: string;
    futureStep?: string;
    encouragement?: string;
    suggestedTasks?: VoiceAction[];
  };
  if (!data.ok || !data.lesson) return null;
  return {
    lesson: data.lesson,
    futureStep: data.futureStep || '',
    encouragement: data.encouragement || '',
    suggestedTasks: Array.isArray(data.suggestedTasks) ? data.suggestedTasks : [],
    source: 'bedrock',
  };
}

export async function getAiCoachInsight(
  snapshot: LifeSnapshot,
  opts?: { refresh?: boolean },
): Promise<AiCoachInsight> {
  const date = snapshot.today || todayISO();
  const lang = getVoiceLang();

  if (!opts?.refresh) {
    const cached = readCache(date);
    if (cached) return cached;
  }

  try {
    const ai = await fetchBedrockInsight(snapshot, lang);
    if (ai) {
      writeCache(date, ai);
      return ai;
    }
  } catch {
    /* local fallback */
  }

  const local = localInsight(snapshot, lang);
  writeCache(date, local);
  return local;
}

export function aiCoachSupported(): boolean {
  return Boolean(VOICE_PARSE_URL);
}
