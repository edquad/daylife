import { api, type Connection } from './api';
import { useDateStore } from './dateStore';
import { todayISO } from './format';
import type { VoiceAction } from './voiceCommands';
import { describeVoiceAction } from './voiceCommands';

async function logExpenseAmount(
  amount: number,
  description: string,
  categoryId: string,
  userId: string,
  expenseDate: string,
): Promise<void> {
  const connections = await api.get<Connection[]>('/connections');
  const shared = connections.find(
    (c) => c.status === 'active' && c.sharedSpaceId && c.features.includes('expenses'),
  );
  if (shared?.sharedSpaceId) {
    await api.post(`/shared/${shared.sharedSpaceId}/expenses`, {
      amount,
      description,
      categoryId,
      expenseDate,
    });
    return;
  }
  await api.post('/expenses', {
    amount,
    description,
    categoryId,
    expenseDate,
    paidById: userId,
  });
}

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
          await logExpenseAmount(
            action.amount,
            action.description,
            action.categoryId,
            userId,
            selectedDate,
          );
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
    ['shared-expenses'],
    ['shopping'],
    ['shared-shopping'],
    ['shared-summary'],
  ];
}
