import {
  loadData,
  saveData,
  getSessionUserId,
  setSessionUserId,
  uid,
  todayISO,
  parseQuery,
  pathOnly,
  resolveHouseholdType,
} from './storage';
import {
  type HouseholdType,
  type SetupPayload,
  MEMBER_COLORS,
  MAX_HOUSEHOLD_SIZE,
  nextMemberColor,
} from './household';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public error?: { code: string; message: string },
  ) {
    super(message);
  }
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  color: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  area: 'PERSONAL' | 'WORK' | 'HOME';
  status: 'TODO' | 'IN_PROGRESS' | 'DONE';
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  dueDate?: string;
  completedAt?: string;
  assignee?: { id: string; name: string; color: string };
  assigneeId?: string;
  createdBy?: { id: string; name: string };
  createdById?: string;
}

export interface Expense {
  id: string;
  amount: string;
  description?: string;
  expenseDate: string;
  category: { id: string; name: string; color: string };
  paidBy: { id: string; name: string; color: string };
}

export interface DailyNote {
  id: string;
  content: string;
  area: 'PERSONAL' | 'WORK' | 'HOME';
  noteDate: string;
  author: { id: string; name: string; color: string };
}

export interface ExpenseCategory {
  id: string;
  name: string;
  color: string;
}

export type ShoppingCategory = 'GROCERIES' | 'HOME' | 'PHARMACY' | 'OTHER';

export interface ShoppingItem {
  id: string;
  name: string;
  quantity?: string;
  category: ShoppingCategory;
  checked: boolean;
  addedById?: string;
  createdAt: string;
}

export interface RoutineItem {
  id: string;
  label: string;
}

export interface Routine {
  id: string;
  name: string;
  timeOfDay: 'MORNING' | 'EVENING' | 'ANY';
  items: RoutineItem[];
}

export interface RoutineDayLog {
  routineId: string;
  date: string;
  doneItemIds: string[];
}

export type ReminderRepeat = 'NONE' | 'MONTHLY' | 'YEARLY';

export interface Reminder {
  id: string;
  title: string;
  dueDate: string;
  repeat: ReminderRepeat;
  notes?: string;
  createdById?: string;
}

export type VisionCategory =
  | 'TRAVEL'
  | 'HOME'
  | 'CAREER'
  | 'HEALTH'
  | 'FINANCE'
  | 'RELATIONSHIP'
  | 'OTHER';

export interface VisionBoardItem {
  id: string;
  title: string;
  caption?: string;
  imageUrl?: string;
  emoji?: string;
  category: VisionCategory;
  color: string;
  achieved: boolean;
  ownerId?: string;
  createdById?: string;
  createdAt: string;
}

export interface VisionBoardItemEnriched extends VisionBoardItem {
  owner?: { id: string; name: string; color: string };
  createdBy?: { id: string; name: string };
}

export interface RoutineToday {
  id: string;
  name: string;
  timeOfDay: Routine['timeOfDay'];
  done: number;
  total: number;
  items: Array<RoutineItem & { done: boolean }>;
}

export interface UpcomingReminder {
  id: string;
  title: string;
  nextDate: string;
  repeat: ReminderRepeat;
  notes?: string;
  daysUntil: number;
}

export interface HouseholdInfo {
  householdType: HouseholdType;
  householdName?: string;
  members: User[];
}

function buildUsersFromSetup(payload: SetupPayload): User[] {
  const { householdType, name, partnerName, memberNames = [], householdName } = payload;
  const owner: User = {
    id: uid(),
    email: `${name.toLowerCase().replace(/\s+/g, '')}@local`,
    name: name.trim(),
    role: 'OWNER',
    color: MEMBER_COLORS[0],
  };
  const users: User[] = [owner];

  if (householdType === 'COUPLE') {
    if (!partnerName?.trim()) throw new ApiError(400, 'Partner name is required');
    users.push({
      id: uid(),
      email: `${partnerName.toLowerCase().replace(/\s+/g, '')}@local`,
      name: partnerName.trim(),
      role: 'PARTNER',
      color: MEMBER_COLORS[1],
    });
  }

  if (householdType === 'FAMILY') {
    const names = memberNames.map((n) => n.trim()).filter(Boolean);
    if (names.length < 1) throw new ApiError(400, 'Add at least one family member');
    if (names.length + 1 > MAX_HOUSEHOLD_SIZE) {
      throw new ApiError(400, `Maximum ${MAX_HOUSEHOLD_SIZE} people in a household`);
    }
    names.forEach((memberName, index) => {
      users.push({
        id: uid(),
        email: `${memberName.toLowerCase().replace(/\s+/g, '')}-${index}@local`,
        name: memberName,
        role: index === 0 ? 'PARTNER' : 'MEMBER',
        color: MEMBER_COLORS[(index + 1) % MEMBER_COLORS.length],
      });
    });
  }

  void householdName;
  return users;
}

function userRef(u: User) {
  return { id: u.id, name: u.name, color: u.color };
}

