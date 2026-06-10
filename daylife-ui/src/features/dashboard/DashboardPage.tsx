import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  api,
  Expense,
  Task,
  User,
  ShoppingItem,
  RoutineToday,
} from '../../lib/api';
import { useAuth } from '../auth/AuthContext';
import { useDateStore } from '../../lib/dateStore';
import { formatMoney, todayISO } from '../../lib/format';
import { useConnections } from '../../hooks/useConnections';
import { useInviteActions, useInviteAcceptedNotifier } from '../../hooks/useInviteActions';
import { getDayPhase, phaseGreeting } from '../../lib/dailyFlow';
import { runMorningSetup, shouldOfferMorningSetup } from '../../lib/morningSetup';
import { AiCoachCard } from '../../components/AiCoachCard';
import { PendingInvitesBanner } from '../../components/PendingInvitesBanner';
import { TaskFormModal } from '../tasks/TaskFormModal';
import { toast } from '../../components/Toaster';
import type { LifeSnapshot } from '../../lib/aiCoach';
import type { ShareScope } from '../../lib/shareScope';
import { defaultVisibility } from '../../lib/privacy';
import { cn, AREA_COLORS, AREA_LABELS } from '../../lib/utils';
import {
  Plus, Circle, CheckCircle2, ShoppingCart, Bell, Sparkles,
  ChevronDown, ChevronUp, Loader2, Trash2,
} from 'lucide-react';

type AreaFilter = 'ALL' | 'PERSONAL' | 'WORK' | 'HOME';

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
  shoppingPending?: number;
  routineDone?: number;
  routineTotal?: number;
  upcomingReminders?: Array<{ id: string; title: string; nextDate: string; daysUntil: number }>;
  recentNotes: Array<{ id: string; content: string; area: string; author: { name: string } }>;
}

