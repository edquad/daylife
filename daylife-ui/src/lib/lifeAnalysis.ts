import { api, Task, Expense, RoutineToday, ShoppingItem, VisionBoardItemEnriched } from './api';
import { todayISO } from './format';
import { getVoiceLang, type VoiceLang, type VoiceAction } from './voiceCommands';

const VOICE_PARSE_URL = (import.meta.env.VITE_VOICE_PARSE_URL || '').trim();
const CACHE_KEY = 'rozka_life_dashboard_cache';

export interface LifeDashboardResult {
  life_score: number;
  productivity_score: number;
  financial_score: number;
  health_score: number;
  consistency_score: number;
  top_strengths: string[];
  top_weaknesses: string[];
  hidden_patterns: string[];
  future_predictions: string[];
  goal_progress: Array<{ goal: string; progress_pct: number; next_step: string }>;
  life_loopholes: Array<{ problem: string; evidence: string; fix: string; priority: 'high' | 'medium' | 'low' }>;
  spending_insight: string;
  weekly_wins: string[];
  weekly_misses: string[];
  recommended_actions: VoiceAction[];
  ai_coach_message: string;
  morning_briefing: string;
  _cached_at?: string;
}

export function lifeDashboardSupported(): boolean {
  return Boolean(VOICE_PARSE_URL);
}

function getCached(): LifeDashboardResult | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as LifeDashboardResult;
    if (!data._cached_at) return null;
    const age = Date.now() - new Date(data._cached_at).getTime();
    if (age > 1000 * 60 * 60 * 4) return null;
    return data;
  } catch {
    return null;
  }
}

function setCache(result: LifeDashboardResult): void {
  result._cached_at = new Date().toISOString();
  localStorage.setItem(CACHE_KEY, JSON.stringify(result));
}

function dateOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function monthOffset(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

interface CollectedData {
  userName?: string;
  today: string;
  tasksToday: { total: number; done: number; overdue: number };
  tasksThisWeek: { total: number; done: number };
  tasksThisMonth: { total: number; done: number };
  tasksLastMonth: { total: number; done: number };
  expensesToday: number;
  expensesThisMonth: number;
  expensesLastMonth: number;
  topCategoriesThisMonth: Array<{ name: string; total: number }>;
  topCategoriesLastMonth: Array<{ name: string; total: number }>;
  routines: Array<{ name: string; done: number; total: number }>;
  shoppingPending: number;
  dreams: string[];
  recentTaskTitles: string[];
  missedTasks: string[];
  taskCompletionRate7Days: number;
  expenseLast7Days: number;
  expenseTrend: string;
}

async function collectLifeData(userId?: string): Promise<CollectedData> {
  const today = todayISO();
  const weekAgo = dateOffset(-7);
  const lastMonthDate = monthOffset(-1);

  const [dashboard, shopping, routinesData, vision] = await Promise.all([
    api.get<any>(`/dashboard/summary?date=${today}`),
    api.get<{ data: ShoppingItem[] }>('/shopping'),
    api.get<{ routines: RoutineToday[] }>(`/routines/today?date=${today}`),
    api.get<VisionBoardItemEnriched[]>('/vision-board?achieved=false').catch(() => []),
  ]);

  let expenseReportThisMonth: any = null;
  let expenseReportLastMonth: any = null;
  let allTasks: any[] = [];

  try {
    expenseReportThisMonth = await api.get(`/expenses/report?period=monthly&date=${today}`);
  } catch { /* ok */ }

  try {
    expenseReportLastMonth = await api.get(`/expenses/report?period=monthly&date=${lastMonthDate}`);
  } catch { /* ok */ }

  try {
    const taskRes = await api.get<{ data: Task[] }>('/tasks?limit=200');
    allTasks = taskRes?.data ?? [];
  } catch { /* ok */ }

  const byPerson = dashboard?.byPerson ?? [];
  const todayTasks = byPerson.flatMap((p: any) => p.tasks as Task[]);
  const doneTasks = todayTasks.filter((t: Task) => t.status === 'DONE');
  const overdue = dashboard?.overdueCount ?? 0;

  const routines = (routinesData?.routines ?? []).map((r) => ({
    name: r.name,
    done: r.done,
    total: r.total,
  }));

  const shoppingItems = shopping?.data ?? [];
  const shoppingPending = shoppingItems.filter((i) => !i.checked).length;
  const dreams = (vision as VisionBoardItemEnriched[] || []).map((v) => v.title).slice(0, 5);

  const topCategoriesThisMonth = (expenseReportThisMonth?.categories ?? [])
    .sort((a: any, b: any) => b.total - a.total)
    .slice(0, 5)
    .map((c: any) => ({ name: c.name, total: c.total }));

  const topCategoriesLastMonth = (expenseReportLastMonth?.categories ?? [])
    .sort((a: any, b: any) => b.total - a.total)
    .slice(0, 5)
    .map((c: any) => ({ name: c.name, total: c.total }));

  const thisMonthTasks = allTasks.filter((t) => t.dueDate && t.dueDate.startsWith(today.slice(0, 7)));
  const lastMonthTasks = allTasks.filter((t) => t.dueDate && t.dueDate.startsWith(lastMonthDate.slice(0, 7)));

  const recentWeekTasks = allTasks.filter((t) => t.dueDate && t.dueDate >= weekAgo && t.dueDate <= today);
  const recentWeekDone = recentWeekTasks.filter((t) => t.status === 'DONE').length;
  const taskCompletionRate7Days = recentWeekTasks.length > 0 ? Math.round((recentWeekDone / recentWeekTasks.length) * 100) : 0;

  const missedTasks = allTasks
    .filter((t) => t.status !== 'DONE' && t.dueDate && t.dueDate < today)
    .slice(0, 5)
    .map((t) => t.title);

  const expensesThisMonth = expenseReportThisMonth?.total ?? 0;
  const expensesLastMonth = expenseReportLastMonth?.total ?? 0;
  let expenseTrend = 'stable';
  if (expensesLastMonth > 0) {
    const change = ((expensesThisMonth - expensesLastMonth) / expensesLastMonth) * 100;
    if (change > 20) expenseTrend = `up ${Math.round(change)}% vs last month`;
    else if (change < -20) expenseTrend = `down ${Math.round(Math.abs(change))}% vs last month`;
    else expenseTrend = 'roughly same as last month';
  }

  let expenseLast7Days = 0;
  try {
    for (let i = 0; i < 7; i++) {
      const d = dateOffset(-i);
      const dayRes = await api.get<{ total: number }>(`/expenses?date=${d}&limit=1`);
      expenseLast7Days += dayRes?.total ?? 0;
    }
  } catch {
    expenseLast7Days = parseFloat(dashboard?.todayExpenseTotal ?? '0') * 7;
  }

  return {
    userName: undefined,
    today,
    tasksToday: { total: todayTasks.length, done: doneTasks.length, overdue },
    tasksThisWeek: { total: recentWeekTasks.length, done: recentWeekDone },
    tasksThisMonth: { total: thisMonthTasks.length, done: thisMonthTasks.filter((t) => t.status === 'DONE').length },
    tasksLastMonth: { total: lastMonthTasks.length, done: lastMonthTasks.filter((t) => t.status === 'DONE').length },
    expensesToday: parseFloat(dashboard?.todayExpenseTotal ?? '0') || 0,
    expensesThisMonth,
    expensesLastMonth,
    topCategoriesThisMonth,
    topCategoriesLastMonth,
    routines,
    shoppingPending,
    dreams,
    recentTaskTitles: todayTasks.slice(0, 10).map((t: Task) => t.title),
    missedTasks,
    taskCompletionRate7Days,
    expenseLast7Days,
    expenseTrend,
  };
}

export async function fetchLifeDashboard(opts?: {
  refresh?: boolean;
  userId?: string;
  userName?: string;
}): Promise<LifeDashboardResult> {
  if (!opts?.refresh) {
    const cached = getCached();
    if (cached) return cached;
  }

  if (!VOICE_PARSE_URL) {
    return localFallback();
  }

  const lang = getVoiceLang();
  const data = await collectLifeData(opts?.userId);
  if (opts?.userName) data.userName = opts.userName;

  const res = await fetch(VOICE_PARSE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mode: 'life_dashboard',
      lang,
      context: {
        today: data.today,
        selectedDate: data.today,
        lifeData: data,
        snapshot: data,
      },
    }),
  });

  if (!res.ok) {
    return localFallback();
  }

  const json = await res.json();
  if (!json.ok) {
    return localFallback();
  }

  const result: LifeDashboardResult = {
    life_score: json.life_score ?? 0,
    productivity_score: json.productivity_score ?? 0,
    financial_score: json.financial_score ?? 0,
    health_score: json.health_score ?? 0,
    consistency_score: json.consistency_score ?? 0,
    top_strengths: json.top_strengths ?? [],
    top_weaknesses: json.top_weaknesses ?? [],
    hidden_patterns: json.hidden_patterns ?? [],
    future_predictions: json.future_predictions ?? [],
    goal_progress: json.goal_progress ?? [],
    life_loopholes: json.life_loopholes ?? [],
    spending_insight: json.spending_insight ?? '',
    weekly_wins: json.weekly_wins ?? [],
    weekly_misses: json.weekly_misses ?? [],
    recommended_actions: json.recommended_actions ?? [],
    ai_coach_message: json.ai_coach_message ?? '',
    morning_briefing: json.morning_briefing ?? '',
  };

  setCache(result);
  return result;
}

function localFallback(): LifeDashboardResult {
  return {
    life_score: 50,
    productivity_score: 50,
    financial_score: 50,
    health_score: 50,
    consistency_score: 50,
    top_strengths: ['You are using Rozka to organize life'],
    top_weaknesses: ['Need more data to analyze patterns'],
    hidden_patterns: ['Keep logging tasks and expenses for AI insights'],
    future_predictions: ['With consistent use, your productivity will improve'],
    goal_progress: [],
    life_loopholes: [],
    spending_insight: 'Log more expenses to see spending patterns',
    weekly_wins: [],
    weekly_misses: [],
    recommended_actions: [],
    ai_coach_message: 'Keep using Rozka daily — the AI needs at least a week of data to give you real insights.',
    morning_briefing: 'Start your day by adding tasks and logging expenses.',
  };
}
