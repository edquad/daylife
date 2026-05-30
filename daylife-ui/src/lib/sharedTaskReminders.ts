import type { Task } from './api';
import type { Connection, SharedSpaceData } from './sharing';
import { todayISO } from './storage';

export function isEveningReminderWindow(now = new Date(), startHour = 20, endHour = 23): boolean {
  const hour = now.getHours();
  return hour >= startHour && hour <= endHour;
}

export function taskReminderKey(tasks: Task[]): string {
  return tasks
    .map((t) => t.id)
    .sort()
    .join(',');
}

export function partnerMissedTasks(
  tasks: Task[],
  partnerUserId: string | null,
  myUserId: string,
  today = todayISO(),
): Task[] {
  return tasks.filter((t) => {
    if (t.status === 'DONE' || !t.dueDate) return false;
    if (t.dueDate.slice(0, 10) > today) return false;
    if (partnerUserId) return t.assigneeId === partnerUserId;
    return Boolean(t.assigneeId && t.assigneeId !== myUserId);
  });
}

export function resolvePartnerUserId(
  space: SharedSpaceData,
  conn: Connection,
  myAccountId: string,
): string | null {
  const ids = space.memberUserIds;
  const accounts = space.memberAccountIds;
  if (ids?.length === 2 && accounts?.length === 2) {
    const partnerIdx = accounts.findIndex((a) => a === conn.partnerAccountId);
    if (partnerIdx >= 0 && ids[partnerIdx]) return ids[partnerIdx];
    const myIdx = accounts.findIndex((a) => a === myAccountId);
    if (myIdx >= 0) return ids[myIdx === 0 ? 1 : 0] || null;
  }
  return null;
}

export function buildEveningTaskReminderMessage(partnerName: string, tasks: Task[], today = todayISO()): string {
  const firstName = (partnerName.split(/\s+/)[0] || partnerName).replace(/^@/, '');
  const titles = tasks.map((t) => t.title).slice(0, 6);
  const overdue = tasks.filter((t) => t.dueDate!.slice(0, 10) < today);

  if (tasks.length === 1) {
    const when = overdue.length ? 'still pending' : 'still on your list for today';
    return `Hey ${firstName} 👋\n\nQuick nudge from Rozka — “${titles[0]}” is ${when}. Did you get a chance?`;
  }

  const list = titles.map((t) => `• ${t}`).join('\n');
  let intro = `Hey ${firstName} 👋\n\n`;
  if (overdue.length && overdue.length < tasks.length) {
    intro += `Friendly check-in — you have ${tasks.length} shared tasks still open (some from earlier days):`;
  } else if (overdue.length) {
    intro += `Looks like ${overdue.length} task${overdue.length > 1 ? 's' : ''} got missed — want to knock them out tonight?`;
  } else {
    intro += `${tasks.length} things still left on your plate tonight:`;
  }
  return `${intro}\n\n${list}\n\nNo auto-send — just Rozka keeping you both in sync 💜`;
}

export function shouldSkipReminder(
  space: SharedSpaceData,
  today: string,
  taskKey: string,
): boolean {
  const log = space.taskReminderLog;
  if (!log) return false;
  return log.date === today && log.taskKey === taskKey;
}