function findUser(data: ReturnType<typeof loadData>, id: string) {
  return data.users.find((u) => u.id === id);
}

function enrichTask(data: ReturnType<typeof loadData>, task: Task): Task {
  const assignee = task.assigneeId ? findUser(data, task.assigneeId) : undefined;
  const createdBy = task.createdById ? findUser(data, task.createdById) : undefined;
  return {
    ...task,
    assignee: assignee ? userRef(assignee) : undefined,
    createdBy: createdBy ? { id: createdBy.id, name: createdBy.name } : undefined,
  };
}

function enrichExpense(data: ReturnType<typeof loadData>, exp: Expense & { categoryId?: string; paidById?: string }): Expense {
  const category = data.categories.find((c) => c.id === (exp as any).categoryId || c.id === exp.category?.id);
  const paidBy = findUser(data, (exp as any).paidById || exp.paidBy?.id || '');
  return {
    id: exp.id,
    amount: exp.amount,
    description: exp.description,
    expenseDate: exp.expenseDate,
    category: category || { id: 'cat-other', name: 'Other', color: '#6B7280' },
    paidBy: paidBy ? userRef(paidBy) : { id: '', name: 'Unknown', color: '#6B7280' },
  };
}

function enrichNote(data: ReturnType<typeof loadData>, note: DailyNote & { authorId?: string }): DailyNote {
  const author = findUser(data, note.authorId || note.author?.id || '');
  return {
    id: note.id,
    content: note.content,
    area: note.area,
    noteDate: note.noteDate,
    author: author ? userRef(author) : { id: '', name: 'Unknown', color: '#6B7280' },
  };
}

function enrichVision(data: ReturnType<typeof loadData>, item: VisionBoardItem): VisionBoardItem & {
  owner?: { id: string; name: string; color: string };
  createdBy?: { id: string; name: string };
} {
  const owner = item.ownerId ? findUser(data, item.ownerId) : undefined;
  const createdBy = item.createdById ? findUser(data, item.createdById) : undefined;
  return {
    ...item,
    owner: owner ? userRef(owner) : undefined,
    createdBy: createdBy ? { id: createdBy.id, name: createdBy.name } : undefined,
  };
}

function filterTasks(data: ReturnType<typeof loadData>, q: URLSearchParams) {
  let tasks = [...data.tasks];
  const area = q.get('area');
  const status = q.get('status');
  const assigneeId = q.get('assigneeId');
  const due = q.get('due');
  const date = q.get('date');
  const month = q.get('month');
  const search = q.get('search');

  if (area) tasks = tasks.filter((t) => t.area === area);
  if (status) tasks = tasks.filter((t) => t.status === status);
  if (assigneeId) tasks = tasks.filter((t) => t.assigneeId === assigneeId);
  if (date) tasks = tasks.filter((t) => t.dueDate?.slice(0, 10) === date);
  if (month) tasks = tasks.filter((t) => t.dueDate?.slice(0, 7) === month);
  if (due === 'today') tasks = tasks.filter((t) => t.dueDate?.slice(0, 10) === todayISO());
  if (due === 'overdue') {
    const today = todayISO();
    tasks = tasks.filter((t) => t.dueDate && t.dueDate.slice(0, 10) < today && t.status !== 'DONE');
  }
  if (search?.trim()) {
    const s = search.trim().toLowerCase();
    tasks = tasks.filter(
      (t) => t.title.toLowerCase().includes(s) || t.description?.toLowerCase().includes(s),
    );
  }

  tasks.sort((a, b) => {
    const statusOrder = { TODO: 0, IN_PROGRESS: 1, DONE: 2 };
    if (statusOrder[a.status] !== statusOrder[b.status]) return statusOrder[a.status] - statusOrder[b.status];
    if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
    return 0;
  });

  const limit = parseInt(q.get('limit') || '50', 10);
  return tasks.slice(0, limit).map((t) => enrichTask(data, t));
}

function filterExpenses(data: ReturnType<typeof loadData>, q: URLSearchParams) {
  let expenses = [...data.expenses];
  const from = q.get('from');
  const to = q.get('to');
  const date = q.get('date');
  const month = q.get('month');
  const year = q.get('year');
  const categoryId = q.get('categoryId');
  const paidById = q.get('paidById');
  const search = q.get('search');

  if (date) expenses = expenses.filter((e) => e.expenseDate.slice(0, 10) === date);
  if (month) expenses = expenses.filter((e) => e.expenseDate.slice(0, 7) === month);
  if (year) expenses = expenses.filter((e) => e.expenseDate.slice(0, 4) === year);
  if (from) expenses = expenses.filter((e) => e.expenseDate.slice(0, 10) >= from);
  if (to) expenses = expenses.filter((e) => e.expenseDate.slice(0, 10) <= to);
  if (categoryId) expenses = expenses.filter((e) => (e as any).categoryId === categoryId);
  if (paidById) expenses = expenses.filter((e) => (e as any).paidById === paidById);
  if (search?.trim()) {
    const s = search.trim().toLowerCase();
    expenses = expenses.filter((e) => {
      const enriched = enrichExpense(data, e as any);
      return (
        e.description?.toLowerCase().includes(s) ||
        enriched.category.name.toLowerCase().includes(s)
      );
    });
  }

  expenses.sort((a, b) => b.expenseDate.localeCompare(a.expenseDate));
  const limit = parseInt(q.get('limit') || '50', 10);
  return expenses.slice(0, limit).map((e) => enrichExpense(data, e as any));
}

