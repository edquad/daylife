import type { ReminderRepeat, Task } from './api';

export type VoiceAction =
  | { type: 'task'; title: string; area: Task['area']; remind?: boolean; dueDate?: string }
  | { type: 'reminder'; title: string; dueDate: string; repeat?: ReminderRepeat; notes?: string }
  | { type: 'expense'; amount: number; description: string; categoryId: string }
  | { type: 'shopping'; name: string }
  | { type: 'note'; content: string };

export type VoiceLang = 'hi-IN' | 'en-US';

const VOICE_LANG_KEY = 'daylife_voice_lang';

export function getVoiceLang(): VoiceLang {
  const stored = localStorage.getItem(VOICE_LANG_KEY);
  if (stored === 'en-US' || stored === 'hi-IN') return stored;
  return 'hi-IN';
}

export function setVoiceLang(lang: VoiceLang): void {
  localStorage.setItem(VOICE_LANG_KEY, lang);
}

function normalizeSpeech(text: string): string {
  return text
    .replace(/[₹$]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.!?]+$/, '');
}

/** Lowercase for ASCII; keep Hindi script as-is for matching. */
function normalizeClause(text: string): string {
  const trimmed = text.trim();
  const ascii = trimmed.replace(/[A-Za-z]+/g, (w) => w.toLowerCase());
  return ascii.replace(/\s+/g, ' ').trim();
}

function splitClauses(text: string): string[] {
  const numbered = text
    .replace(/\b(?:please\s+)?create\s+\d+\s+tasks?\s*/i, '')
    .replace(/\b(?:pehla|pehle|first|1st|1\.?|ek)\s*(?:task|is|:)?\s*/gi, '||')
    .replace(/\b(?:doosra|dusra|second|2nd|2\.?|do)\s*(?:task|is|:)?\s*/gi, '||')
    .replace(/\b(?:teesra|third|3rd|3\.?)\s*(?:task|is|:)?\s*/gi, '||');

  return numbered
    .split(/\|\||\s+and\s+|\s+aur\s+|\s+also\s+|\s+फिर\s+|\s+then\s+|,\s*|\s+और\s+/i)
    .map((s) => normalizeClause(s))
    .filter((s) => s.length >= 2);
}

