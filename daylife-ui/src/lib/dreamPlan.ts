import { todayISO } from './format';
import { getVoiceLang } from './voiceCommands';

const VOICE_PARSE_URL = (import.meta.env.VITE_VOICE_PARSE_URL || '').trim();
const DREAM_PLAN_CACHE_KEY = 'rozka_dream_plans';

export interface DreamPlan {
  summary: string;
  monthlyTargets: Array<{
    month: number;
    target: string;
    tasks: string[];
  }>;
  weeklyHabits: string[];
  budgetImpact: string;
  risks: string[];
  successProbability: number;
  firstStepToday: string;
}

interface CachedPlan {
  dreamTitle: string;
  plan: DreamPlan;
  generatedAt: string;
}

function getCachedPlans(): CachedPlan[] {
  try {
    return JSON.parse(localStorage.getItem(DREAM_PLAN_CACHE_KEY) || '[]');
  } catch {
    return [];
  }
}

function savePlanCache(title: string, plan: DreamPlan): void {
  const plans = getCachedPlans().filter((p) => p.dreamTitle !== title);
  plans.push({ dreamTitle: title, plan, generatedAt: new Date().toISOString() });
  if (plans.length > 20) plans.splice(0, plans.length - 20);
  localStorage.setItem(DREAM_PLAN_CACHE_KEY, JSON.stringify(plans));
}

export function getCachedDreamPlan(title: string): DreamPlan | null {
  const plans = getCachedPlans();
  const found = plans.find((p) => p.dreamTitle === title);
  return found?.plan ?? null;
}

export async function fetchDreamPlan(dreamTitle: string, category?: string): Promise<DreamPlan> {
  const cached = getCachedDreamPlan(dreamTitle);
  if (cached) return cached;

  if (!VOICE_PARSE_URL) {
    throw new Error('AI not configured');
  }

  const lang = getVoiceLang();

  const res = await fetch(VOICE_PARSE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mode: 'dream_plan',
      lang,
      context: {
        today: todayISO(),
        dream: { title: dreamTitle, category: category || 'OTHER' },
      },
    }),
  });

  if (!res.ok) throw new Error('Failed to generate plan');
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'AI failed');

  const plan: DreamPlan = {
    summary: json.summary || '',
    monthlyTargets: json.monthlyTargets || [],
    weeklyHabits: json.weeklyHabits || [],
    budgetImpact: json.budgetImpact || '',
    risks: json.risks || [],
    successProbability: json.successProbability || 50,
    firstStepToday: json.firstStepToday || '',
  };

  savePlanCache(dreamTitle, plan);
  return plan;
}
