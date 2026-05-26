import type { Task } from './api';

export type VoiceAction =
  | { type: 'task'; title: string; area: Task['area'] }
  | { type: 'expense'; amount: number; description: string; categoryId: string }
  | { type: 'shopping'; name: string }
  | { type: 'note'; content: string };

function normalizeSpeech(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.!?]+$/, '');
}

function splitClauses(text: string): string[] {
  return text
    .split(/\s+and\s+|,\s*|\s+also\s+/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

function inferExpenseCategory(description: string): string {
  const d = description.toLowerCase();
  if (/grocery|groceries|milk|bread|eggs|supermarket|costco|walmart/.test(d)) return 'cat-groceries';
  if (/coffee|lunch|dinner|breakfast|restaurant|food|ate|meal|uber eats|doordash/.test(d)) return 'cat-dining';
  if (/gas|uber|lyft|taxi|bus|train|parking|fuel|transport/.test(d)) return 'cat-transport';
  if (/rent|electric|water|internet|phone bill|utility/.test(d)) return 'cat-utilities';
  if (/doctor|medicine|pharmacy|health|hospital/.test(d)) return 'cat-health';
  if (/movie|netflix|game|concert|fun/.test(d)) return 'cat-entertainment';
  if (/amazon|clothes|shirt|shoes|shopping/.test(d)) return 'cat-shopping';
  return 'cat-other';
}

function inferTaskArea(clause: string, title: string): { area: Task['area']; title: string } {
  if (/^work\s+task[:\s]+/i.test(clause) || /^work[:\s]+/i.test(clause)) {
    return { area: 'WORK', title: title.replace(/^work\s+/i, '').trim() };
  }
  if (/^home\s+task[:\s]+/i.test(clause) || /^home[:\s]+/i.test(clause)) {
    return { area: 'HOME', title: title.replace(/^home\s+/i, '').trim() };
  }
  return { area: 'PERSONAL', title };
}

function parseTask(clause: string): VoiceAction | null {
  const patterns = [
    /^(?:add\s+)?(?:a\s+)?(?:today'?s?|todays?)\s+task[:\s]+(.+)$/i,
    /^(?:add\s+)?(?:a\s+)?task[:\s]+(.+)$/i,
    /^(?:remind me to|i need to|need to|todo)[:\s]+(.+)$/i,
    /^complete\s+task[:\s]+(.+)$/i,
  ];
  for (const pattern of patterns) {
    const match = clause.match(pattern);
    if (match?.[1]?.trim()) {
      const rawTitle = match[1].trim();
      const { area, title } = inferTaskArea(clause, rawTitle);
      if (title.length >= 2) return { type: 'task', title, area };
    }
  }
  return null;
}

function parseExpense(clause: string): VoiceAction | null {
  const patterns = [
    /^(?:spent|pay|paid|expense|log)\s+\$?(\d+(?:\.\d{1,2})?)\s*(?:dollars?|bucks?|usd)?\s*(?:on|for)?\s*(.+)$/i,
    /^\$?(\d+(?:\.\d{1,2})?)\s*(?:dollars?|bucks?)?\s+(?:on|for)\s+(.+)$/i,
    /^expense[:\s]+\$?(\d+(?:\.\d{1,2})?)\s*(?:for|on)?\s*(.*)$/i,
  ];
  for (const pattern of patterns) {
    const match = clause.match(pattern);
    if (match?.[1]) {
      const amount = parseFloat(match[1]);
      const description = (match[2] || 'Expense').trim() || 'Expense';
      if (amount > 0 && amount < 1_000_000) {
        return {
          type: 'expense',
          amount,
          description,
          categoryId: inferExpenseCategory(description),
        };
      }
    }
  }
  return null;
}

function parseShopping(clause: string): VoiceAction | null {
  const patterns = [
    /^(?:add\s+)?(?:to\s+)?(?:the\s+)?shopping(?:\s+list)?[:\s]+(.+)$/i,
    /^buy[:\s]+(.+)$/i,
    /^get[:\s]+(.+)$/i,
  ];
  for (const pattern of patterns) {
    const match = clause.match(pattern);
    if (match?.[1]?.trim()) {
      return { type: 'shopping', name: match[1].trim() };
    }
  }
  return null;
}

function parseNote(clause: string): VoiceAction | null {
  const match = clause.match(/^(?:note|remember|journal)[:\s]+(.+)$/i);
  if (match?.[1]?.trim()) {
    return { type: 'note', content: match[1].trim() };
  }
  return null;
}

function parseClause(clause: string): VoiceAction | null {
  return (
    parseTask(clause) ||
    parseExpense(clause) ||
    parseShopping(clause) ||
    parseNote(clause)
  );
}

export function parseVoiceTranscript(raw: string): VoiceAction[] {
  const text = normalizeSpeech(raw);
  if (!text) return [];

  const actions: VoiceAction[] = [];
  for (const clause of splitClauses(text)) {
    const action = parseClause(clause);
    if (action) actions.push(action);
  }

  // Fallback: if nothing matched but they said "task" somewhere
  if (actions.length === 0 && /\btask\b/.test(text)) {
    const fallback = text.replace(/^.*?\btask\b[:\s]*/i, '').trim();
    if (fallback.length >= 2) {
      actions.push({ type: 'task', title: fallback, area: 'PERSONAL' });
    }
  }

  return actions;
}

export function describeVoiceAction(action: VoiceAction): string {
  switch (action.type) {
    case 'task':
      return `Task: ${action.title}`;
    case 'expense':
      return `Expense: $${action.amount.toFixed(2)} — ${action.description}`;
    case 'shopping':
      return `Shopping: ${action.name}`;
    case 'note':
      return `Note: ${action.content.slice(0, 40)}${action.content.length > 40 ? '…' : ''}`;
    default:
      return 'Unknown';
  }
}

export const VOICE_HINTS = [
  'Task buy milk',
  'Spent 15 on coffee',
  'Shopping eggs and bread',
  'Note had a good day',
  'Task call mom and spent 20 on lunch',
];