type ReportPeriod = 'daily' | 'monthly' | 'yearly';

function expenseReportRange(period: ReportPeriod, anchor: string) {
  const day = anchor.slice(0, 10);
  if (period === 'daily') {
    return { from: day, to: day, label: day };
  }
  if (period === 'monthly') {
    const month = day.slice(0, 7);
    const [y, m] = month.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    return { from: `${month}-01`, to: `${month}-${String(lastDay).padStart(2, '0')}`, label: month };
  }
  const year = day.slice(0, 4);
  return { from: `${year}-01-01`, to: `${year}-12-31`, label: year };
}

function expenseReport(data: ReturnType<typeof loadData>, q: URLSearchParams) {
  const period = (q.get('period') || 'daily') as ReportPeriod;
  const anchor = q.get('date') || todayISO();
  const { from, to, label } = expenseReportRange(period, anchor);

  let expenses = data.expenses.filter((e) => {
    const d = e.expenseDate.slice(0, 10);
    return d >= from && d <= to;
  });

  const categoryId = q.get('categoryId');
  const paidById = q.get('paidById');
  const search = q.get('search');
  if (categoryId) expenses = expenses.filter((e) => (e as any).categoryId === categoryId);
  if (paidById) expenses = expenses.filter((e) => (e as any).paidById === paidById);
  if (search?.trim()) {
    const s = search.trim().toLowerCase();
    expenses = expenses.filter((e) => {
      const enriched = enrichExpense(data, e as any);
      return (
        e.description?.toLowerCase().includes(s) ||
        enriched.category.name.toLowerCase().includes(s)
      );
    });
  }

  expenses.sort((a, b) => b.expenseDate.localeCompare(a.expenseDate));
  const enriched = expenses.map((e) => enrichExpense(data, e as any));
  const total = enriched.reduce((sum, e) => sum + parseFloat(e.amount), 0);

  const categoryMap = new Map<string, { id: string; name: string; color: string; total: number; count: number }>();
  for (const exp of enriched) {
    const key = exp.category.id;
    const row = categoryMap.get(key) || { id: key, name: exp.category.name, color: exp.category.color, total: 0, count: 0 };
    row.total += parseFloat(exp.amount);
    row.count += 1;
    categoryMap.set(key, row);
  }

  const personMap = new Map<string, { userId: string; name: string; color: string; total: number; count: number }>();
  for (const exp of enriched) {
    const key = exp.paidBy.id;
    const row = personMap.get(key) || { userId: key, name: exp.paidBy.name, color: exp.paidBy.color, total: 0, count: 0 };
    row.total += parseFloat(exp.amount);
    row.count += 1;
    personMap.set(key, row);
  }

  return {
    period,
    label,
    from,
    to,
    total: total.toFixed(2),
    count: enriched.length,
    byCategory: [...categoryMap.values()]
      .sort((a, b) => b.total - a.total)
      .map((c) => ({ ...c, total: c.total.toFixed(2) })),
    byPerson: [...personMap.values()]
      .sort((a, b) => b.total - a.total)
      .map((p) => ({ ...p, total: p.total.toFixed(2) })),
    expenses: enriched,
  };
}