const TASK_PREFIX =
  /^(?:(?:add|aaj|today|today'?s?)\s+)?(?:(?:a|the|ek|one)\s+)?(?:task|tasks|todo|kaam|काम|टास्क|टास्क्स)(?:\s+(?:hai|karo|kar do|add karo|lagao))?[:\s]+(.+)$/i;

const TASK_PHRASES =
  /^(?:(?:remind me to|i need to|need to|mujhe|mujhko|yaad dilana|yaad rakhna|karna hai|kar do|karna h|please)\s+)(.+)$/i;

const SHOPPING_PREFIX =
  /^(?:(?:add\s+)?(?:to\s+)?(?:shopping(?:\s+list)?|kharid|khareed|buy list)|(?:khareedna|kharidna|lana|lena|buy|get))[:\s]+(.+)$/i;

const NOTE_PREFIX = /^(?:note|notes|remember|yaad|likho|journal|not)[:\s]+(.+)$/i;

const EXPENSE_VERB =
  /^(?:(?:spent|spend|paid|pay|expense|log|kharch|kharcha|खर्च|खर्चा|lagaye|lagaya|diya|diye|de diye|pay kiya|expense lagao))[:\s]*/i;

function parseAmountAndRest(clause: string): { amount: number; description: string } | null {
  const patterns: Array<{ re: RegExp; descIdx: number; amtIdx: number }> = [
    { re: /^(\d+(?:\.\d{1,2})?)\s*(?:rs|rupaye|rupees|rupee|bucks|dollars?|usd|₹|रुप(?:ये|या)?)\s*(?:mein|par|on|for|ka|ke)?\s*(.*)$/i, amtIdx: 1, descIdx: 2 },
    { re: /^(?:rs|rupaye|rupees|rupee|₹)\s*(\d+(?:\.\d{1,2})?)\s*(?:mein|par|on|for|ka|ke)?\s*(.*)$/i, amtIdx: 1, descIdx: 2 },
    { re: /^(\d+(?:\.\d{1,2})?)\s+(?:rs|rupaye|rupees|rupee|₹)\s*(?:mein|par|on|for|ka|ke)?\s*(.*)$/i, amtIdx: 1, descIdx: 2 },
    { re: /^(?:spent|spend|paid|pay|kharch|kharcha|expense)\s+(\d+(?:\.\d{1,2})?)\s*(?:rs|rupaye|rupees|rupee|bucks|dollars?|usd|₹)?\s*(?:on|for|par|mein|ka|ke)?\s*(.*)$/i, amtIdx: 1, descIdx: 2 },
    { re: /^(\d+(?:\.\d{1,2})?)\s+(?:on|for|par|mein|ka|ke)\s+(.+)$/i, amtIdx: 1, descIdx: 2 },
    { re: /^(\d+(?:\.\d{1,2})?)\s+(.+)$/i, amtIdx: 1, descIdx: 2 },
  ];

  for (const { re, amtIdx, descIdx } of patterns) {
    const match = clause.replace(EXPENSE_VERB, '').trim().match(re);
    if (match?.[amtIdx]) {
      const amount = parseFloat(match[amtIdx]);
      let description = (match[descIdx] || '').trim();
      description = description.replace(/^(?:par|mein|on|for|ka|ke)\s+/i, '').trim();
      if (amount > 0 && amount < 10_000_000) {
        return { amount, description: description || 'Expense' };
      }
    }
  }

  if (EXPENSE_VERB.test(clause)) {
    const stripped = clause.replace(EXPENSE_VERB, '').trim();
    const inline = stripped.match(/(\d+(?:\.\d{1,2})?)\s*(.*)/);
    if (inline) {
      const amount = parseFloat(inline[1]);
      const description = (inline[2] || 'Expense').replace(/^(?:rs|rupaye|rupees|rupee|₹)\s*/i, '').trim();
      if (amount > 0) return { amount, description: description || 'Expense' };
    }
  }

  return null;
}

function inferExpenseCategory(description: string): string {
  const d = description.toLowerCase();
  if (/grocery|groceries|milk|doodh|bread|roti|eggs|anda|sabzi|vegetable|supermarket|kirana|ration/.test(d)) {
    return 'cat-groceries';
  }
  if (/coffee|chai|lunch|dinner|breakfast|nashta|restaurant|food|khana|meal|swiggy|zomato/.test(d)) {
    return 'cat-dining';
  }
  if (/petrol|diesel|gas|uber|ola|auto|taxi|bus|train|parking|fuel|transport/.test(d)) {
    return 'cat-transport';
  }
  if (/rent|kiraya|electric|bijli|water|paani|internet|recharge|bill|utility/.test(d)) {
    return 'cat-utilities';
  }
  if (/doctor|dawai|medicine|pharmacy|health|hospital/.test(d)) {
    return 'cat-health';
  }
  if (/movie|netflix|game|concert|fun|entertainment/.test(d)) {
    return 'cat-entertainment';
  }
  if (/amazon|flipkart|clothes|kapde|shirt|shoes|shopping/.test(d)) {
    return 'cat-shopping';
  }
  return 'cat-other';
}

function inferTaskArea(clause: string, title: string): { area: Task['area']; title: string } {
  if (/^(?:work|office|kaam office)\b/i.test(clause) || /^office\s+/i.test(title)) {
    return { area: 'WORK', title: title.replace(/^(?:work|office)\s+/i, '').trim() };
  }
  if (/^(?:home|ghar)\b/i.test(clause) || /^ghar\s+/i.test(title)) {
    return { area: 'HOME', title: title.replace(/^(?:home|ghar)\s+/i, '').trim() };
  }
  return { area: 'PERSONAL', title };
}

function looksLikeExpense(clause: string): boolean {
  return (
    EXPENSE_VERB.test(clause) ||
    /\d+\s*(?:rs|rupaye|rupees|rupee|₹)/i.test(clause) ||
    /(?:rs|rupaye|rupees|₹)\s*\d+/i.test(clause) ||
    /^(?:spent|spend|paid|kharch|खर्च)/i.test(clause)
  );
}

function looksLikeShopping(clause: string): boolean {
  return /(?:shopping|kharid|khareed|buy list|lana|lena)\b/i.test(clause) && !looksLikeExpense(clause);
}

function looksLikeTask(clause: string): boolean {
  return /(?:task|todo|kaam|काम|टास्क|karna hai|kar do|yaad)/i.test(clause);
}

function parseTask(clause: string): VoiceAction | null {
  let rawTitle: string | null = null;

  const prefixMatch = clause.match(TASK_PREFIX);
  if (prefixMatch?.[1]) rawTitle = prefixMatch[1].trim();

  if (!rawTitle) {
    const phraseMatch = clause.match(TASK_PHRASES);
    if (phraseMatch?.[1]) rawTitle = phraseMatch[1].trim();
  }

  if (!rawTitle && looksLikeTask(clause)) {
    rawTitle = clause
      .replace(/^(?:(?:add|aaj|today)\s+)?(?:task|tasks|todo|kaam|टास्क)[:\s]*/i, '')
      .replace(/^(?:karna hai|kar do|mujhe|mujhko)\s+/i, '')
      .trim();
  }

  if (rawTitle && rawTitle.length >= 2 && !looksLikeExpense(rawTitle)) {
    const { area, title } = inferTaskArea(clause, rawTitle);
    if (title.length >= 2) return { type: 'task', title, area };
  }
  return null;
}

function parseExpense(clause: string): VoiceAction | null {
  if (!looksLikeExpense(clause) && !/^\d+(?:\.\d+)?\s+\D/.test(clause)) return null;
  const parsed = parseAmountAndRest(clause);
  if (!parsed) return null;
  return {
    type: 'expense',
    amount: parsed.amount,
    description: parsed.description,
    categoryId: inferExpenseCategory(parsed.description),
  };
}

function parseShopping(clause: string): VoiceAction | null {
  const prefixMatch = clause.match(SHOPPING_PREFIX);
  if (prefixMatch?.[1]?.trim()) {
    return { type: 'shopping', name: prefixMatch[1].trim() };
  }
  if (looksLikeShopping(clause)) {
    const name = clause
      .replace(/^(?:(?:add\s+)?(?:shopping|kharid|buy|lana|lena)[:\s]+)/i, '')
      .trim();
    if (name.length >= 2) return { type: 'shopping', name };
  }
  return null;
}

function parseNote(clause: string): VoiceAction | null {
  const match = clause.match(NOTE_PREFIX);
  if (match?.[1]?.trim()) return { type: 'note', content: match[1].trim() };
  return null;
}

function parseClause(clause: string): VoiceAction | null {
  return (
    parseExpense(clause) ||
    parseTask(clause) ||
    parseShopping(clause) ||
    parseNote(clause)
  );
}

/** If nothing matched, treat short phrases as tasks (common when speaking naturally). */
function fallbackAction(clause: string): VoiceAction | null {
  if (clause.length < 3 || looksLikeExpense(clause)) return null;
  if (/^\d+$/.test(clause)) return null;
  return { type: 'task', title: clause.charAt(0).toUpperCase() + clause.slice(1), area: 'PERSONAL' };
}

export function parseVoiceTranscript(raw: string): VoiceAction[] {
  const text = normalizeSpeech(raw);
  if (!text) return [];

  const clauses = splitClauses(text);
  const actions: VoiceAction[] = [];

  for (const clause of clauses.length > 0 ? clauses : [normalizeClause(text)]) {
    const action = parseClause(clause) || fallbackAction(clause);
    if (action) actions.push(action);
  }

  return actions;
}

export function describeVoiceAction(action: VoiceAction): string {
  switch (action.type) {
    case 'task':
      return action.remind ? `Task + reminder: ${action.title}` : `Task: ${action.title}`;
    case 'reminder':
      return `Reminder: ${action.title}`;
    case 'expense':
      return `Expense: ₹${action.amount.toFixed(0)} — ${action.description}`;
    case 'shopping':
      return `Shopping: ${action.name}`;
    case 'note':
      return `Note: ${action.content.slice(0, 40)}${action.content.length > 40 ? '…' : ''}`;
    default:
      return 'Unknown';
  }
}

export const VOICE_HINTS_HI = [
  '2 task: doodh order karo aur sabzi, yaad bhi dilana',
  'task bill pay karo remind karna',
  'kharch 50 chai par',
  'shopping anda bread',
];

export const VOICE_HINTS_EN = [
  'create 2 tasks order milk and order veggies, remind me',
  'task pay bills remind me tomorrow',
  'spent 15 on coffee',
  'shopping eggs',
];

export function getVoiceHints(lang: VoiceLang): string[] {
  return lang === 'hi-IN' ? VOICE_HINTS_HI : VOICE_HINTS_EN;
}
