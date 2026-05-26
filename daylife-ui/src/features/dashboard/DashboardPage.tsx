import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api, Expense, Task, User, Connection } from '../../lib/api';
import { useAuth } from '../auth/AuthContext';
import { useDateStore } from '../../lib/dateStore';
import { formatDayHeading, formatMoney, todayISO } from '../../lib/format';
import { DayPicker } from '../../components/DayPicker';
import { PersonDayColumn } from '../../components/PersonDayColumn';
import { SharedDayColumn } from '../../components/SharedDayColumn';
import { VisibilityToggle } from '../../components/VisibilityToggle';
import { defaultVisibility } from '../../lib/privacy';
import type { ItemVisibility } from '../../lib/privacy';
import {
  AlertCircle,
  Plus,
  StickyNote,
  ShoppingCart,
  Sun,
  Bell,
  Receipt,
  Users,
  ChevronRight,
} from 'lucide-react';
import { AREA_COLORS, AREA_LABELS, memberGridClass } from '../../lib/utils';
import { SharedFeatureLinks } from '../../components/SharedFeatureLinks';

interface PersonSummary {
  userId: string;
  name: string;
  color: string;
  role: string;
  total: number;
  done: number;
  pending: number;
  tasks: Task[];
}

interface DaySummary {
  date: string;
  byPerson: PersonSummary[];
  overdueCount: number;
  todayExpenses: Expense[];
  todayExpenseTotal: string;
  monthExpenseTotal: string;
  monthTasksDone?: number;
  monthTasksTotal?: number;
  monthTasksPending?: Task[];
  shoppingPending?: number;
  routineDone?: number;
  routineTotal?: number;
  upcomingReminders?: Array<{ id: string; title: string; nextDate: string; daysUntil: number }>;
  recentNotes: Array<{ id: string; content: string; area: string; author: { name: string } }>;
}

