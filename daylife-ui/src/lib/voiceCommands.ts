import type { Task } from './api';

export type VoiceAction =
  | { type: 'task'; title: string; area: Task['area'] }
  | { type: 'expense'; amount: number; description: string; categoryId: string }
  | { type: 'shopping'; name: string }
  | { type: 'note'; content: string };

export type VoiceLang = 'hi-IN' | 'en-IN' | 'en-US';

const VOICE_LANG_KEY = 'daylife_voice_lang';

export function getVoiceLang(): VoiceLang {
  const v = localStorage.getItem(VOICE_LANG_KEY);
  if (v === 'hi-IN' || v === 'en-IN' || v === 'en-US') return v;
  return 'hi-IN';
}

export function setVoiceLang(lang: VoiceLang): void {
  localStorage.setItem(VOICE_LANG_KEY, lang);
}

function normalizeSpeech(text: string): string {
  return text
    .toLowerCase()
    .replace(/[₹$]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.!?]+$/, '');
}

/** Split "task X aur kharcha 500" into separate parts */
function splitClauses(text: string): string[] {
  return text
    .split(/\s+and\s+|\s+aur\s+|\s+also\s+|\s+phir\s+|\s+then\s+|,\s*|\s+\/\s*/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseAmount(text: string): number | null {
  const m =
    text.match(/(\d+(?:\.\d{1,2})?)/) ||
    text.match(/(?:^|\s)((\d+(?:\.\d{1,2})?))\s*(?:rupaye|rupees|rupee|rupya|rs|inr|dollar|bucks)?/i);
  if (!m?.[1]) return null;
  const n = parseFloat(m[1]);
  return n > 0 && n < 10_000_000 ? n : null;
}

function stripAmount(text: string): string {
  return text
    .replace(/(?:₹|rs\.?|inr)\s*\d+(?:\.\d{1,2})?/gi, ' ')
    .replace(/\d+(?:\.\d{1,2})?\s*(?:rupaye|rupees|rupee|rupya|rs\.?)/gi, ' ')
    .replace(/\d+(?:\.\d{1,2})?\s*(?:ka|ki|ke)\s+(?:kharcha|kharch)/gi, ' ')
    .replace(/(?:kharcha|kharch|expense|spent|paid|diye|diya|lagaye|lagaya|pay kiya|kharcha hua)\s*(?:₹|rs\.?)?\s*\d+(?:\.\d{1,2})?/gi, ' ')
    .replace(/\d+(?:\.\d{1,2})?/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function inferExpenseCategory(description: string): string {
  const d = description.toLowerCase();
  if (/grocery|groceries|milk|doodh|bread|roti|eggs|anda|sabzi|sabji|vegetable|supermarket|kirana|ration/.test(d)) {
    return 'cat-groceries';
  }
  if (/coffee|lunch|dinner|breakfast|nashta|khana|food|restaurant|chai|meal|hotel|tiffin/.test(d)) {
    return 'cat-dining';
  }
  if (/gas|petrol|diesel|uber|ola|auto|taxi|bus|train|parking|fuel|transport/.test(d)) {
    return 'cat-transport';
  }
  if (/rent|kiraya|electric|bijli|water|paani|internet|phone|mobile|recharge|utility|bill/.test(d)) {
    return 'cat-utilities';
  }
  if (/doctor|dawai|medicine|pharmacy|health|hospital|clinic/.test(d)) {
    return 'cat-health';
  }
  if (/movie|netflix|game|concert|fun|entertainment/.test(d)) {
    return 'cat-entertainment';
  }
  if (/amazon|clothes|kapde|shirt|shoes|shopping|mall/.test(d)) {
    return 'cat-shopping';
  }
  return 'cat-other';
}

function inferTaskArea(clause: string, title: string): { area: Task['area']; title: string } {
  if (/^(?:work|office|kaam office)\b/i.test(clause)) {
    return { area: 'WORK', title: title.replace(/^(?:work|office)\s+/i, '').trim() };
  }
  if (/^(?:home|ghar)\b/i.test(clause)) {
    return { area: 'HOME', title: title.replace(/^(?:home|ghar)\s+/i, '').trim() };
  }
  return { area: 'PERSONAL', title };
}

function cleanTaskTitle(raw: string): string {
  return raw
    .replace(/^(?:please|add|create|make|karo|kariye|dal do|dalo|likho)\s+/i, '')
    .replace(/\s+(?:karna hai|krna hai|kar do|karni hai|karna h|task hai)$/i, '')
    .trim();
}

function isExpenseClause(clause: string): boolean {
  return /(?:kharcha|kharch|expense|spent|paid|diye|diya|lagaye|lagaya|pay kiya|rupe|rs\b|₹|\$\d|\d+\s*(?:rupaye|rupees|rs))/i.test(
    clause,
  );
}

function isTaskClause(clause: string): boolean {
  return /(?:task|kaam|todo|karna hai|krna hai|yaad dilao|remind|aaj ka kaam|aaj task)/i.test(clause);
}

function isShoppingClause(clause: string): boolean {
  return /(?:shopping|kharidna|khareedna|kharid|list mein|buy|get)\b/i.test(clause);
}

function isNoteClause(clause: string): boolean {
  return /^(?:note|yaad rakho|yaad rakh|likho|journal)\b/i.test(clause);
}

function parseExpense(clause: string): VoiceAction | null {
  const amount = parseAmount(clause);
  if (!amount) return null;

  let description = stripAmount(clause)
    .replace(/^(?:kharcha|kharch|expense|spent|paid|diye|diya|lagaye|lagaya|pay kiya|log)\s*/i, '')
    .replace(/^(?:on|for|par|mein|pe|per|ka|ki|ke)\s+/i, '')
    .replace(/^(?:rupaye|rupees|rupee|rupya|rs)\s*/i, '')
    .trim();

  if (!description || description.length < 2) description = 'Kharcha';

  return {
    type: 'expense',
    amount,
    description: description.charAt(0).toUpperCase() + description.slice(1),
    categoryId: inferExpenseCategory(description),
  };
}

function parseTask(clause: string): VoiceAction | null {
  const patterns: RegExp[] = [
    /^(?:add\s+)?(?:a\s+)?(?:aaj|today'?s?|todays?)\s+(?:ka\s+)?(?:task|kaam)[:\s]+(.+)$/i,
    /^(?:add\s+)?(?:a\s+)?(?:task|kaam|todo)[:\s]+(.+)$/i,
    /^(?:mujhe|muje|mujhko|main)\s+(.+)$/i,
    /^(?:yaad dilao|remind me|remind)[:\s]+(.+)$/i,
    /^(.+?\s+karna hai)$/i,
    /^(.+?\s+krna hai)$/i,
    /^(.+?\s+kar do)$/i,
  ];

  for (const pattern of patterns) {
    const match = clause.match(pattern);
    if (match?.[1]?.trim()) {
      const title = cleanTaskTitle(match[1].trim());
      if (title.length >= 2 && !isExpenseClause(title)) {
        const { area, title: t } = inferTaskArea(clause, title);
        if (t.length >= 2) return { type: 'task', title: t, area };
      }
    }
  }
  return null;
}

function parseShopping(clause: string): VoiceAction | null {
  const patterns = [
    /^(?:add\s+)?(?:shopping(?:\s+list)?|list mein|kharidna|khareedna)[:\s]+(.+)$/i,
    /^(?:buy|get|kharid)\s+(.+)$/i,
  ];
  for (const pattern of patterns) {
    const match = clause.match(pattern);
    if (match?.[1]?.trim()) {
      const name = match[1].trim();
      if (name.length >= 2 && !parseAmount(name)) {
        return { type: 'shopping', name };
      }
    }
  }
  return null;
}

function parseNote(clause: string): VoiceAction | null {
  const match = clause.match(/^(?:note|yaad rakho|yaad rakh|likho|journal)[:\s]+(.+)$/i);
  if (match?.[1]?.trim()) {
    return { type: 'note', content: match[1].trim() };
  }
  return null;
}

function parseClause(clause: string): VoiceAction | null {
  const c = clause.trim();
  if (!c) return null;

  if (isNoteClause(c)) return parseNote(c) || null;
  if (isExpenseClause(c) || parseAmount(c)) return parseExpense(c) || null;
  if (isShoppingClause(c)) return parseShopping(c) || null;
  if (isTaskClause(c)) return parseTask(c) || null;

  return parseTask(c) || parseExpense(c) || parseShopping(c) || parseNote(c);
}

/** Last resort: plain speech becomes a task (unless it looks like expense) */
function parsePlainFallback(text: string): VoiceAction | null {
  if (parseAmount(text)) {
    const exp = parseExpense(text);
    if (exp) return exp;
  }
  const title = cleanTaskTitle(text);
  if (title.length >= 2 && title.length <= 120) {
    return { type: 'task', title, area: 'PERSONAL' };
  }
  return null;
}

export function parseVoiceTranscript(raw: string): VoiceAction[] {
  const text = normalizeSpeech(raw);
  if (!text) return [];

  const actions: VoiceAction[] = [];
  const clauses = splitClauses(text);

  for (const clause of clauses) {
    const action = parseClause(clause);
    if (action) actions.push(action);
  }

  if (actions.length === 0) {
    const fallback = parsePlainFallback(text);
    if (fallback) actions.push(fallback);
  }

  return actions;
}

export function describeVoiceAction(action: VoiceAction): string {
  switch (action.type) {
    case 'task':
      return `Task: ${action.title}`;
    case 'expense':
      return `Kharcha: ₹${action.amount.toFixed(0)} — ${action.description}`;
    case 'shopping':
      return `Shopping: ${action.name}`;
    case 'note':
      return `Note: ${action.content.slice(0, 40)}${action.content.length > 40 ? '…' : ''}`;
    default:
      return 'Unknown';
  }
}

export const VOICE_HINTS_HI = [
  'kaam doodh lana',
  'kharcha 500 sabzi par',
  'task gym jana aur kharcha 200 chai',
  'shopping anda aur bread',
];

export const VOICE_HINTS_EN = [
  'task buy milk',
  'spent 500 on groceries',
  'shopping eggs',
  'task call mom and spent 200 lunch',
];

export function hintsForLang(lang: VoiceLang): string[] {
  return lang === 'en-US' ? VOICE_HINTS_EN : [...VOICE_HINTS_HI, ...VOICE_HINTS_EN.slice(0, 2)];
}
