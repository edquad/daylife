import type { AppData } from './storage';
import type { Task, StoredExpense, ShoppingItem, Reminder, DailyNote, VisionBoardItem, RoutineDayLog, RoutineItem } from './api';
import { addMemory } from './lifeAutopilot';

function uid(): string {
  return crypto.randomUUID?.() || Math.random().toString(36).slice(2, 10);
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function tomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function daysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

const DEMO_USER_ID = 'demo-user-001';
const DEMO_USER = {
  id: DEMO_USER_ID,
  name: 'Anshul',
  username: 'anshul_demo',
  email: 'demo@rozka.ai',
  role: 'user',
  color: '#6366F1',
};

function demoTasks(): Task[] {
  return [
    { id: uid(), title: 'Review monthly budget', area: 'PERSONAL', status: 'DONE', priority: 'HIGH', dueDate: today(), assigneeId: DEMO_USER_ID, createdById: DEMO_USER_ID, completedAt: new Date().toISOString() },
    { id: uid(), title: 'Call CA for tax filing', area: 'WORK', status: 'TODO', priority: 'HIGH', dueDate: today(), assigneeId: DEMO_USER_ID, createdById: DEMO_USER_ID },
    { id: uid(), title: 'Buy vegetables from market', area: 'HOME', status: 'DONE', priority: 'MEDIUM', dueDate: today(), assigneeId: DEMO_USER_ID, createdById: DEMO_USER_ID, completedAt: new Date().toISOString() },
    { id: uid(), title: 'Gym - Leg day', area: 'PERSONAL', status: 'TODO', priority: 'MEDIUM', dueDate: today(), assigneeId: DEMO_USER_ID, createdById: DEMO_USER_ID },
    { id: uid(), title: 'Submit project proposal', area: 'WORK', status: 'IN_PROGRESS', priority: 'HIGH', dueDate: today(), assigneeId: DEMO_USER_ID, createdById: DEMO_USER_ID },

    { id: uid(), title: 'Pay electricity bill', area: 'HOME', status: 'TODO', priority: 'HIGH', dueDate: tomorrow(), assigneeId: DEMO_USER_ID, createdById: DEMO_USER_ID },
    { id: uid(), title: 'Dentist appointment 11 AM', area: 'PERSONAL', status: 'TODO', priority: 'MEDIUM', dueDate: tomorrow(), assigneeId: DEMO_USER_ID, createdById: DEMO_USER_ID },

    { id: uid(), title: 'Renew car insurance', area: 'PERSONAL', status: 'TODO', priority: 'HIGH', dueDate: daysFromNow(3), assigneeId: DEMO_USER_ID, createdById: DEMO_USER_ID },
    { id: uid(), title: 'Plan weekend trip to Rishikesh', area: 'PERSONAL', status: 'TODO', priority: 'LOW', dueDate: daysFromNow(5), assigneeId: DEMO_USER_ID, createdById: DEMO_USER_ID },

    // Overdue — triggers regret prevention
    { id: uid(), title: 'Complete AWS certification course', area: 'WORK', status: 'TODO', priority: 'HIGH', dueDate: daysAgo(21), assigneeId: DEMO_USER_ID, createdById: DEMO_USER_ID },
    { id: uid(), title: 'Update resume', area: 'WORK', status: 'TODO', priority: 'MEDIUM', dueDate: daysAgo(14), assigneeId: DEMO_USER_ID, createdById: DEMO_USER_ID },
    { id: uid(), title: 'Fix bathroom tap leak', area: 'HOME', status: 'TODO', priority: 'LOW', dueDate: daysAgo(30), assigneeId: DEMO_USER_ID, createdById: DEMO_USER_ID },

    { id: uid(), title: 'Pay internet bill', area: 'HOME', status: 'DONE', priority: 'HIGH', dueDate: daysAgo(1), assigneeId: DEMO_USER_ID, createdById: DEMO_USER_ID, completedAt: new Date().toISOString() },
    { id: uid(), title: 'Send birthday gift to Mom', area: 'PERSONAL', status: 'DONE', priority: 'HIGH', dueDate: daysAgo(2), assigneeId: DEMO_USER_ID, createdById: DEMO_USER_ID, completedAt: new Date().toISOString() },
    { id: uid(), title: 'Team standup presentation', area: 'WORK', status: 'DONE', priority: 'MEDIUM', dueDate: daysAgo(1), assigneeId: DEMO_USER_ID, createdById: DEMO_USER_ID, completedAt: new Date().toISOString() },
  ];
}

function demoExpenses(): StoredExpense[] {
  return [
    { id: uid(), amount: '250', description: 'Auto to office', expenseDate: today(), categoryId: 'cat-transport', paidById: DEMO_USER_ID },
    { id: uid(), amount: '180', description: 'Lunch at office canteen', expenseDate: today(), categoryId: 'cat-dining', paidById: DEMO_USER_ID },
    { id: uid(), amount: '450', description: 'Sabji and fruits from market', expenseDate: daysAgo(1), categoryId: 'cat-groceries', paidById: DEMO_USER_ID },
    { id: uid(), amount: '199', description: 'Netflix subscription', expenseDate: daysAgo(1), categoryId: 'cat-entertainment', paidById: DEMO_USER_ID },
    { id: uid(), amount: '350', description: 'Petrol', expenseDate: daysAgo(2), categoryId: 'cat-transport', paidById: DEMO_USER_ID },
    { id: uid(), amount: '1200', description: 'Groceries from BigBasket', expenseDate: daysAgo(3), categoryId: 'cat-groceries', paidById: DEMO_USER_ID },
    { id: uid(), amount: '500', description: 'Dinner with friends', expenseDate: daysAgo(3), categoryId: 'cat-dining', paidById: DEMO_USER_ID },
    { id: uid(), amount: '300', description: 'Medicine from Apollo Pharmacy', expenseDate: daysAgo(4), categoryId: 'cat-health', paidById: DEMO_USER_ID },
    { id: uid(), amount: '150', description: 'Chai and snacks', expenseDate: daysAgo(5), categoryId: 'cat-dining', paidById: DEMO_USER_ID },
    { id: uid(), amount: '2500', description: 'New shoes from Myntra', expenseDate: daysAgo(8), categoryId: 'cat-shopping', paidById: DEMO_USER_ID },
    { id: uid(), amount: '800', description: 'Electricity bill', expenseDate: daysAgo(10), categoryId: 'cat-utilities', paidById: DEMO_USER_ID },
    { id: uid(), amount: '450', description: 'Petrol', expenseDate: daysAgo(9), categoryId: 'cat-transport', paidById: DEMO_USER_ID },
    { id: uid(), amount: '350', description: 'Zomato order', expenseDate: daysAgo(7), categoryId: 'cat-dining', paidById: DEMO_USER_ID },
    { id: uid(), amount: '1500', description: 'Weekly groceries', expenseDate: daysAgo(10), categoryId: 'cat-groceries', paidById: DEMO_USER_ID },
    { id: uid(), amount: '3000', description: 'Monthly gym membership', expenseDate: daysAgo(15), categoryId: 'cat-health', paidById: DEMO_USER_ID },
    { id: uid(), amount: '600', description: 'Swiggy orders', expenseDate: daysAgo(12), categoryId: 'cat-dining', paidById: DEMO_USER_ID },
    { id: uid(), amount: '1800', description: 'Amazon order - books', expenseDate: daysAgo(14), categoryId: 'cat-shopping', paidById: DEMO_USER_ID },
    { id: uid(), amount: '250', description: 'Auto rides', expenseDate: daysAgo(13), categoryId: 'cat-transport', paidById: DEMO_USER_ID },
    { id: uid(), amount: '400', description: 'Movie tickets', expenseDate: daysAgo(11), categoryId: 'cat-entertainment', paidById: DEMO_USER_ID },
    { id: uid(), amount: '1200', description: 'Groceries', expenseDate: daysAgo(35), categoryId: 'cat-groceries', paidById: DEMO_USER_ID },
    { id: uid(), amount: '800', description: 'Electricity bill', expenseDate: daysAgo(40), categoryId: 'cat-utilities', paidById: DEMO_USER_ID },
    { id: uid(), amount: '500', description: 'Petrol', expenseDate: daysAgo(38), categoryId: 'cat-transport', paidById: DEMO_USER_ID },
    { id: uid(), amount: '2000', description: 'Dinner outing', expenseDate: daysAgo(33), categoryId: 'cat-dining', paidById: DEMO_USER_ID },
    { id: uid(), amount: '3000', description: 'Gym membership', expenseDate: daysAgo(45), categoryId: 'cat-health', paidById: DEMO_USER_ID },
  ];
}

function demoShopping(): ShoppingItem[] {
  const now = new Date().toISOString();
  return [
    { id: uid(), name: 'Milk', category: 'GROCERIES', checked: false, addedById: DEMO_USER_ID, createdAt: now },
    { id: uid(), name: 'Bread', category: 'GROCERIES', checked: false, addedById: DEMO_USER_ID, createdAt: now },
    { id: uid(), name: 'Eggs (1 dozen)', category: 'GROCERIES', checked: false, addedById: DEMO_USER_ID, createdAt: now },
    { id: uid(), name: 'Rice 5kg', category: 'GROCERIES', checked: true, addedById: DEMO_USER_ID, createdAt: now },
    { id: uid(), name: 'Cooking oil', category: 'GROCERIES', checked: false, addedById: DEMO_USER_ID, createdAt: now },
    { id: uid(), name: 'Toothpaste', category: 'PHARMACY', checked: true, addedById: DEMO_USER_ID, createdAt: now },
    { id: uid(), name: 'Detergent', category: 'HOME', checked: false, addedById: DEMO_USER_ID, createdAt: now },
  ];
}

function demoReminders(): Reminder[] {
  return [
    { id: uid(), title: 'Pay electricity bill', dueDate: tomorrow(), repeat: 'MONTHLY', createdById: DEMO_USER_ID },
    { id: uid(), title: 'Mom birthday', dueDate: daysFromNow(12), repeat: 'YEARLY', createdById: DEMO_USER_ID },
    { id: uid(), title: 'Car insurance renewal', dueDate: daysFromNow(3), repeat: 'NONE', createdById: DEMO_USER_ID },
    { id: uid(), title: 'Credit card payment', dueDate: daysFromNow(8), repeat: 'MONTHLY', createdById: DEMO_USER_ID },
  ];
}

function demoNotes(): DailyNote[] {
  const author = { id: DEMO_USER_ID, name: DEMO_USER.name, color: DEMO_USER.color };
  return [
    { id: uid(), noteDate: today(), content: 'Had a productive morning. Completed budget review before breakfast. Need to focus on the AWS certification — been procrastinating too long.', noteKind: 'REFLECTION', area: 'PERSONAL', author },
    { id: uid(), noteDate: daysAgo(1), content: 'Grateful for the team support on the project. Also thankful that Mom liked her birthday gift.', noteKind: 'GRATITUDE', area: 'PERSONAL', author },
    { id: uid(), noteDate: daysAgo(3), content: 'Idea: Build a travel planning tool. I spend so much time researching trips — could automate this.', noteKind: 'GENERAL', area: 'WORK', author },
  ];
}

function demoVisionBoard(): VisionBoardItem[] {
  return [
    { id: uid(), title: 'Buy a house in Noida', emoji: '🏠', category: 'FINANCE', color: '#10B981', caption: 'Target: ₹50 lakh by 2028', ownerId: DEMO_USER_ID, achieved: false, createdAt: daysAgo(60) },
    { id: uid(), title: 'Lose 10 kg weight', emoji: '💪', category: 'HEALTH_FITNESS', color: '#EF4444', caption: 'Current: 82 kg, Target: 72 kg', ownerId: DEMO_USER_ID, achieved: false, createdAt: daysAgo(45) },
    { id: uid(), title: 'Start a travel business', emoji: '✈️', category: 'OTHER', color: '#7C3AED', caption: 'Side hustle first, then full time', ownerId: DEMO_USER_ID, achieved: false, createdAt: daysAgo(90) },
    { id: uid(), title: 'Complete AWS certification', emoji: '🚀', category: 'OTHER', color: '#6366F1', caption: 'Will help with promotion', ownerId: DEMO_USER_ID, achieved: false, createdAt: daysAgo(30) },
    { id: uid(), title: 'Save ₹5 lakh emergency fund', emoji: '💰', category: 'FINANCE', color: '#F59E0B', caption: 'Currently at ₹2.3 lakh', ownerId: DEMO_USER_ID, achieved: false, createdAt: daysAgo(120) },
    { id: uid(), title: 'Read 24 books this year', emoji: '📚', category: 'OTHER', color: '#3B82F6', caption: '8 done so far', ownerId: DEMO_USER_ID, achieved: false, createdAt: daysAgo(150) },
    { id: uid(), title: 'Run a 10K marathon', emoji: '🏃', category: 'HEALTH_FITNESS', color: '#F97316', caption: 'Training started', ownerId: DEMO_USER_ID, achieved: false, createdAt: daysAgo(20) },
    { id: uid(), title: 'Paid off credit card debt', emoji: '✅', category: 'FINANCE', color: '#10B981', caption: 'Cleared ₹45,000 in 3 months', ownerId: DEMO_USER_ID, achieved: true, createdAt: daysAgo(100) },
  ];
}

function makeRoutineItems(labels: string[]): RoutineItem[] {
  return labels.map((label) => ({ id: uid(), label }));
}

function buildRoutinesAndLogs() {
  const morningItems = makeRoutineItems([
    'Wake up early', 'Drink water', 'Stretch 5 mins', 'Deep breathing',
    'Wash face', 'Healthy breakfast', 'Short walk', 'Journal 3 lines',
    'Plan your day', '30 min exercise',
  ]);
  const eveningItems = makeRoutineItems([
    'Evening walk', 'Light stretching', 'Healthy dinner', 'Journal thoughts',
    'Meditation 10 min', 'Read 20 pages', 'No phone before sleep',
    'Herbal tea', 'Skincare', 'Sleep by 11 PM',
  ]);

  const routines = [
    { id: 'routine-morning', name: 'Morning routine', timeOfDay: 'MORNING' as const, items: morningItems },
    { id: 'routine-evening', name: 'Evening routine', timeOfDay: 'EVENING' as const, items: eveningItems },
  ];

  const logs: RoutineDayLog[] = [];
  for (let i = 0; i < 7; i++) {
    const date = daysAgo(i);
    const mornCount = i < 3 ? 10 : i < 5 ? 5 : 2;
    const eveCount = i < 2 ? 10 : i < 4 ? 5 : 1;
    logs.push(
      { routineId: 'routine-morning', date, doneItemIds: morningItems.slice(0, mornCount).map((it) => it.id) },
      { routineId: 'routine-evening', date, doneItemIds: eveningItems.slice(0, eveCount).map((it) => it.id) },
    );
  }

  return { routines, logs };
}

function seedDemoMemories(): void {
  localStorage.removeItem('rozka_ai_memory');
  const memories = [
    { type: 'goal' as const, content: 'I want to buy a house in Noida by 2028' },
    { type: 'promise' as const, content: 'I will complete AWS certification this month' },
    { type: 'idea' as const, content: 'Build a travel planning tool - I spend 12 hours/week researching trips' },
    { type: 'promise' as const, content: 'Will start going to gym regularly from Monday' },
    { type: 'voice_input' as const, content: 'aaj 250 ka auto liya office ke liye' },
    { type: 'voice_input' as const, content: '450 rupaye sabji aur fruits' },
    { type: 'idea' as const, content: 'Side income idea: freelance cloud consulting' },
    { type: 'goal' as const, content: 'Save 5 lakh emergency fund by December' },
    { type: 'voice_input' as const, content: 'kal dentist appointment hai 11 baje' },
    { type: 'promise' as const, content: 'Will call Mom every Sunday' },
  ];
  for (const m of memories) {
    addMemory(m);
  }
}

export function generateDemoData(): AppData {
  const { routines, logs } = buildRoutinesAndLogs();

  return {
    users: [DEMO_USER],
    tasks: demoTasks(),
    expenses: demoExpenses(),
    notes: demoNotes(),
    categories: [
      { id: 'cat-groceries', name: 'Groceries', color: '#10B981' },
      { id: 'cat-dining', name: 'Dining Out', color: '#F59E0B' },
      { id: 'cat-transport', name: 'Transport', color: '#3B82F6' },
      { id: 'cat-utilities', name: 'Utilities', color: '#6366F1' },
      { id: 'cat-shopping', name: 'Shopping', color: '#EC4899' },
      { id: 'cat-health', name: 'Health', color: '#EF4444' },
      { id: 'cat-entertainment', name: 'Entertainment', color: '#8B5CF6' },
      { id: 'cat-other', name: 'Other', color: '#6B7280' },
    ],
    shoppingItems: demoShopping(),
    routines,
    routineLogs: logs,
    reminders: demoReminders(),
    visionBoard: demoVisionBoard(),
    settlements: [],
    setupComplete: true,
    householdType: 'SINGLE',
    connections: [],
  };
}

export function activateDemoMode(): void {
  const data = generateDemoData();
  localStorage.setItem('daylife_data', JSON.stringify(data));
  localStorage.setItem('daylife_session', JSON.stringify({ userId: DEMO_USER_ID }));
  localStorage.removeItem('rozka_autopilot_cache');
  localStorage.removeItem('rozka_dream_plans');
  localStorage.removeItem('rozka_life_dashboard_cache');
  seedDemoMemories();
  localStorage.setItem('rozka_cache_v2', '1');
}

export const DEMO_USER_INFO = DEMO_USER;