function QuickLink({
  to,
  icon,
  label,
  detail,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  detail?: string;
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-2.5 shrink-0 min-w-[7.5rem] px-3 py-2.5 bg-white border border-gray-200 rounded-xl hover:border-brand-300 hover:bg-brand-50/30 transition-colors touch-manipulation"
    >
      <span className="text-brand-600">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs text-gray-500">{label}</p>
        {detail && <p className="text-sm font-semibold text-gray-900 truncate">{detail}</p>}
      </div>
    </Link>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const selectedDate = useDateStore((s) => s.selectedDate);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<DaySummary>({
    queryKey: ['dashboard', selectedDate],
    queryFn: () => api.get(`/dashboard/summary?date=${selectedDate}`),
  });

  const { data: members = [] } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: () => api.get('/users'),
  });

  const { data: sharedSummary } = useQuery<{
    columns: Array<{ spaceId: string; partnerName: string; partnerUsername: string; tasks: Task[] }>;
    expenseGroups: Array<{ spaceId: string; partnerName: string; expenses: Expense[]; total: string }>;
    noteGroups: Array<{ spaceId: string; partnerName: string; notes: Array<{ id: string; content: string; area: string; author: { name: string } }> }>;
  }>({
    queryKey: ['shared-summary', selectedDate],
    queryFn: () => api.get(`/shared/summary?date=${selectedDate}`),
  });

  const { data: connections = [] } = useQuery<Connection[]>({
    queryKey: ['connections'],
    queryFn: () => api.get('/connections'),
  });

  const hasActiveShare = connections.some((c) => c.status === 'active');
  const activeConnections = connections.filter((c) => c.status === 'active');
  const sharedColumns = sharedSummary?.columns ?? [];
  const sharedExpenseGroups = sharedSummary?.expenseGroups ?? [];
  const sharedNoteGroups = sharedSummary?.noteGroups ?? [];

  const addNote = useMutation({
    mutationFn: (payload: { content: string; visibility: ItemVisibility }) =>
      api.post('/notes', {
        content: payload.content,
        area: 'PERSONAL',
        noteDate: selectedDate,
        visibility: payload.visibility,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
  });

  const addSharedNote = useMutation({
    mutationFn: ({ spaceId, content }: { spaceId: string; content: string }) =>
      api.post(`/shared/${spaceId}/notes`, { content, noteDate: selectedDate }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['shared-summary'] }),
  });

  const [dayNote, setDayNote] = React.useState('');
  const [showNote, setShowNote] = React.useState(false);
  const [sharedNoteDrafts, setSharedNoteDrafts] = React.useState<Record<string, string>>({});
  const [noteVisibility, setNoteVisibility] = React.useState<ItemVisibility>(
    defaultVisibility(members.length),
  );

  if (isLoading) {
    return (
      <div className="p-4 max-w-3xl mx-auto animate-pulse space-y-4">
        <div className="h-9 bg-gray-200 rounded w-48" />
        <div className="h-64 bg-gray-200 rounded-2xl" />
      </div>
    );
  }

  const byPerson = data?.byPerson ?? [];
  const isMultiMember = members.length > 1;
  const isToday = selectedDate === todayISO();
  const monthKey = selectedDate.slice(0, 7);
  const monthTasksPending = data?.monthTasksPending ?? [];
  const shoppingPending = data?.shoppingPending ?? 0;
  const routineDone = data?.routineDone ?? 0;
  const routineTotal = data?.routineTotal ?? 0;
  const upcomingReminders = data?.upcomingReminders ?? [];
  const todayExpenses = data?.todayExpenses ?? [];
  const hasTodayExpenses =
    todayExpenses.length > 0 || sharedExpenseGroups.some((g) => g.expenses.length > 0);

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-gray-900 truncate">{formatDayHeading(selectedDate)}</h1>
          {user?.name && isToday && (
            <p className="text-sm text-gray-500">Hi {user.name.split(' ')[0]}</p>
          )}
        </div>
        <DayPicker />
      </div>

      {(data?.overdueCount ?? 0) > 0 && isToday && (
        <Link
          to="/tasks?status=TODO"
          className="flex items-center gap-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800"
        >
          <AlertCircle size={16} className="shrink-0" />
          <span>{data!.overdueCount} overdue — tap to view</span>
          <ChevronRight size={16} className="ml-auto shrink-0" />
        </Link>
      )}

      <div className={memberGridClass(Math.max(members.length, 1) + sharedColumns.length)}>
        {[...members]
          .sort((a, b) => {
            if (a.id === user?.id) return -1;
            if (b.id === user?.id) return 1;
            return 0;
          })
          .map((member) => {
            const personData = byPerson.find((p) => p.userId === member.id);
            return (
              <PersonDayColumn
                key={member.id}
                person={member}
                tasks={personData?.tasks ?? []}
                selectedDate={selectedDate}
                highlight={member.id === user?.id}
                compact={member.id === user?.id && !isMultiMember}
              />
            );
          })}
        {sharedColumns.map((col) => (
          <SharedDayColumn
            key={col.spaceId}
            spaceId={col.spaceId}
            partnerName={col.partnerName}
            tasks={col.tasks}
            selectedDate={selectedDate}
          />
        ))}
      </div>

      {hasActiveShare && sharedColumns.length === 0 && activeConnections.length > 0 && (
        <div className="px-3 py-2.5 rounded-xl bg-violet-50 border border-violet-100 text-sm">
          <p className="text-violet-900 font-medium">
            Sharing with @{activeConnections[0].partnerUsername}
          </p>
          <SharedFeatureLinks features={activeConnections[0].features} className="mt-2" />
        </div>
      )}

      {!hasActiveShare && (
        <p className="text-center text-sm text-gray-500">
          Share lists with someone?{' '}
          <Link to="/connections" className="text-brand-600 font-medium hover:underline">
            Invite by username
          </Link>
        </p>
      )}

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        <QuickLink
          to={`/expenses?date=${selectedDate}`}
          icon={<Receipt size={18} />}
          label="Spent today"
          detail={formatMoney(data?.todayExpenseTotal)}
        />
        <QuickLink
          to="/daily?tab=routines"
          icon={<Sun size={18} />}
          label="Routines"
          detail={`${routineDone}/${routineTotal}`}
        />
        <QuickLink
          to="/daily?tab=shopping"
          icon={<ShoppingCart size={18} />}
          label="Shopping"
          detail={shoppingPending === 0 ? 'All done' : `${shoppingPending} left`}
        />
        <QuickLink
          to="/daily?tab=reminders"
          icon={<Bell size={18} />}
          label="Reminders"
          detail={upcomingReminders.length === 0 ? 'None soon' : `${upcomingReminders.length} soon`}
        />
        <QuickLink
          to="/connections"
          icon={<Users size={18} />}
          label="Share"
          detail={hasActiveShare ? 'Connected' : 'Invite'}
        />
      </div>

      {monthTasksPending.length > 0 && (
        <section className="bg-white rounded-xl border p-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-800">Open this month</h3>
            <Link to={`/tasks?month=${monthKey}&status=TODO`} className="text-xs text-brand-600">
              All
            </Link>
          </div>
          <div className="space-y-1">
            {monthTasksPending.slice(0, 3).map((task) => (
              <Link
                key={task.id}
                to={`/tasks?month=${monthKey}`}
                className="flex items-center justify-between py-1.5 text-sm hover:bg-gray-50 rounded-lg px-1 -mx-1"
              >
                <span className="truncate font-medium">{task.title}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full shrink-0 ml-2 ${AREA_COLORS[task.area]}`}>
                  {AREA_LABELS[task.area]}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {hasTodayExpenses && (
        <section className="bg-white rounded-xl border p-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-800">Today&apos;s expenses</h3>
            <Link
              to={`/expenses?add=true&date=${selectedDate}`}
              className="text-xs text-brand-600 flex items-center gap-0.5"
            >
              <Plus size={12} /> Add
            </Link>
          </div>
          <div className="space-y-1">
            {todayExpenses.map((exp) => (
              <div key={exp.id} className="flex justify-between text-sm py-1">
                <span className="truncate">{exp.description || exp.category.name}</span>
                <span className="font-medium tabular-nums shrink-0 ml-2">{formatMoney(exp.amount)}</span>
              </div>
            ))}
            {sharedExpenseGroups.flatMap((group) =>
              group.expenses.map((exp) => (
                <div key={exp.id} className="flex justify-between text-sm py-1 text-violet-800">
                  <span className="truncate">{exp.description || exp.category.name}</span>
                  <span className="font-medium tabular-nums shrink-0 ml-2">{formatMoney(exp.amount)}</span>
                </div>
              )),
            )}
          </div>
        </section>
      )}

      <section className="bg-white rounded-xl border overflow-hidden">
        <button
          type="button"
          onClick={() => setShowNote((v) => !v)}
          className="w-full flex items-center justify-between px-3 py-3 text-left hover:bg-gray-50 touch-manipulation"
        >
          <span className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <StickyNote size={16} className="text-brand-600" /> Day note
          </span>
          <span className="text-xs text-gray-400">{showNote ? 'Hide' : 'Add'}</span>
        </button>
        {showNote && (
          <div className="px-3 pb-3 border-t">
            <textarea
              value={dayNote}
              onChange={(e) => setDayNote(e.target.value)}
              placeholder="Write something about today..."
              rows={2}
              className="w-full mt-3 px-3 py-2 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand-500"
            />
            {isMultiMember && (
              <div className="mt-2">
                <VisibilityToggle value={noteVisibility} onChange={setNoteVisibility} compact />
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                if (dayNote.trim()) {
                  addNote.mutate({
                    content: dayNote.trim(),
                    visibility: isMultiMember ? noteVisibility : 'SHARED',
                  });
                  setDayNote('');
                }
              }}
              disabled={!dayNote.trim()}
              className="mt-2 px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
            >
              Save
            </button>
            {(data?.recentNotes ?? []).length > 0 && (
              <div className="mt-3 space-y-2">
                {data!.recentNotes.map((note) => (
                  <div key={note.id} className="p-2.5 bg-gray-50 rounded-lg text-sm text-gray-700">
                    {note.content}
                  </div>
                ))}
              </div>
            )}
            {sharedNoteGroups.map((group) => (
              <div key={group.spaceId} className="mt-3 pt-3 border-t border-violet-100">
                <p className="text-xs text-violet-700 mb-2">Note with {group.partnerName}</p>
                <textarea
                  value={sharedNoteDrafts[group.spaceId] || ''}
                  onChange={(e) =>
                    setSharedNoteDrafts((prev) => ({ ...prev, [group.spaceId]: e.target.value }))
                  }
                  placeholder={`For you & ${group.partnerName}...`}
                  rows={2}
                  className="w-full px-3 py-2 border border-violet-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-violet-500"
                />
                <button
                  type="button"
                  onClick={() => {
                    const content = (sharedNoteDrafts[group.spaceId] || '').trim();
                    if (!content) return;
                    addSharedNote.mutate({ spaceId: group.spaceId, content });
                    setSharedNoteDrafts((prev) => ({ ...prev, [group.spaceId]: '' }));
                  }}
                  disabled={!(sharedNoteDrafts[group.spaceId] || '').trim()}
                  className="mt-2 px-3 py-1.5 bg-violet-600 text-white rounded-lg text-xs font-medium disabled:opacity-50"
                >
                  Save shared note
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
