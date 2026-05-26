import type {
  User,
  Task,
  Expense,
  DailyNote,
  ExpenseCategory,
  ShoppingItem,
  Routine,
  RoutineDayLog,
  Reminder,
} from './api';
import type { HouseholdType } from './household';

const STORAGE_KEY = 'daylife_data';
const SESSION_KEY = 'daylife_session';

export interface AppData {
  users: User[];
  tasks: Task[];
  expenses: Expense[];
  notes: DailyNote[];
  categories: ExpenseCategory[];
  shoppingItems: ShoppingItem[];
  routines: Routine[];
  routineLogs: RoutineDayLog[];
  reminders: Reminder[];
  setupComplete: boolean;
  householdType?: HouseholdType;
  householdName?: string;
  updatedAt?: string;
}

let onDataSaved: ((data: AppData) => void) | null = null;

export function registerDataSaveHook(fn: ((data: AppData) => void) | null): void {
  onDataSaved = fn;
}

export function resolveHouseholdType(data: Pick<AppData, 'householdType' | 'users'>): HouseholdType {
  if (data.householdType) return data.householdType;
  if (data.users.length >= 3) return 'FAMILY';
  if (data.users.length === 2) return 'COUPLE';
  return 'SINGLE';
}

const DEFAULT_CATEGORIES: ExpenseCategory[] = [
  { id: 'cat-groceries', name: 'Groceries', color: '#10B981' },
  { id: 'cat-dining', name: 'Dining Out', color: '#F59E0B' },
  { id: 'cat-transport', name: 'Transport', color: '#3B82F6' },
  { id: 'cat-utilities', name: 'Utilities', color: '#6366F1' },
  { id: 'cat-shopping', name: 'Shopping', color: '#EC4899' },
  { id: 'cat-health', name: 'Health', color: '#EF4444' },
  { id: 'cat-entertainment', name: 'Entertainment', color: '#8B5CF6' },
  { id: 'cat-other', name: 'Other', color: '#6B7280' },
];

function defaultRoutines(): Routine[] {
  return [
    {
      id: 'routine-morning',
      name: 'Morning routine',
      timeOfDay: 'MORNING',
      items: [
        { id: 'm1', label: 'Wake up & stretch' },
        { id: 'm2', label: 'Brush & shower' },
        { id: 'm3', label: 'Breakfast' },
        { id: 'm4', label: 'Check today\'s plan' },
      ],
    },
    {
      id: 'routine-evening',
      name: 'Evening routine',
      timeOfDay: 'EVENING',
      items: [
        { id: 'e1', label: 'Tidy kitchen / living room' },
        { id: 'e2', label: 'Prep for tomorrow' },
        { id: 'e3', label: 'Relax / unwind' },
      ],
    },
  ];
}

function emptyData(): AppData {
  return {
    users: [],
    tasks: [],
    expenses: [],
    notes: [],
    categories: DEFAULT_CATEGORIES,
    shoppingItems: [],
    routines: defaultRoutines(),
    routineLogs: [],
    reminders: [],
    setupComplete: false,
  };
}

export function normalizeAppData(parsed: Partial<AppData>): AppData {
  const merged: AppData = {
    ...emptyData(),
    ...parsed,
    categories: parsed.categories?.length ? parsed.categories : DEFAULT_CATEGORIES,
    shoppingItems: parsed.shoppingItems ?? [],
    routines: parsed.routines?.length ? parsed.routines : defaultRoutines(),
    routineLogs: parsed.routineLogs ?? [],
    reminders: parsed.reminders ?? [],
  };
  const resolvedType = resolveHouseholdType(merged);
  if (merged.householdType !== resolvedType) {
    merged.householdType = resolvedType;
  }
  return merged;
}

export function loadData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyData();
    const parsed = JSON.parse(raw) as AppData;
    const merged = normalizeAppData(parsed);
    if (merged.householdType !== parsed.householdType) {
      saveDataLocal(merged);
    }
    return merged;
  } catch {
    return emptyData();
  }
}

export function saveDataLocal(data: AppData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function saveData(data: AppData): void {
  const stamped: AppData = { ...data, updatedAt: new Date().toISOString() };
  saveDataLocal(stamped);
  onDataSaved?.(stamped);
}

export function getSessionUserId(): string | null {
  return localStorage.getItem(SESSION_KEY);
}

export function setSessionUserId(id: string | null): void {
  if (id) localStorage.setItem(SESSION_KEY, id);
  else localStorage.removeItem(SESSION_KEY);
}

export function uid(): string {
  return crypto.randomUUID();
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function parseQuery(path: string): URLSearchParams {
  const i = path.indexOf('?');
  return new URLSearchParams(i >= 0 ? path.slice(i + 1) : '');
}

export function pathOnly(path: string): string {
  const i = path.indexOf('?');
  return i >= 0 ? path.slice(0, i) : path;
}

export function exportData(): string {
  return JSON.stringify(loadData(), null, 2);
}

export function importData(json: string): void {
  const parsed = JSON.parse(json) as AppData;
  if (!parsed.users || !Array.isArray(parsed.tasks)) {
    throw new Error('Invalid backup file');
  }
  saveData(normalizeAppData(parsed));
}
