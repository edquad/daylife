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
import {
  computeNetBalances,
  computeSplitShares,
  formatBalance,
  getExpenseShares,
  simplifyDebts,
} from './splits';
import type { ItemVisibility } from './privacy';
import { defaultVisibility, isVisibleToViewer } from './privacy';
import { hashPin, verifyPin, validatePinFormat } from './pin';
import { normalizeUsername, validateUsername } from './accounts';

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
  username?: string;
  role: string;
  color: string;
  hasPin?: boolean;
  pinHash?: string;
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
  visibility?: ItemVisibility;
  ownerId?: string;
}

export type SplitMode = 'EQUAL' | 'EXACT';

export interface StoredExpense {
  id: string;
  amount: string;
  description?: string;
  expenseDate: string;
  categoryId: string;
  paidById: string;
  visibility?: ItemVisibility;
  ownerId?: string;
  isShared?: boolean;
  splitMode?: SplitMode;
  participantIds?: string[];
  shares?: Record<string, string>;
}

export interface Expense {
  id: string;
  amount: string;
  description?: string;
  expenseDate: string;
  category: { id: string; name: string; color: string };
  paidBy: { id: string; name: string; color: string };
  visibility?: ItemVisibility;
  ownerId?: string;
  isShared?: boolean;
  splitMode?: SplitMode;
  participantIds?: string[];
  participants?: Array<{ id: string; name: string; color: string }>;
  shares?: Array<{ userId: string; name: string; amount: string }>;
}

export interface Settlement {
  id: string;
  fromUserId: string;
  toUserId: string;
  amount: string;
  settledAt: string;
  note?: string;
  createdById?: string;
}

export interface SettlementEnriched extends Settlement {
  fromUser: { id: string; name: string; color: string };
  toUser: { id: string; name: string; color: string };
}

export interface SplitBalancesResponse {
  balances: Array<{ userId: string; name: string; color: string; balance: string }>;
  debts: Array<{
    fromUserId: string;
    fromName: string;
    fromColor: string;
    toUserId: string;
    toName: string;
    toColor: string;
    amount: string;
  }>;
  settlements: SettlementEnriched[];
}

export interface DailyNote {
  id: string;
  content: string;
  area: 'PERSONAL' | 'WORK' | 'HOME';
  noteDate: string;
  author: { id: string; name: string; color: string };
  visibility?: ItemVisibility;
  ownerId?: string;
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