function daysBetween(from: string, to: string): number {
  const a = new Date(from.slice(0, 10));
  const b = new Date(to.slice(0, 10));
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

function addDaysISO(iso: string, days: number): string {
  const d = new Date(iso.slice(0, 10));
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function nextReminderDate(reminder: Reminder, after: string): string | null {
  const today = after.slice(0, 10);
  const due = reminder.dueDate.slice(0, 10);

  if (reminder.repeat === 'NONE') {
    return due >= today ? due : null;
  }

  if (reminder.repeat === 'YEARLY') {
    const mmdd = due.slice(5);
    for (let i = 0; i <= 366; i++) {
      const candidate = addDaysISO(today, i);
      if (candidate.slice(5) === mmdd) return candidate;
    }
    return null;
  }

  const dayNum = parseInt(due.slice(8, 10), 10);
  for (let i = 0; i <= 62; i++) {
    const candidate = addDaysISO(today, i);
    const lastDay = new Date(parseInt(candidate.slice(0, 4), 10), parseInt(candidate.slice(5, 7), 10), 0).getDate();
    const targetDay = Math.min(dayNum, lastDay);
    if (parseInt(candidate.slice(8, 10), 10) === targetDay) return candidate;
  }
  return null;
}

function upcomingReminders(data: ReturnType<typeof loadData>, fromDate: string, days = 14): UpcomingReminder[] {
  const end = addDaysISO(fromDate, days);
  const results: UpcomingReminder[] = [];
  for (const r of data.reminders) {
    const nextDate = nextReminderDate(r, fromDate);
    if (!nextDate || nextDate > end) continue;
    results.push({
      id: r.id,
      title: r.title,
      nextDate,
      repeat: r.repeat,
      notes: r.notes,
      daysUntil: daysBetween(fromDate, nextDate),
    });
  }
  return results.sort((a, b) => a.nextDate.localeCompare(b.nextDate));
}

function routinesForDay(data: ReturnType<typeof loadData>, date: string): RoutineToday[] {
  return data.routines.map((routine) => {
    const log = data.routineLogs.find((l) => l.routineId === routine.id && l.date.slice(0, 10) === date.slice(0, 10));
    const doneIds = new Set(log?.doneItemIds ?? []);
    const items = routine.items.map((item) => ({ ...item, done: doneIds.has(item.id) }));
    const done = items.filter((i) => i.done).length;
    return {
      id: routine.id,
      name: routine.name,
      timeOfDay: routine.timeOfDay,
      done,
      total: items.length,
      items,
    };
  });
}

function filterNotes(data: ReturnType<typeof loadData>, q: URLSearchParams) {
  let notes = [...data.notes];
  const area = q.get('area');
  const from = q.get('from');
  const to = q.get('to');
  if (area) notes = notes.filter((n) => n.area === area);
  if (from) notes = notes.filter((n) => n.noteDate.slice(0, 10) >= from);
  if (to) notes = notes.filter((n) => n.noteDate.slice(0, 10) <= to);
  notes.sort((a, b) => b.noteDate.localeCompare(a.noteDate));
  const limit = parseInt(q.get('limit') || '30', 10);
  return notes.slice(0, limit).map((n) => enrichNote(data, n as any));
}

function dashboardSummary(data: ReturnType<typeof loadData>, dateParam?: string) {
  const day = dateParam || todayISO();
  const monthPrefix = day.slice(0, 7);

  const dayTasks = data.tasks
    .filter((t) => t.dueDate?.slice(0, 10) === day)
    .map((t) => enrichTask(data, t));

  const monthTasks = data.tasks
    .filter((t) => t.dueDate?.slice(0, 7) === monthPrefix)
    .map((t) => enrichTask(data, t));

  const monthTasksDone = monthTasks.filter((t) => t.status === 'DONE').length;
  const monthTasksPending = monthTasks.filter((t) => t.status !== 'DONE');

  const todayTasks = dayTasks.filter((t) => t.status !== 'DONE');

  const overdueCount = data.tasks.filter(
    (t) => t.dueDate && t.dueDate.slice(0, 10) < todayISO() && t.status !== 'DONE',
  ).length;

  const dayExpenses = data.expenses
    .filter((e) => e.expenseDate.slice(0, 10) === day)
    .map((e) => enrichExpense(data, e as any));

  const monthExpenses = data.expenses.filter((e) => e.expenseDate.slice(0, 7) === monthPrefix);
  const monthTotal = monthExpenses.reduce((s, e) => s + parseFloat(e.amount), 0);
  const dayTotal = dayExpenses.reduce((s, e) => s + parseFloat(e.amount), 0);

  const recentNotes = data.notes
    .filter((n) => n.noteDate.slice(0, 10) === day)
    .map((n) => enrichNote(data, n as any))
    .slice(0, 5);

  const byPerson = data.users.map((user) => {
    const tasks = dayTasks.filter((t) => t.assigneeId === user.id);
    const done = tasks.filter((t) => t.status === 'DONE').length;
    return {
      userId: user.id,
      name: user.name,
      color: user.color,
      role: user.role,
      total: tasks.length,
      done,
      pending: tasks.length - done,
      tasks: tasks.sort((a, b) => {
        const order = { TODO: 0, IN_PROGRESS: 1, DONE: 2 };
        return order[a.status] - order[b.status];
      }),
    };
  });

  const tasksByArea = ['PERSONAL', 'WORK', 'HOME'].flatMap((area) =>
    ['TODO', 'IN_PROGRESS', 'DONE'].map((status) => ({
      area,
      status,
      _count: dayTasks.filter((t) => t.area === area && t.status === status).length,
    })),
  );

  const householdType = resolveHouseholdType(data);
  const shoppingPending = data.shoppingItems.filter((i) => !i.checked).length;
  const routineTodayList = routinesForDay(data, day);
  const routineDone = routineTodayList.reduce((s, r) => s + r.done, 0);
  const routineTotal = routineTodayList.reduce((s, r) => s + r.total, 0);
  const upcoming = upcomingReminders(data, day, 14);

  return {
    date: day,
    todayTasks,
    dayTasks,
    monthTasks,
    monthTasksDone,
    monthTasksTotal: monthTasks.length,
    monthTasksPending: monthTasksPending.slice(0, 8),
    byPerson,
    overdueCount,
    todayExpenses: dayExpenses,
    todayExpenseTotal: dayTotal.toFixed(2),
    monthExpenseTotal: monthTotal.toFixed(2),
    monthExpenseCount: monthExpenses.length,
    tasksByArea,
    recentNotes,
    householdType,
    householdName: data.householdName,
    members: data.users.map((u) => ({ id: u.id, name: u.name, color: u.color, role: u.role })),
    shoppingPending,
    routineDone,
    routineTotal,
    routinesToday: routineTodayList,
    upcomingReminders: upcoming.slice(0, 5),
  };
}

async function handleRequest<T>(path: string, method: string, body?: unknown): Promise<T> {
  await new Promise((r) => setTimeout(r, 0));
  const data = loadData();
  const route = pathOnly(path);
  const q = parseQuery(path);
  const sessionId = getSessionUserId();

  // Auth
  if (route === '/auth/register' && method === 'POST') {
    const payload = body as SetupPayload;
    if (data.setupComplete) throw new ApiError(403, 'Household already set up');
    if (!payload.name?.trim()) throw new ApiError(400, 'Name is required');
    if (!payload.householdType) throw new ApiError(400, 'Household type is required');

    const users = buildUsersFromSetup(payload);
    data.users = users;
    data.householdType = payload.householdType;
    data.householdName = payload.householdName?.trim() || undefined;
    data.setupComplete = true;
    saveData(data);
    setSessionUserId(users[0].id);
    return { token: users[0].id, user: users[0] } as T;
  }

  if (route === '/auth/login' && method === 'POST') {
    const { userId } = body as { userId?: string; email?: string; password?: string };
    if (!data.setupComplete) throw new ApiError(400, 'Please set up your household first');
    const user = data.users.find((u) => u.id === userId);
    if (!user) throw new ApiError(401, 'Please select who you are');
    setSessionUserId(user.id);
    return { token: user.id, user } as T;
  }

  if (route === '/auth/me' && method === 'GET') {
    if (!sessionId) throw new ApiError(401, 'Not signed in');
    const user = data.users.find((u) => u.id === sessionId);
    if (!user) throw new ApiError(401, 'Not signed in');
    return user as T;
  }

  if (!sessionId && route !== '/auth/register') {
    throw new ApiError(401, 'Not signed in');
  }

  // Users
  if (route === '/users' && method === 'GET') {
    return data.users as T;
  }

  if (route === '/household' && method === 'GET') {
    return {
      householdType: resolveHouseholdType(data),
      householdName: data.householdName,
      members: data.users,
    } as T;
  }

  if (route === '/users' && method === 'POST') {
    const { name } = body as { name: string };
    if (data.householdType !== 'FAMILY') {
      throw new ApiError(403, 'Can only add members to a family household');
    }
    if (data.users.length >= MAX_HOUSEHOLD_SIZE) {
      throw new ApiError(400, `Maximum ${MAX_HOUSEHOLD_SIZE} people`);
    }
    if (!name?.trim()) throw new ApiError(400, 'Name is required');
    const member: User = {
      id: uid(),
      email: `${name.toLowerCase().replace(/\s+/g, '')}-${data.users.length}@local`,
      name: name.trim(),
      role: 'MEMBER',
      color: nextMemberColor(data.users.map((u) => u.color)),
    };
    data.users.push(member);
    saveData(data);
    return member as T;
  }

  const userDeleteMatch = route.match(/^\/users\/([^/]+)$/);
  if (userDeleteMatch && method === 'DELETE') {
    const id = userDeleteMatch[1];
    const user = data.users.find((u) => u.id === id);
    if (!user) throw new ApiError(404, 'User not found');
    if (user.role === 'OWNER') throw new ApiError(403, 'Cannot remove the owner');
    if (data.householdType !== 'FAMILY') throw new ApiError(403, 'Only family households can remove members');
    data.users = data.users.filter((u) => u.id !== id);
    data.tasks = data.tasks.map((t) => ({
      ...t,
      assigneeId: t.assigneeId === id ? undefined : t.assigneeId,
    }));
    saveData(data);
    return undefined as T;
  }

  if (route === '/users/me' && method === 'PUT') {
    const { name, color } = body as { name?: string; color?: string };
    const idx = data.users.findIndex((u) => u.id === sessionId);
    if (idx < 0) throw new ApiError(404, 'User not found');
    if (name) data.users[idx].name = name;
    if (color) data.users[idx].color = color;
    saveData(data);
    return data.users[idx] as T;
  }

  // Tasks
  if (route === '/tasks' && method === 'GET') {
    const list = filterTasks(data, q);
    return { data: list, total: list.length, page: 1, limit: list.length } as T;
  }

  if (route === '/tasks' && method === 'POST') {
    const b = body as Partial<Task>;
    const task: Task = {
      id: uid(),
      title: b.title!,
      description: b.description,
      area: b.area!,
      status: b.status || 'TODO',
      priority: b.priority || 'MEDIUM',
      dueDate: b.dueDate || undefined,
      assigneeId: b.assigneeId || undefined,
      createdById: sessionId!,
    };
    data.tasks.push(task);
    saveData(data);
    return enrichTask(data, task) as T;
  }

  const taskMatch = route.match(/^\/tasks\/([^/]+)(\/toggle)?$/);
  if (taskMatch) {
    const id = taskMatch[1];
    const idx = data.tasks.findIndex((t) => t.id === id);
    if (idx < 0) throw new ApiError(404, 'Task not found');

    if (taskMatch[2] === '/toggle' && method === 'PATCH') {
      const t = data.tasks[idx];
      const isDone = t.status === 'DONE';
      t.status = isDone ? 'TODO' : 'DONE';
      t.completedAt = isDone ? undefined : new Date().toISOString();
      saveData(data);
      return enrichTask(data, t) as T;
    }

    if (method === 'PUT') {
      const b = body as Partial<Task>;
      const t = data.tasks[idx];
      Object.assign(t, {
        title: b.title ?? t.title,
        description: b.description ?? t.description,
        area: b.area ?? t.area,
        status: b.status ?? t.status,
        priority: b.priority ?? t.priority,
        dueDate: b.dueDate === null ? undefined : b.dueDate ?? t.dueDate,
        assigneeId: b.assigneeId === null ? undefined : b.assigneeId ?? t.assigneeId,
      });
      if (t.status === 'DONE' && !t.completedAt) t.completedAt = new Date().toISOString();
      if (t.status !== 'DONE') t.completedAt = undefined;
      saveData(data);
      return enrichTask(data, t) as T;
    }

    if (method === 'DELETE') {
      data.tasks.splice(idx, 1);
      saveData(data);
      return undefined as T;
    }
  }

  // Expenses
  if (route === '/expenses/categories' && method === 'GET') {
    return data.categories as T;
  }

  if (route === '/expenses/report' && method === 'GET') {
    return expenseReport(data, q) as T;
  }

  if (route === '/expenses' && method === 'GET') {
    const list = filterExpenses(data, q);
    return { data: list, total: list.length, page: 1, limit: list.length } as T;
  }

  if (route === '/expenses' && method === 'POST') {
    const b = body as { amount: number; description?: string; categoryId: string; expenseDate: string; paidById?: string };
    const exp = {
      id: uid(),
      amount: b.amount.toFixed(2),
      description: b.description,
      categoryId: b.categoryId,
      expenseDate: b.expenseDate,
      paidById: b.paidById || sessionId!,
    };
    data.expenses.push(exp as any);
    saveData(data);
    return enrichExpense(data, exp as any) as T;
  }

  const expMatch = route.match(/^\/expenses\/([^/]+)$/);
  if (expMatch) {
    const idx = data.expenses.findIndex((e) => e.id === expMatch[1]);
    if (idx < 0) throw new ApiError(404, 'Expense not found');
    if (method === 'PUT') {
      const b = body as { amount?: number; description?: string; categoryId?: string; expenseDate?: string; paidById?: string };
      const e = data.expenses[idx] as any;
      if (b.amount != null) e.amount = b.amount.toFixed(2);
      if (b.description !== undefined) e.description = b.description;
      if (b.categoryId) e.categoryId = b.categoryId;
      if (b.expenseDate) e.expenseDate = b.expenseDate;
      if (b.paidById) e.paidById = b.paidById;
      saveData(data);
      return enrichExpense(data, e) as T;
    }
    if (method === 'DELETE') {
      data.expenses.splice(idx, 1);
      saveData(data);
      return undefined as T;
    }
  }

  // Notes
  if (route === '/notes' && method === 'GET') {
    const list = filterNotes(data, q);
    return { data: list, total: list.length, page: 1, limit: list.length } as T;
  }

  if (route === '/notes' && method === 'POST') {
    const b = body as { content: string; area: DailyNote['area']; noteDate: string };
    const note = { id: uid(), content: b.content, area: b.area, noteDate: b.noteDate, authorId: sessionId! };
    data.notes.push(note as any);
    saveData(data);
    return enrichNote(data, note as any) as T;
  }

  const noteMatch = route.match(/^\/notes\/([^/]+)$/);
  if (noteMatch) {
    const idx = data.notes.findIndex((n) => n.id === noteMatch[1]);
    if (idx < 0) throw new ApiError(404, 'Note not found');
    if (method === 'DELETE') {
      data.notes.splice(idx, 1);
      saveData(data);
      return undefined as T;
    }
  }

  // Dashboard
  if (route === '/dashboard/summary' && method === 'GET') {
    const date = q.get('date') || undefined;
    return dashboardSummary(data, date) as T;
  }

  // Shopping
  if (route === '/shopping' && method === 'GET') {
    const list = [...data.shoppingItems].sort((a, b) => {
      if (a.checked !== b.checked) return a.checked ? 1 : -1;
      return b.createdAt.localeCompare(a.createdAt);
    });
    return { data: list, pending: list.filter((i) => !i.checked).length } as T;
  }

  if (route === '/shopping' && method === 'POST') {
    const b = body as { name: string; quantity?: string; category?: ShoppingItem['category'] };
    if (!b.name?.trim()) throw new ApiError(400, 'Item name is required');
    const item: ShoppingItem = {
      id: uid(),
      name: b.name.trim(),
      quantity: b.quantity?.trim() || undefined,
      category: b.category || 'GROCERIES',
      checked: false,
      addedById: sessionId!,
      createdAt: new Date().toISOString(),
    };
    data.shoppingItems.push(item);
    saveData(data);
    return item as T;
  }

  if (route === '/shopping/clear-checked' && method === 'POST') {
    data.shoppingItems = data.shoppingItems.filter((i) => !i.checked);
    saveData(data);
    return { ok: true } as T;
  }

  const shopMatch = route.match(/^\/shopping\/([^/]+)$/);
  if (shopMatch) {
    const idx = data.shoppingItems.findIndex((i) => i.id === shopMatch[1]);
    if (idx < 0) throw new ApiError(404, 'Item not found');
    if (method === 'PATCH') {
      data.shoppingItems[idx].checked = !data.shoppingItems[idx].checked;
      saveData(data);
      return data.shoppingItems[idx] as T;
    }
    if (method === 'DELETE') {
      data.shoppingItems.splice(idx, 1);
      saveData(data);
      return undefined as T;
    }
  }

  // Routines
  if (route === '/routines/today' && method === 'GET') {
    const date = q.get('date') || todayISO();
    return { date, routines: routinesForDay(data, date) } as T;
  }

  if (route === '/routines' && method === 'GET') {
    return data.routines as T;
  }

  if (route === '/routines' && method === 'POST') {
    const b = body as { name: string; timeOfDay?: Routine['timeOfDay']; items?: string[] };
    if (!b.name?.trim()) throw new ApiError(400, 'Routine name is required');
    const routine: Routine = {
      id: uid(),
      name: b.name.trim(),
      timeOfDay: b.timeOfDay || 'ANY',
      items: (b.items || []).filter(Boolean).map((label) => ({ id: uid(), label: label.trim() })),
    };
    data.routines.push(routine);
    saveData(data);
    return routine as T;
  }

  const routineToggleMatch = route.match(/^\/routines\/([^/]+)\/toggle$/);
  if (routineToggleMatch && method === 'POST') {
    const routineId = routineToggleMatch[1];
    const routine = data.routines.find((r) => r.id === routineId);
    if (!routine) throw new ApiError(404, 'Routine not found');
    const b = body as { date: string; itemId: string };
    const date = b.date.slice(0, 10);
    let log = data.routineLogs.find((l) => l.routineId === routineId && l.date.slice(0, 10) === date);
    if (!log) {
      log = { routineId, date, doneItemIds: [] };
      data.routineLogs.push(log);
    }
    const set = new Set(log.doneItemIds);
    if (set.has(b.itemId)) set.delete(b.itemId);
    else set.add(b.itemId);
    log.doneItemIds = [...set];
    saveData(data);
    return routinesForDay(data, date).find((r) => r.id === routineId) as T;
  }

  const routineMatch = route.match(/^\/routines\/([^/]+)$/);
  if (routineMatch) {
    const idx = data.routines.findIndex((r) => r.id === routineMatch[1]);
    if (idx < 0) throw new ApiError(404, 'Routine not found');
    if (method === 'PUT') {
      const b = body as { name?: string; timeOfDay?: Routine['timeOfDay']; items?: RoutineItem[] };
      const r = data.routines[idx];
      if (b.name) r.name = b.name.trim();
      if (b.timeOfDay) r.timeOfDay = b.timeOfDay;
      if (b.items) r.items = b.items;
      saveData(data);
      return r as T;
    }
    if (method === 'DELETE') {
      const id = data.routines[idx].id;
      data.routines.splice(idx, 1);
      data.routineLogs = data.routineLogs.filter((l) => l.routineId !== id);
      saveData(data);
      return undefined as T;
    }
  }

  // Reminders
  if (route === '/reminders/upcoming' && method === 'GET') {
    const from = q.get('from') || todayISO();
    const days = parseInt(q.get('days') || '30', 10);
    return upcomingReminders(data, from, days) as T;
  }

  if (route === '/reminders' && method === 'GET') {
    const list = [...data.reminders].sort((a, b) => {
      const na = nextReminderDate(a, todayISO()) || a.dueDate;
      const nb = nextReminderDate(b, todayISO()) || b.dueDate;
      return na.localeCompare(nb);
    });
    return list as T;
  }

  if (route === '/reminders' && method === 'POST') {
    const b = body as { title: string; dueDate: string; repeat?: ReminderRepeat; notes?: string };
    if (!b.title?.trim()) throw new ApiError(400, 'Title is required');
    if (!b.dueDate) throw new ApiError(400, 'Date is required');
    const reminder: Reminder = {
      id: uid(),
      title: b.title.trim(),
      dueDate: b.dueDate.slice(0, 10),
      repeat: b.repeat || 'NONE',
      notes: b.notes?.trim() || undefined,
      createdById: sessionId!,
    };
    data.reminders.push(reminder);
    saveData(data);
    return reminder as T;
  }

  const reminderMatch = route.match(/^\/reminders\/([^/]+)$/);
  if (reminderMatch) {
    const idx = data.reminders.findIndex((r) => r.id === reminderMatch[1]);
    if (idx < 0) throw new ApiError(404, 'Reminder not found');
    if (method === 'PUT') {
      const b = body as { title?: string; dueDate?: string; repeat?: ReminderRepeat; notes?: string };
      const r = data.reminders[idx];
      if (b.title) r.title = b.title.trim();
      if (b.dueDate) r.dueDate = b.dueDate.slice(0, 10);
      if (b.repeat) r.repeat = b.repeat;
      if (b.notes !== undefined) r.notes = b.notes.trim() || undefined;
      saveData(data);
      return r as T;
    }
    if (method === 'DELETE') {
      data.reminders.splice(idx, 1);
      saveData(data);
      return undefined as T;
    }
  }

  // Vision board
  if (route === '/vision-board' && method === 'GET') {
    const ownerId = q.get('ownerId');
    let items = [...data.visionBoard];
    if (ownerId === 'shared') items = items.filter((i) => !i.ownerId);
    else if (ownerId) items = items.filter((i) => i.ownerId === ownerId);
    const achieved = q.get('achieved');
    if (achieved === 'true') items = items.filter((i) => i.achieved);
    if (achieved === 'false') items = items.filter((i) => !i.achieved);
    items.sort((a, b) => {
      if (a.achieved !== b.achieved) return a.achieved ? 1 : -1;
      return b.createdAt.localeCompare(a.createdAt);
    });
    return items.map((i) => enrichVision(data, i)) as T;
  }

  if (route === '/vision-board' && method === 'POST') {
    const b = body as {
      title: string;
      caption?: string;
      imageUrl?: string;
      emoji?: string;
      category?: VisionCategory;
      color?: string;
      ownerId?: string | null;
    };
    if (!b.title?.trim()) throw new ApiError(400, 'Title is required');
    const item: VisionBoardItem = {
      id: uid(),
      title: b.title.trim(),
      caption: b.caption?.trim() || undefined,
      imageUrl: b.imageUrl?.trim() || undefined,
      emoji: b.emoji?.trim() || undefined,
      category: b.category || 'OTHER',
      color: b.color || '#6366F1',
      achieved: false,
      ownerId: b.ownerId || undefined,
      createdById: sessionId!,
      createdAt: new Date().toISOString(),
    };
    data.visionBoard.push(item);
    saveData(data);
    return enrichVision(data, item) as T;
  }

  const visionMatch = route.match(/^\/vision-board\/([^/]+)(\/achieve)?$/);
  if (visionMatch) {
    const idx = data.visionBoard.findIndex((i) => i.id === visionMatch[1]);
    if (idx < 0) throw new ApiError(404, 'Vision card not found');
    if (visionMatch[2] === '/achieve' && method === 'PATCH') {
      data.visionBoard[idx].achieved = !data.visionBoard[idx].achieved;
      saveData(data);
      return enrichVision(data, data.visionBoard[idx]) as T;
    }
    if (method === 'PUT') {
      const b = body as Partial<VisionBoardItem & { ownerId?: string | null }>;
      const item = data.visionBoard[idx];
      if (b.title) item.title = b.title.trim();
      if (b.caption !== undefined) item.caption = b.caption.trim() || undefined;
      if (b.imageUrl !== undefined) item.imageUrl = b.imageUrl.trim() || undefined;
      if (b.emoji !== undefined) item.emoji = b.emoji.trim() || undefined;
      if (b.category) item.category = b.category;
      if (b.color) item.color = b.color;
      if (b.ownerId === null) item.ownerId = undefined;
      else if (b.ownerId) item.ownerId = b.ownerId;
      saveData(data);
      return enrichVision(data, item) as T;
    }
    if (method === 'DELETE') {
      data.visionBoard.splice(idx, 1);
      saveData(data);
      return undefined as T;
    }
  }

  throw new ApiError(404, `Unknown route: ${route}`);
}

class ApiClient {
  setToken(token: string | null) {
    setSessionUserId(token);
  }

  getToken(): string | null {
    return getSessionUserId();
  }

  get<T>(path: string) {
    return handleRequest<T>(path, 'GET');
  }

  post<T>(path: string, body?: unknown) {
    return handleRequest<T>(path, 'POST', body);
  }

  put<T>(path: string, body: unknown) {
    return handleRequest<T>(path, 'PUT', body);
  }

  patch<T>(path: string, body?: unknown) {
    return handleRequest<T>(path, 'PATCH', body);
  }

  delete(path: string) {
    return handleRequest(path, 'DELETE');
  }
}

export const api = new ApiClient();
