import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api, Expense, Task, User } from '../../lib/api';
import { useAuth } from '../auth/AuthContext';
import { useDateStore } from '../../lib/dateStore';
import { formatDayHeading, formatMoney, todayISO } from '../../lib/format';
import { DayPicker } from '../../components/DayPicker';
import { PersonDayColumn } from '../../components/PersonDayColumn';
import { VisibilityToggle } from '../../components/VisibilityToggle';
import { defaultVisibility } from '../../lib/privacy';
import type { ItemVisibility } from '../../lib/privacy';
import { Receipt, AlertCircle, Plus, StickyNote, CheckSquare, ShoppingCart, Sun, Bell, Sparkles, Star } from 'lucide-react';
import { AREA_COLORS, AREA_LABELS, memberGridClass } from '../../lib/utils';
import { HOUSEHOLD_TYPE_LABELS } from '../../lib/household';

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
  householdType?: string;
  householdName?: string;
}

export function DashboardPage() {
  const { user } = useAuth();
  const selectedDate = useDateStore((s) => s.selectedDate);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<DaySummary>({
    queryKey: ['dashboard', selectedDate],
    queryFn: () => api.get(`/dashboard/summary?date=${selectedDate}`),
  });

  const { data: household } = useQuery<{ householdType: string; householdName?: string }>({
    queryKey: ['household'],
    queryFn: () => api.get('/household'),
  });

  const { data: members = [] } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: () => api.get('/users'),
  });

  const { data: visionItems = [] } = useQuery<Array<{ id: string; title: string; emoji?: string; achieved: boolean }>>({
    queryKey: ['vision-board', 'preview'],
    queryFn: () => api.get('/vision-board?achieved=false'),
  });

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

  const [dayNote, setDayNote] = React.useState('');
  const [noteVisibility, setNoteVisibility] = React.useState<ItemVisibility>(
    defaultVisibility(members.length),
  );

  if (isLoading) {
    return (
      <div className="p-6 animate-pulse space-y-4">
        <div className="h-10 bg-gray-200 rounded w-64" />
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="h-96 bg-gray-200 rounded-2xl" />
          <div className="h-96 bg-gray-200 rounded-2xl" />
        </div>
      </div>
    );
  }

  const byPerson = data?.byPerson ?? [];
  const sortedByPerson = [...byPerson].sort((a, b) => {
    if (a.userId === user?.id) return -1;
    if (b.userId === user?.id) return 1;
    return 0;
  });
  const isMultiMember = members.length > 1;
  const isToday = selectedDate === todayISO();
  const monthKey = selectedDate.slice(0, 7);
  const monthTasksDone = data?.monthTasksDone ?? 0;
  const monthTasksTotal = data?.monthTasksTotal ?? 0;
  const monthTasksPending = data?.monthTasksPending ?? [];
  const shoppingPending = data?.shoppingPending ?? 0;
  const routineDone = data?.routineDone ?? 0;
  const routineTotal = data?.routineTotal ?? 0;
  const upcomingReminders = data?.upcomingReminders ?? [];

  return (
    <div className="p-4 lg:p-6 space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isMultiMember ? 'My day' : formatDayHeading(selectedDate)}
            {isMultiMember && (
              <span className="text-base font-normal text-gray-500 ml-2">{formatDayHeading(selectedDate)}</span>
            )}
          </h1>
          <p className="text-gray-500 text-sm">
            {isMultiMember
              ? 'Your private items plus anything shared with the household'
              : `${household?.householdName ||
                  HOUSEHOLD_TYPE_LABELS[(household?.householdType || data?.householdType || 'SINGLE') as keyof typeof HOUSEHOLD_TYPE_LABELS]} · add tasks per person, check off when done`}
          </p>
        </div>
        <DayPicker />
      </div>

      {(data?.overdueCount ?? 0) > 0 && isToday && (
        <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
          <AlertCircle size={16} />
          {data!.overdueCount} overdue task{data!.overdueCount !== 1 ? 's' : ''} from earlier days
          <Link to="/tasks?status=TODO" className="ml-auto font-medium underline">View</Link>
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {sortedByPerson.map((p) => (
          <div key={p.userId} className="bg-white rounded-xl border p-3 shadow-sm">
            <p className="text-xs text-gray-500">{p.name}</p>
            <p className="text-xl font-bold" style={{ color: p.color }}>
              {p.done}/{p.total}
            </p>
            <p className="text-xs text-gray-400">tasks done</p>
          </div>
        ))}
        <div className="bg-white rounded-xl border p-3 shadow-sm">
          <p className="text-xs text-gray-500 flex items-center gap-1"><Receipt size={12} /> Day spend</p>
          <p className="text-xl font-bold tabular-nums">{formatMoney(data?.todayExpenseTotal)}</p>
          <Link to={`/expenses?date=${selectedDate}`} className="text-xs text-brand-600 hover:underline">Log expense</Link>
        </div>
        <div className="bg-white rounded-xl border p-3 shadow-sm">
          <p className="text-xs text-gray-500 flex items-center gap-1"><CheckSquare size={12} /> Month tasks</p>
          <p className="text-xl font-bold tabular-nums">
            {monthTasksDone}/{monthTasksTotal}
          </p>
          <Link to={`/tasks?month=${monthKey}`} className="text-xs text-brand-600 hover:underline">
            {monthTasksTotal - monthTasksDone} left this month
          </Link>
        </div>
        <div className="bg-white rounded-xl border p-3 shadow-sm">
          <p className="text-xs text-gray-500">Month spend</p>
          <p className="text-xl font-bold tabular-nums">{formatMoney(data?.monthExpenseTotal)}</p>
          <Link to={`/reports?period=monthly&date=${monthKey}-01`} className="text-xs text-brand-600 hover:underline">
            Full report
          </Link>
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <Link to="/daily?tab=shopping" className="bg-white rounded-xl border p-4 shadow-sm hover:border-green-200 transition-colors">
          <p className="text-xs text-gray-500 flex items-center gap-1"><ShoppingCart size={12} /> Shopping</p>
          <p className="text-xl font-bold text-green-700">{shoppingPending}</p>
          <p className="text-xs text-gray-400">items to buy</p>
        </Link>
        <Link to="/daily?tab=routines" className="bg-white rounded-xl border p-4 shadow-sm hover:border-amber-200 transition-colors">
          <p className="text-xs text-gray-500 flex items-center gap-1"><Sun size={12} /> Routines</p>
          <p className="text-xl font-bold text-amber-700">{routineDone}/{routineTotal}</p>
          <p className="text-xs text-gray-400">habits done today</p>
        </Link>
        <Link to="/daily?tab=reminders" className="bg-white rounded-xl border p-4 shadow-sm hover:border-brand-200 transition-colors">
          <p className="text-xs text-gray-500 flex items-center gap-1"><Bell size={12} /> Reminders</p>
          <p className="text-xl font-bold text-brand-700">{upcomingReminders.length}</p>
          <p className="text-xs text-gray-400">coming in 2 weeks</p>
        </Link>
      </div>

      {visionItems.length > 0 ? (
        <Link
          to="/vision"
          className="block bg-gradient-to-r from-violet-50 to-fuchsia-50 border border-violet-100 rounded-2xl p-4 hover:border-violet-200 transition-colors"
        >
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold flex items-center gap-2 text-violet-900">
              <Star size={16} className="text-violet-600" /> Vision board
            </h3>
            <span className="text-xs text-violet-600">Open →</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {visionItems.slice(0, 4).map((v) => (
              <span key={v.id} className="text-sm bg-white/80 px-3 py-1 rounded-full border border-violet-100">
                {v.emoji || '✨'} {v.title}
              </span>
            ))}
          </div>
        </Link>
      ) : (
        <Link
          to="/vision"
          className="flex items-center justify-between bg-gradient-to-r from-violet-50 to-fuchsia-50 border border-violet-100 rounded-2xl p-4 hover:border-violet-200 transition-colors"
        >
          <div>
            <h3 className="font-semibold flex items-center gap-2 text-violet-900">
              <Star size={16} className="text-violet-600" /> Vision board
            </h3>
            <p className="text-sm text-violet-700 mt-1">Add dreams, goals & photos — synced for you both</p>
          </div>
          <span className="text-sm text-violet-600 shrink-0">Start →</span>
        </Link>
      )}

      {upcomingReminders.length > 0 && isToday && (
        <section className="bg-white rounded-2xl border shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold flex items-center gap-2">
              <Sparkles size={16} className="text-brand-600" /> Coming up
            </h3>
            <Link to="/daily?tab=reminders" className="text-xs text-brand-600 hover:underline">All reminders</Link>
          </div>
          <div className="space-y-2">
            {upcomingReminders.map((r) => (
              <div key={r.id} className="flex justify-between items-center py-2 border-b last:border-0 text-sm">
                <span className="font-medium">{r.title}</span>
                <span className="text-xs text-gray-400">
                  {r.daysUntil === 0 ? 'Today' : r.daysUntil === 1 ? 'Tomorrow' : `in ${r.daysUntil} days`}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {monthTasksPending.length > 0 && (
        <section className="bg-white rounded-2xl border shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold flex items-center gap-2">
              <CheckSquare size={16} className="text-brand-600" /> Still open this month
            </h3>
            <Link to={`/tasks?month=${monthKey}&status=TODO`} className="text-xs text-brand-600 hover:underline">
              View all
            </Link>
          </div>
          <div className="space-y-2">
            {monthTasksPending.map((task) => (
              <Link
                key={task.id}
                to={`/tasks?month=${monthKey}`}
                className="flex items-center justify-between py-2 border-b last:border-0 hover:bg-gray-50 rounded-lg px-2 -mx-2"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{task.title}</p>
                  <p className="text-xs text-gray-400">
                    {task.dueDate?.slice(0, 10)} · {task.assignee?.name || 'Unassigned'}
                  </p>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full shrink-0 ml-2 ${AREA_COLORS[task.area]}`}>
                  {AREA_LABELS[task.area]}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className={memberGridClass(members.length)}>
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
            />
          );
        })}
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <section className="bg-white rounded-2xl border shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold flex items-center gap-2">
              <Receipt size={16} className="text-brand-600" /> Expenses this day
            </h3>
            <Link
              to={`/expenses?add=true&date=${selectedDate}`}
              className="text-xs text-brand-600 hover:underline flex items-center gap-1"
            >
              <Plus size={14} /> Add
            </Link>
          </div>
          {(data?.todayExpenses ?? []).length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">No expenses logged</p>
          ) : (
            <div className="space-y-2">
              {data!.todayExpenses.map((exp) => (
                <div key={exp.id} className="flex justify-between items-center py-2 border-b last:border-0">
                  <div>
                    <p className="text-sm font-medium">{exp.description || exp.category.name}</p>
                    <p className="text-xs text-gray-400">{exp.paidBy.name}</p>
                  </div>
                  <p className="font-semibold tabular-nums text-sm">{formatMoney(exp.amount)}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="bg-white rounded-2xl border shadow-sm p-4">
          <h3 className="font-semibold flex items-center gap-2 mb-3">
            <StickyNote size={16} className="text-brand-600" /> Day note
          </h3>
          <textarea
            value={dayNote}
            onChange={(e) => setDayNote(e.target.value)}
            placeholder="Anything to remember about this day..."
            rows={2}
            className="w-full px-3 py-2 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand-500 mb-2"
          />
          {isMultiMember && (
            <div className="mb-2">
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
            className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
          >
            Save note
          </button>
          {(data?.recentNotes ?? []).length > 0 && (
            <div className="mt-4 space-y-2">
              {data!.recentNotes.map((note) => (
                <div key={note.id} className="p-3 bg-gray-50 rounded-xl text-sm">
                  <div className="flex gap-2 mb-1">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${AREA_COLORS[note.area]}`}>
                      {AREA_LABELS[note.area]}
                    </span>
                    <span className="text-xs text-gray-400">{note.author.name}</span>
                  </div>
                  <p className="text-gray-700 whitespace-pre-wrap">{note.content}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