  if (householdType === 'GROUP') {
    const names = memberNames.map((n) => n.trim()).filter(Boolean);
    if (names.length < 1) throw new ApiError(400, 'Add at least one group member');
    if (names.length + 1 > MAX_HOUSEHOLD_SIZE) {
      throw new ApiError(400, `Maximum ${MAX_HOUSEHOLD_SIZE} people in a group`);
    }
    names.forEach((memberName, index) => {
      users.push({
        id: uid(),
        email: `${memberName.toLowerCase().replace(/\s+/g, '')}-g${index}@local`,
        name: memberName,
        role: 'MEMBER',
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

function publicUser(u: User): User {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    username: u.username,
    role: u.role,
    color: u.color,
    hasPin: !!u.pinHash,
  };
}

function taskOwnerId(task: Task): string {
  return task.ownerId || task.createdById || task.assigneeId || '';
}

function expenseOwnerId(exp: StoredExpense): string {
  return exp.ownerId || exp.paidById || '';
}

function noteOwnerId(note: { ownerId?: string; authorId?: string }): string {
  return note.ownerId || note.authorId || '';
}

function filterVisible<T>(
  items: T[],
  viewerId: string | null,
  getOwner: (item: T) => string,
  getVisibility: (item: T) => ItemVisibility | undefined,
): T[] {
  if (!viewerId) return items;
  return items.filter((item) =>
    isVisibleToViewer(getVisibility(item), getOwner(item), viewerId),
  );
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

function enrichExpense(data: ReturnType<typeof loadData>, exp: StoredExpense): Expense {
  const category = data.categories.find((c) => c.id === exp.categoryId);
  const paidBy = findUser(data, exp.paidById || '');
  const base: Expense = {
    id: exp.id,
    amount: exp.amount,
    description: exp.description,
    expenseDate: exp.expenseDate,
    category: category || { id: 'cat-other', name: 'Other', color: '#6B7280' },
    paidBy: paidBy ? userRef(paidBy) : { id: '', name: 'Unknown', color: '#6B7280' },
    visibility: exp.visibility,
    ownerId: exp.ownerId,
  };

  if (!exp.isShared) return base;

  const participantIds = exp.participantIds || [];
  const participants = participantIds
    .map((id) => findUser(data, id))
    .filter(Boolean)
    .map((u) => userRef(u!));

  const shareRows = getExpenseShares(exp).map((share) => {
    const user = findUser(data, share.userId);
    return {
      userId: share.userId,
      name: user?.name || 'Unknown',
      amount: share.amount.toFixed(2),
    };
  });

  return {
    ...base,
    isShared: true,
    splitMode: exp.splitMode || 'EQUAL',
    participantIds,
    participants,
    shares: shareRows,
  };
}

function enrichSettlement(data: ReturnType<typeof loadData>, settlement: Settlement): SettlementEnriched {
  const fromUser = findUser(data, settlement.fromUserId);
  const toUser = findUser(data, settlement.toUserId);
  return {
    ...settlement,
    fromUser: fromUser ? userRef(fromUser) : { id: settlement.fromUserId, name: 'Unknown', color: '#6B7280' },
    toUser: toUser ? userRef(toUser) : { id: settlement.toUserId, name: 'Unknown', color: '#6B7280' },
  };
}

function splitBalances(data: ReturnType<typeof loadData>): SplitBalancesResponse {
  if (!data.settlements) data.settlements = [];
  const net = computeNetBalances(data.users, data.expenses, data.settlements);
  const simplified = simplifyDebts(net);

  return {
    balances: data.users.map((user) => ({
      userId: user.id,
      name: user.name,
      color: user.color,
      balance: formatBalance(net[user.id] || 0),
    })),
    debts: simplified.map((debt) => {
      const fromUser = findUser(data, debt.fromUserId)!;
      const toUser = findUser(data, debt.toUserId)!;
      return {
        fromUserId: debt.fromUserId,
        fromName: fromUser.name,
        fromColor: fromUser.color,
        toUserId: debt.toUserId,
        toName: toUser.name,
        toColor: toUser.color,
        amount: debt.amount.toFixed(2),
      };
    }),
    settlements: [...data.settlements]
      .sort((a, b) => b.settledAt.localeCompare(a.settledAt))
      .map((s) => enrichSettlement(data, s)),
  };
}

function applySplitFields(
  exp: StoredExpense,
  body: {
    isShared?: boolean;
    splitMode?: SplitMode;
    participantIds?: string[];
    shares?: Record<string, string>;
  },
  allUserIds: string[],
  amount: number,
): void {
  if (!body.isShared) {
    exp.isShared = false;
    delete exp.splitMode;
    delete exp.participantIds;
    delete exp.shares;
    return;
  }

  const participantIds = (body.participantIds?.length ? body.participantIds : allUserIds).filter((id) =>
    allUserIds.includes(id),
  );
  if (participantIds.length < 2) {
    throw new ApiError(400, 'Pick at least two people to split between');
  }

  const splitMode = body.splitMode || 'EQUAL';
  exp.isShared = true;
  exp.splitMode = splitMode;
  exp.participantIds = participantIds;

  if (splitMode === 'EXACT') {
    if (!body.shares) throw new ApiError(400, 'Enter each person’s share');
    const totalShares = participantIds.reduce((sum, id) => sum + parseFloat(body.shares![id] || '0'), 0);
    if (Math.abs(totalShares - amount) > 0.02) {
      throw new ApiError(400, 'Custom shares must add up to the expense total');
    }
    exp.shares = Object.fromEntries(participantIds.map((id) => [id, parseFloat(body.shares![id] || '0').toFixed(2)]));
  } else {
    delete exp.shares;
    const preview = computeSplitShares(amount, 'EQUAL', participantIds);
    const previewTotal = preview.reduce((sum, row) => sum + row.amount, 0);
    if (Math.abs(previewTotal - amount) > 0.02) {
      throw new ApiError(400, 'Could not split expense evenly');
    }
  }
}

function enrichNote(data: ReturnType<typeof loadData>, note: DailyNote & { authorId?: string }): DailyNote {
  const author = findUser(data, note.authorId || note.author?.id || '');
  return {
    id: note.id,
    content: note.content,
    area: note.area,
    noteDate: note.noteDate,
    visibility: note.visibility,
    ownerId: note.ownerId || note.authorId,
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

function filterTasks(data: ReturnType<typeof loadData>, q: URLSearchParams, viewerId: string | null) {
  let tasks = filterVisible(
    [...data.tasks],
    viewerId,
    taskOwnerId,
    (t) => t.visibility,
  );
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

function filterExpenses(data: ReturnType<typeof loadData>, q: URLSearchParams, viewerId: string | null) {
  let expenses = filterVisible(
    [...data.expenses],
    viewerId,
    expenseOwnerId,
    (e) => e.visibility,
  );
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
  if (categoryId) expenses = expenses.filter((e) => e.categoryId === categoryId);
  if (paidById) expenses = expenses.filter((e) => e.paidById === paidById);
  if (search?.trim()) {
    const s = search.trim().toLowerCase();
    expenses = expenses.filter((e) => {
      const enriched = enrichExpense(data, e);
      return (
        e.description?.toLowerCase().includes(s) ||
        enriched.category.name.toLowerCase().includes(s)
      );
    });
  }

  expenses.sort((a, b) => b.expenseDate.localeCompare(a.expenseDate));
  const limit = parseInt(q.get('limit') || '50', 10);
  return expenses.slice(0, limit).map((e) => enrichExpense(data, e));
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

function expenseReport(data: ReturnType<typeof loadData>, q: URLSearchParams, viewerId: string | null) {
  const period = (q.get('period') || 'daily') as ReportPeriod;
  const anchor = q.get('date') || todayISO();
  const { from, to, label } = expenseReportRange(period, anchor);

  let expenses = filterVisible(
    data.expenses,
    viewerId,
    expenseOwnerId,
    (e) => e.visibility,
  ).filter((e) => {
    const d = e.expenseDate.slice(0, 10);
    return d >= from && d <= to;
  });

  const categoryId = q.get('categoryId');
  const paidById = q.get('paidById');
  const search = q.get('search');
  if (categoryId) expenses = expenses.filter((e) => e.categoryId === categoryId);
  if (paidById) expenses = expenses.filter((e) => e.paidById === paidById);
  if (search?.trim()) {
    const s = search.trim().toLowerCase();
    expenses = expenses.filter((e) => {
      const enriched = enrichExpense(data, e);
      return (
        e.description?.toLowerCase().includes(s) ||
        enriched.category.name.toLowerCase().includes(s)
      );
    });
  }

  expenses.sort((a, b) => b.expenseDate.localeCompare(a.expenseDate));
  const enriched = expenses.map((e) => enrichExpense(data, e));
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

function filterNotes(data: ReturnType<typeof loadData>, q: URLSearchParams, viewerId: string | null) {
  let notes = filterVisible(
    [...data.notes] as Array<{ id: string; content: string; area: DailyNote['area']; noteDate: string; authorId?: string; visibility?: ItemVisibility; ownerId?: string }>,
    viewerId,
    noteOwnerId,
    (n) => n.visibility,
  );
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

function dashboardSummary(data: ReturnType<typeof loadData>, dateParam?: string, viewerId?: string | null) {
  const day = dateParam || todayISO();
  const monthPrefix = day.slice(0, 7);
  const viewer = viewerId ?? null;

  const visibleTasks = filterVisible(
    data.tasks,
    viewer,
    taskOwnerId,
    (t) => t.visibility,
  );
  const visibleExpenses = filterVisible(
    data.expenses,
    viewer,
    expenseOwnerId,
    (e) => e.visibility,
  );
  const visibleNotes = filterVisible(
    data.notes as Array<{ authorId?: string; visibility?: ItemVisibility; ownerId?: string; noteDate: string; id: string; content: string; area: DailyNote['area'] }>,
    viewer,
    noteOwnerId,
    (n) => n.visibility,
  );

  const dayTasks = visibleTasks
    .filter((t) => t.dueDate?.slice(0, 10) === day)
    .map((t) => enrichTask(data, t));

  const monthTasks = visibleTasks
    .filter((t) => t.dueDate?.slice(0, 7) === monthPrefix)
    .map((t) => enrichTask(data, t));

  const monthTasksDone = monthTasks.filter((t) => t.status === 'DONE').length;
  const monthTasksPending = monthTasks.filter((t) => t.status !== 'DONE');

  const todayTasks = dayTasks.filter((t) => t.status !== 'DONE');

  const overdueCount = visibleTasks.filter(
    (t) => t.dueDate && t.dueDate.slice(0, 10) < todayISO() && t.status !== 'DONE',
  ).length;

  const dayExpenses = visibleExpenses
    .filter((e) => e.expenseDate.slice(0, 10) === day)
    .map((e) => enrichExpense(data, e));

  const monthExpenses = visibleExpenses.filter((e) => e.expenseDate.slice(0, 7) === monthPrefix);
  const monthTotal = monthExpenses.reduce((s, e) => s + parseFloat(e.amount), 0);
  const dayTotal = dayExpenses.reduce((s, e) => s + parseFloat(e.amount), 0);

  const recentNotes = visibleNotes
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
    viewerId: viewer,
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
  if ((route === '/auth/register' || route === '/auth/signup') && method === 'POST') {
    const payload = body as SetupPayload & { username?: string; name?: string; pin?: string };

    if (payload.username) {
      const username = normalizeUsername(payload.username);
      const usernameErr = validateUsername(username);
      if (usernameErr) throw new ApiError(400, usernameErr);
      if (!payload.name?.trim()) throw new ApiError(400, 'Name is required');
      if (data.setupComplete) {
        throw new ApiError(403, 'Already set up — log out first or use a different account');
      }

      const user: User = {
        id: uid(),
        username,
        email: `${username}@local`,
        name: payload.name.trim(),
        role: 'OWNER',
        color: MEMBER_COLORS[0],
      };
      if (payload.pin?.trim()) {
        if (!validatePinFormat(payload.pin)) throw new ApiError(400, 'PIN must be 4 digits');
        user.pinHash = await hashPin(payload.pin, user.id);
      }
      data.users = [user];
      data.householdType = 'SINGLE';
      data.settlements = [];
      data.setupComplete = true;
      saveData(data);
      setSessionUserId(user.id);
      return { token: user.id, user: publicUser(user) } as T;
    }

    if (data.setupComplete) {
      throw new ApiError(403, 'Household already set up — tap Log in and choose your name instead');
    }
    if (!payload.name?.trim()) throw new ApiError(400, 'Name is required');
    if (!payload.householdType) throw new ApiError(400, 'Household type is required');

    const users = buildUsersFromSetup(payload);
    if (payload.pin?.trim()) {
      if (!validatePinFormat(payload.pin)) throw new ApiError(400, 'PIN must be 4 digits');
      users[0].pinHash = await hashPin(payload.pin, users[0].id);
    }
    data.users = users;
    data.householdType = payload.householdType;
    data.householdName = payload.householdName?.trim() || undefined;
    data.settlements = [];
    data.setupComplete = true;
    saveData(data);
    setSessionUserId(users[0].id);
    return { token: users[0].id, user: publicUser(users[0]) } as T;
  }

  if (route === '/auth/login' && method === 'POST') {
    const { userId, username, pin } = body as { userId?: string; username?: string; pin?: string };
    if (!data.setupComplete) throw new ApiError(400, 'No account yet — sign up first');
    let user: User | undefined;
    if (username) {
      const key = normalizeUsername(username);
      user = data.users.find((u) => u.username === key);
      if (!user) throw new ApiError(401, 'Wrong username or PIN');
    } else {
      user = data.users.find((u) => u.id === userId);
      if (!user) throw new ApiError(401, 'Please select who you are');
    }
    if (user.pinHash) {
      if (!pin) throw new ApiError(401, 'Enter your 4-digit PIN');
      const ok = await verifyPin(pin, user.id, user.pinHash);
      if (!ok) throw new ApiError(401, 'Wrong PIN');
    }
    setSessionUserId(user.id);
    return { token: user.id, user: publicUser(user) } as T;
  }

  if (route === '/auth/me' && method === 'GET') {
    if (!sessionId) throw new ApiError(401, 'Not signed in');
    const user = data.users.find((u) => u.id === sessionId);
    if (!user) throw new ApiError(401, 'Not signed in');
    return publicUser(user) as T;
  }

  if (!sessionId && route !== '/auth/register' && route !== '/auth/signup' && route !== '/auth/login') {
    throw new ApiError(401, 'Not signed in');
  }

  // Users
  if (route === '/users' && method === 'GET') {
    return data.users.map(publicUser) as T;
  }

  if (route === '/household' && method === 'GET') {
    return {
      householdType: resolveHouseholdType(data),
      householdName: data.householdName,
      members: data.users.map(publicUser),
    } as T;
  }

  if (route === '/users' && method === 'POST') {
    const { name } = body as { name: string };
    if (!name?.trim()) throw new ApiError(400, 'Name is required');

    if (data.householdType === 'SINGLE' && data.users.length === 1) {
      const partner: User = {
        id: uid(),
        email: `${name.toLowerCase().replace(/\s+/g, '')}-partner@local`,
        name: name.trim(),
        role: 'PARTNER',
        color: nextMemberColor(data.users.map((u) => u.color)),
      };
      data.users.push(partner);
      data.householdType = 'COUPLE';
      saveData(data);
      return publicUser(partner) as T;
    }

    if (data.householdType !== 'FAMILY' && data.householdType !== 'GROUP') {
      throw new ApiError(403, 'Ask the person who set up DayLife to add you in Settings → People');
    }
    const member: User = {
      id: uid(),
      email: `${name.toLowerCase().replace(/\s+/g, '')}-${data.users.length}@local`,
      name: name.trim(),
      role: 'MEMBER',
      color: nextMemberColor(data.users.map((u) => u.color)),
    };
    data.users.push(member);
    saveData(data);
    return publicUser(member) as T;
  }

  const userDeleteMatch = route.match(/^\/users\/([^/]+)$/);
  if (userDeleteMatch && method === 'DELETE') {
    const id = userDeleteMatch[1];
    const user = data.users.find((u) => u.id === id);
    if (!user) throw new ApiError(404, 'User not found');
    if (user.role === 'OWNER') throw new ApiError(403, 'Cannot remove the owner');
    if (data.householdType !== 'FAMILY' && data.householdType !== 'GROUP') {
      throw new ApiError(403, 'Only family or group households can remove members');
    }
    data.users = data.users.filter((u) => u.id !== id);
    const fallbackUser = data.users.find((u) => u.role === 'OWNER') || data.users[0];
    data.tasks = data.tasks.map((t) => ({
      ...t,
      assigneeId: t.assigneeId === id ? undefined : t.assigneeId,
    }));
    data.expenses = data.expenses.map((e) => {
      const participantIds = e.participantIds?.filter((pid) => pid !== id);
      return {
        ...e,
        paidById: e.paidById === id ? fallbackUser.id : e.paidById,
        participantIds,
        shares: e.shares
          ? Object.fromEntries(Object.entries(e.shares).filter(([pid]) => pid !== id))
          : undefined,
        isShared: participantIds && participantIds.length >= 2 ? e.isShared : false,
      };
    });
    if (!data.settlements) data.settlements = [];
    data.settlements = data.settlements.filter((s) => s.fromUserId !== id && s.toUserId !== id);
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
    return publicUser(data.users[idx]) as T;
  }

  if (route === '/users/me/pin' && method === 'PUT') {
    const { pin, currentPin } = body as { pin?: string; currentPin?: string };
    const idx = data.users.findIndex((u) => u.id === sessionId);
    if (idx < 0) throw new ApiError(404, 'User not found');
    const user = data.users[idx];
    if (!pin || !validatePinFormat(pin)) throw new ApiError(400, 'PIN must be 4 digits');
    if (user.pinHash) {
      if (!currentPin) throw new ApiError(400, 'Enter your current PIN');
      const ok = await verifyPin(currentPin, user.id, user.pinHash);
      if (!ok) throw new ApiError(401, 'Wrong current PIN');
    }
    user.pinHash = await hashPin(pin, user.id);
    saveData(data);
    return publicUser(user) as T;
  }

  if (route === '/users/me/pin' && method === 'DELETE') {
    const { currentPin } = body as { currentPin?: string };
    const idx = data.users.findIndex((u) => u.id === sessionId);
    if (idx < 0) throw new ApiError(404, 'User not found');
    const user = data.users[idx];
    if (user.pinHash) {
      if (!currentPin) throw new ApiError(400, 'Enter your current PIN');
      const ok = await verifyPin(currentPin, user.id, user.pinHash);
      if (!ok) throw new ApiError(401, 'Wrong current PIN');
    }
    delete user.pinHash;
    saveData(data);
    return publicUser(user) as T;
  }

  // Tasks
  if (route === '/tasks' && method === 'GET') {
    const list = filterTasks(data, q, sessionId);
    return { data: list, total: list.length, page: 1, limit: list.length } as T;
  }

  if (route === '/tasks' && method === 'POST') {
    const b = body as Partial<Task>;
    const visibility = b.visibility || defaultVisibility(data.users.length);
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
      visibility,
      ownerId: sessionId!,
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
        visibility: b.visibility ?? t.visibility,
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
    return expenseReport(data, q, sessionId) as T;
  }

  if (route === '/splits/balances' && method === 'GET') {
    return splitBalances(data) as T;
  }

  if (route === '/splits/settlements' && method === 'GET') {
    if (!data.settlements) data.settlements = [];
    return data.settlements
      .slice()
      .sort((a, b) => b.settledAt.localeCompare(a.settledAt))
      .map((s) => enrichSettlement(data, s)) as T;
  }

  if (route === '/splits/settlements' && method === 'POST') {
    const b = body as { fromUserId: string; toUserId: string; amount: number; note?: string; settledAt?: string };
    if (!b.fromUserId || !b.toUserId) throw new ApiError(400, 'Choose who paid and who received');
    if (b.fromUserId === b.toUserId) throw new ApiError(400, 'Choose two different people');
    if (!b.amount || b.amount <= 0) throw new ApiError(400, 'Enter a valid amount');
    if (!findUser(data, b.fromUserId) || !findUser(data, b.toUserId)) {
      throw new ApiError(400, 'Invalid member selected');
    }
    if (!data.settlements) data.settlements = [];
    const settlement: Settlement = {
      id: uid(),
      fromUserId: b.fromUserId,
      toUserId: b.toUserId,
      amount: b.amount.toFixed(2),
      settledAt: b.settledAt || todayISO(),
      note: b.note?.trim() || undefined,
      createdById: sessionId!,
    };
    data.settlements.push(settlement);
    saveData(data);
    return enrichSettlement(data, settlement) as T;
  }

  const settlementMatch = route.match(/^\/splits\/settlements\/([^/]+)$/);
  if (settlementMatch && method === 'DELETE') {
    if (!data.settlements) data.settlements = [];
    const idx = data.settlements.findIndex((s) => s.id === settlementMatch[1]);
    if (idx < 0) throw new ApiError(404, 'Settlement not found');
    data.settlements.splice(idx, 1);
    saveData(data);
    return undefined as T;
  }

  if (route === '/expenses' && method === 'GET') {
    const list = filterExpenses(data, q, sessionId);
    return { data: list, total: list.length, page: 1, limit: list.length } as T;
  }

  if (route === '/expenses' && method === 'POST') {
    const b = body as {
      amount: number;
      description?: string;
      categoryId: string;
      expenseDate: string;
      paidById?: string;
      visibility?: ItemVisibility;
      isShared?: boolean;
      splitMode?: SplitMode;
      participantIds?: string[];
      shares?: Record<string, string>;
    };
    const isShared = b.isShared ?? false;
    const visibility = isShared ? 'SHARED' : (b.visibility || defaultVisibility(data.users.length));
    const exp: StoredExpense = {
      id: uid(),
      amount: b.amount.toFixed(2),
      description: b.description,
      categoryId: b.categoryId,
      expenseDate: b.expenseDate,
      paidById: b.paidById || sessionId!,
      visibility,
      ownerId: sessionId!,
    };
    applySplitFields(exp, b, data.users.map((u) => u.id), b.amount);
    data.expenses.push(exp);
    saveData(data);
    return enrichExpense(data, exp) as T;
  }

  const expMatch = route.match(/^\/expenses\/([^/]+)$/);
  if (expMatch) {
    const idx = data.expenses.findIndex((e) => e.id === expMatch[1]);
    if (idx < 0) throw new ApiError(404, 'Expense not found');
    if (method === 'PUT') {
      const b = body as {
        amount?: number;
        description?: string;
        categoryId?: string;
        expenseDate?: string;
        paidById?: string;
        visibility?: ItemVisibility;
        isShared?: boolean;
        splitMode?: SplitMode;
        participantIds?: string[];
        shares?: Record<string, string>;
      };
      const e = data.expenses[idx];
      const amount = b.amount != null ? b.amount : parseFloat(e.amount);
      if (b.amount != null) e.amount = b.amount.toFixed(2);
      if (b.description !== undefined) e.description = b.description;
      if (b.categoryId) e.categoryId = b.categoryId;
      if (b.expenseDate) e.expenseDate = b.expenseDate;
      if (b.paidById) e.paidById = b.paidById;
      if (b.visibility !== undefined) e.visibility = b.visibility;
      if (b.isShared !== undefined || b.splitMode || b.participantIds || b.shares) {
        applySplitFields(
          e,
          {
            isShared: b.isShared ?? e.isShared,
            splitMode: b.splitMode ?? e.splitMode,
            participantIds: b.participantIds ?? e.participantIds,
            shares: b.shares ?? e.shares,
          },
          data.users.map((u) => u.id),
          amount,
        );
        if (e.isShared) e.visibility = 'SHARED';
      }
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
    const list = filterNotes(data, q, sessionId);
    return { data: list, total: list.length, page: 1, limit: list.length } as T;
  }

  if (route === '/notes' && method === 'POST') {
    const b = body as { content: string; area: DailyNote['area']; noteDate: string; visibility?: ItemVisibility };
    const note = {
      id: uid(),
      content: b.content,
      area: b.area,
      noteDate: b.noteDate,
      authorId: sessionId!,
      ownerId: sessionId!,
      visibility: b.visibility || defaultVisibility(data.users.length),
    };
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
    return dashboardSummary(data, date, sessionId) as T;
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
    let items = [...(data.visionBoard ?? [])];
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
    if (!data.visionBoard) data.visionBoard = [];
    data.visionBoard.push(item);
    saveData(data);
    return enrichVision(data, item) as T;
  }

  const visionMatch = route.match(/^\/vision-board\/([^/]+)(\/achieve)?$/);
  if (visionMatch) {
    if (!data.visionBoard) data.visionBoard = [];
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

  delete(path: string, body?: unknown) {
    return handleRequest(path, 'DELETE', body);
  }
}

export const api = new ApiClient();