export function DashboardPage() {
  const { user } = useAuth();
  const selectedDate = useDateStore((s) => s.selectedDate);
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const dayPhase = getDayPhase();
  const isToday = selectedDate === todayISO();

  const [areaFilter, setAreaFilter] = useState<AreaFilter>('ALL');
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [morningLoading, setMorningLoading] = useState(false);
  const [showCoach, setShowCoach] = useState(false);
  const autoMorningRef = useRef(false);

  const { data, isLoading } = useQuery<DaySummary>({
    queryKey: ['dashboard', selectedDate],
    queryFn: () => api.get(`/dashboard/summary?date=${selectedDate}`),
  });

  const { data: members = [] } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: () => api.get('/users'),
  });

  const { data: shoppingData } = useQuery<{ data: ShoppingItem[] }>({
    queryKey: ['shopping'],
    queryFn: () => api.get('/shopping'),
  });

  const { data: routinesData } = useQuery<{ date: string; routines: RoutineToday[] }>({
    queryKey: ['routines-today', selectedDate],
    queryFn: () => api.get(`/routines/today?date=${selectedDate}`),
  });

  const { data: sharedSummary } = useQuery<{
    columns: Array<{ spaceId: string; partnerName: string; tasks: Task[] }>;
  }>({
    queryKey: ['shared-summary', selectedDate],
    queryFn: () => api.get(`/shared/summary?date=${selectedDate}`),
  });

  const { data: connections = [] } = useConnections();
  useInviteAcceptedNotifier(connections);
  const pendingInvites = connections.filter((c) => c.status === 'pending_received');
  const { accept: acceptInvite, decline: declineInvite, actingInviteId } = useInviteActions();

  const routines = routinesData?.routines ?? [];
  const shoppingPending = shoppingData?.data.filter((i) => !i.checked) ?? [];
  const upcomingReminders = data?.upcomingReminders ?? [];
  const sharedColumns = sharedSummary?.columns ?? [];

  const allTasks: Task[] = [
    ...(data?.byPerson ?? []).flatMap((p) => p.tasks),
    ...sharedColumns.flatMap((c) => c.tasks),
  ];
  const filteredTasks = areaFilter === 'ALL' ? allTasks : allTasks.filter((t) => t.area === areaFilter);
  const pendingTasks = filteredTasks.filter((t) => t.status !== 'DONE');
  const doneTasks = filteredTasks.filter((t) => t.status === 'DONE');
  const todayDone = allTasks.filter((t) => t.status === 'DONE').length;
  const todayTotal = allTasks.length;
  const progress = todayTotal > 0 ? Math.round((todayDone / todayTotal) * 100) : 0;

  const toggleTask = useMutation({
    mutationFn: (id: string) => api.patch(`/tasks/${id}/toggle`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['shared-summary'] });
    },
  });

  const deleteTask = useMutation({
    mutationFn: (id: string) => api.delete(`/tasks/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['shared-summary'] });
    },
  });

  const toggleShopping = useMutation({
    mutationFn: (id: string) => api.patch(`/shopping/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shopping'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  const toggleRoutineItem = useMutation({
    mutationFn: ({ routineId, itemId }: { routineId: string; itemId: string }) =>
      api.post(`/routines/${routineId}/toggle`, { date: selectedDate, itemId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routines-today'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  const handleMorningSetup = useCallback(async (opts?: { silent?: boolean }) => {
    if (!user?.id || morningLoading) return;
    setMorningLoading(true);
    try {
      const result = await runMorningSetup(user.id, routines);
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      if (result.added > 0) {
        toast.success(`Added ${result.added} morning task${result.added > 1 ? 's' : ''}`);
      } else if (!opts?.silent) {
        toast.success('Morning tasks already set for today');
      }
    } catch {
      if (!opts?.silent) toast.error('Could not fill morning tasks');
    } finally {
      setMorningLoading(false);
    }
  }, [user?.id, morningLoading, routines, queryClient]);

  useEffect(() => {
    if (!isToday || !user?.id || isLoading || autoMorningRef.current) return;
    if (!shouldOfferMorningSetup()) return;
    autoMorningRef.current = true;
    void handleMorningSetup({ silent: true });
  }, [isToday, user?.id, isLoading, handleMorningSetup]);

  useEffect(() => {
    if (searchParams.get('focus') === 'tasks') {
      setTaskModalOpen(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const routinesPending = routines.reduce((n, r) => n + r.items.filter((i) => !i.done).length, 0);
  const lifeSnapshot: LifeSnapshot = {
    userName: user?.name,
    today: selectedDate,
    tasksDone: todayDone,
    tasksTotal: todayTotal,
    overdueCount: data?.overdueCount ?? 0,
    dreams: [],
    routinesPending,
    shoppingPending: shoppingPending.length,
    monthTasksPending: 0,
    todayExpenseTotal: data?.todayExpenseTotal,
  };

  const openVoice = () => window.dispatchEvent(new Event('rozka-open-voice'));

  if (isLoading) {
    return (
      <div className="p-4 max-w-lg mx-auto animate-pulse space-y-4">
        <div className="h-24 bg-gray-200 rounded-2xl" />
        <div className="h-48 bg-gray-200 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      {/* Greeting + progress */}
      <section className="rounded-2xl bg-gradient-to-br from-brand-600 to-violet-700 text-white p-5">
        <p className="text-sm text-white/80">
          {isToday && user?.name ? phaseGreeting(user.name, dayPhase) : selectedDate}
        </p>
        <div className="flex items-end justify-between mt-1">
          <div>
            <p className="text-3xl font-bold tabular-nums">{todayDone}<span className="text-lg text-white/70">/{todayTotal}</span></p>
            <p className="text-xs text-white/70 mt-0.5">tasks done</p>
          </div>
          <button
            type="button"
            onClick={openVoice}
            className="px-4 py-2.5 bg-white/20 hover:bg-white/30 rounded-xl text-sm font-medium backdrop-blur transition-colors"
          >
            <Sparkles size={16} className="inline mr-1.5 -mt-0.5" />
            {isToday ? 'Tell Rozka' : 'Voice add'}
          </button>
        </div>
        {todayTotal > 0 && (
          <div className="mt-3 h-2 bg-white/20 rounded-full overflow-hidden">
            <div className="h-full bg-white/90 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        )}
      </section>

      <PendingInvitesBanner
        invites={pendingInvites}
        onAccept={(id) => acceptInvite.mutate(id)}
        onDecline={(id) => declineInvite.mutate(id)}
        acceptingId={actingInviteId}
      />

      {/* Morning setup */}
      {isToday && shouldOfferMorningSetup() && (
        <button
          type="button"
          onClick={() => void handleMorningSetup()}
          disabled={morningLoading}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-brand-200 bg-brand-50 text-brand-700 text-sm font-medium"
        >
          {morningLoading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          AI morning plan
        </button>
      )}

      {/* Tasks with area chips */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-900">Tasks</h2>
          <button
            type="button"
            onClick={() => {
              setTaskModalOpen(true);
            }}
            className="w-8 h-8 rounded-full bg-brand-600 text-white flex items-center justify-center"
          >
            <Plus size={18} />
          </button>
        </div>

        <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
          {(['ALL', 'PERSONAL', 'WORK', 'HOME'] as AreaFilter[]).map((area) => (
            <button
              key={area}
              type="button"
              onClick={() => setAreaFilter(area)}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors',
                areaFilter === area
                  ? 'bg-brand-600 text-white'
                  : 'bg-gray-100 text-gray-600',
              )}
            >
              {area === 'ALL' ? 'All' : area.charAt(0) + area.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        <div className="space-y-1">
          {pendingTasks.map((task) => (
            <div key={task.id} className="flex items-center gap-3 py-2.5 px-3 bg-white rounded-xl border group">
              <button
                type="button"
                onClick={() => toggleTask.mutate(task.id)}
                className="text-gray-300 hover:text-brand-600 shrink-0"
              >
                <Circle size={20} />
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{task.title}</p>
              </div>
              <span className={cn('text-[10px] px-2 py-0.5 rounded-full shrink-0', AREA_COLORS[task.area])}>
                {AREA_LABELS[task.area]}
              </span>
              <button
                type="button"
                onClick={() => deleteTask.mutate(task.id)}
                className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 shrink-0"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {doneTasks.length > 0 && (
            <div className="pt-2 space-y-1">
              {doneTasks.map((task) => (
                <div key={task.id} className="flex items-center gap-3 py-2 px-3 rounded-xl opacity-50">
                  <button
                    type="button"
                    onClick={() => toggleTask.mutate(task.id)}
                    className="text-brand-500 shrink-0"
                  >
                    <CheckCircle2 size={20} />
                  </button>
                  <p className="text-sm line-through truncate flex-1">{task.title}</p>
                </div>
              ))}
            </div>
          )}
          {allTasks.length === 0 && (
            <p className="text-center text-sm text-gray-400 py-6">
              No tasks yet. Tap + or use voice to add.
            </p>
          )}
        </div>
      </section>

      {/* Shopping */}
      {(shoppingPending.length > 0 || isToday) && (
        <section className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-2 mb-3">
            <ShoppingCart size={16} className="text-emerald-600" />
            <h3 className="text-sm font-semibold text-gray-900">Shopping</h3>
            <span className="text-xs text-gray-400 ml-auto">{shoppingPending.length} items</span>
          </div>
          {shoppingPending.length === 0 ? (
            <p className="text-xs text-gray-400">Say "shopping eggs bread milk" to add items</p>
          ) : (
            <div className="space-y-1.5">
              {shoppingPending.slice(0, 6).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => toggleShopping.mutate(item.id)}
                  className="flex items-center gap-2 text-sm w-full text-left py-1"
                >
                  <Circle size={16} className="text-emerald-400 shrink-0" />
                  <span className="truncate">{item.name}</span>
                  {item.quantity && <span className="text-gray-400 text-xs shrink-0">x{item.quantity}</span>}
                </button>
              ))}
              {shoppingPending.length > 6 && (
                <p className="text-xs text-emerald-600 font-medium">+{shoppingPending.length - 6} more</p>
              )}
            </div>
          )}
        </section>
      )}

      {/* Routines (current phase only) */}
      {isToday && routines.length > 0 && (
        <section className="bg-white rounded-xl border p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">
            {dayPhase === 'morning' ? 'Morning' : dayPhase === 'evening' ? 'Evening' : 'Daily'} routine
          </h3>
          <div className="flex flex-wrap gap-2">
            {routines.flatMap((routine) =>
              routine.items.map((item) => (
                <button
                  key={`${routine.id}-${item.id}`}
                  type="button"
                  onClick={() => toggleRoutineItem.mutate({ routineId: routine.id, itemId: item.id })}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                    item.done
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700 line-through'
                      : 'bg-white border-gray-200 text-gray-700',
                  )}
                >
                  {item.done ? '✓ ' : ''}{item.label}
                </button>
              )),
            )}
          </div>
        </section>
      )}

      {/* Coming up */}
      {upcomingReminders.length > 0 && (
        <section className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-2 mb-3">
            <Bell size={16} className="text-rose-500" />
            <h3 className="text-sm font-semibold text-gray-900">Coming up</h3>
          </div>
          <div className="space-y-2">
            {upcomingReminders.slice(0, 5).map((r) => (
              <div key={r.id} className="flex justify-between text-sm">
                <span className="truncate font-medium">{r.title}</span>
                <span className="text-rose-500 text-xs shrink-0 ml-2">
                  {r.daysUntil === 0 ? 'Today' : r.daysUntil === 1 ? 'Tomorrow' : `${r.daysUntil}d`}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* AI Coach (collapsed) */}
      {isToday && (
        <section className="bg-white rounded-xl border overflow-hidden">
          <button
            type="button"
            onClick={() => setShowCoach((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 text-left"
          >
            <span className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <Sparkles size={16} className="text-violet-600" /> Rozka AI Coach
            </span>
            {showCoach ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
          </button>
          {showCoach && (
            <div className="px-4 pb-4">
              <AiCoachCard snapshot={lifeSnapshot} userId={user?.id} compact />
            </div>
          )}
        </section>
      )}

      {/* Overdue badge */}
      {(data?.overdueCount ?? 0) > 0 && isToday && (
        <div className="flex items-center gap-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
          {data!.overdueCount} overdue task{data!.overdueCount > 1 ? 's' : ''}
        </div>
      )}

      {taskModalOpen && (
        <TaskFormModal
          members={members}
          defaultDueDate={selectedDate}
          defaultAssigneeId={user?.id}
          defaultShareScope={{ kind: 'personal', visibility: defaultVisibility(members.length) }}
          onClose={() => setTaskModalOpen(false)}
        />
      )}
    </div>
  );
}
