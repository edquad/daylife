import { api } from './api';
import { useDateStore } from './dateStore';
import { todayISO } from './format';
import type { VoiceAction } from './voiceCommands';
import { describeVoiceAction } from './voiceCommands';

export async function executeVoiceActions(
  actions: VoiceAction[],
  userId: string,
): Promise<{ ok: string[]; failed: string[] }> {
  const selectedDate = useDateStore.getState().selectedDate || todayISO();
  const ok: string[] = [];
  const failed: string[] = [];

  for (const action of actions) {
    try {
      switch (action.type) {
        case 'task':
          await api.post('/tasks', {
            title: action.title,
            area: action.area,
            dueDate: selectedDate,
            assigneeId: userId,
            priority: 'MEDIUM',
          });
          break;
        case 'expense':
          await api.post('/expenses', {
            amount: action.amount,
            description: action.description,
            categoryId: action.categoryId,
            expenseDate: selectedDate,
            paidById: userId,
          });
          break;
        case 'shopping':
          await api.post('/shopping', { name: action.name, category: 'GROCERIES' });
          break;
        case 'note':
          await api.post('/notes', {
            content: action.content,
            area: 'PERSONAL',
            noteDate: selectedDate,
          });
          break;
      }
      ok.push(describeVoiceAction(action));
    } catch {
      failed.push(describeVoiceAction(action));
    }
  }

  return { ok, failed };
}

export function voiceQueryKeysToInvalidate(): string[][] {
  return [
    ['dashboard'],
    ['tasks'],
    ['expenses'],
    ['shopping'],
    ['shared-shopping'],
    ['shared-summary'],
  ];
}
