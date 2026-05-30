import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import {
  api,
  Expense,
  Task,
  User,
  Connection,
  ShoppingItem,
  RoutineToday,
  VisionBoardItemEnriched,
} from '../../lib/api';
import { useAuth } from '../auth/AuthContext';
import { useDateStore } from '../../lib/dateStore';
import { formatDayHeading, formatMoney, todayISO } from '../../lib/format';
import { PersonDayColumn } from '../../components/PersonDayColumn';
import { SharedDayColumn } from '../../components/SharedDayColumn';
import { ShareScopePicker } from '../../components/ShareScopePicker';
import type { ShareScope } from '../../lib/shareScope';
import { defaultVisibility } from '../../lib/privacy';
import { PageHeader, DaySection } from '../../components/PageHeader';
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
  CheckSquare,
  Star,
  LayoutDashboard,
  Circle,
} from 'lucide-react';
import { AREA_COLORS, AREA_LABELS, memberGridClass } from '../../lib/utils';
import { SharedFeatureLinks } from '../../components/SharedFeatureLinks';
import { PendingInvitesBanner, shareScopeLabel } from '../../components/PendingInvitesBanner';
import { TaskFormModal } from '../tasks/TaskFormModal';
import { DailyRhythmSection } from '../../components/DailyRhythmSection';
import { WelcomeDayCard } from '../../components/WelcomeDayCard';
import { EveningReflectionSection } from '../../components/EveningReflectionSection';
import { HouseholdDayView } from '../../components/HouseholdDayView';
import { useConnections } from '../../hooks/useConnections';
import { useInviteActions, useInviteAcceptedNotifier } from '../../hooks/useInviteActions';
import { getDayPhase, phaseGreeting, phaseHint } from '../../lib/dailyFlow';
import { getSimpleMode } from '../../lib/simpleMode';
import { runMorningSetup, shouldOfferMorningSetup } from '../../lib/morningSetup';
import { SimpleTodayHero, SimpleMoreToggle } from '../../components/SimpleTodayHero';
import { AiCoachCard } from '../../components/AiCoachCard';
import { toast } from '../../components/Toaster';
import type { LifeSnapshot } from '../../lib/aiCoach';
import { APP_TAGLINE } from '../../lib/brand';

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

export function DashboardPage() {
  const { user } = useAuth();
  const selectedDate = useDateStore((s) => s.selectedDate);
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const dayPhase = getDayPhase();

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
  const routines = routinesData?.routines ?? [];

  const { data: visionPreview = [] } = useQuery<VisionBoardItemEnriched[]>({
    queryKey: ['vision-board', 'preview'],
    queryFn: () => api.get('/vision-board?achieved=false'),
  });

  const { data: sharedSummary } = useQuery<{
    columns: Array<{ spaceId: string; partnerName: string; partnerUsername: string; tasks: Task[] }>;
    expenseGroups: Array<{ spaceId: string; partnerName: string; expenses: Expense[]; total: string }>;
    noteGroups: Array<{ spaceId: string; partnerName: string; notes: Array<{ id: string; content: string; area: string; author: { name: string } }> }>;
  }>({
    queryKey: ['shared-summary', selectedDate],
    queryFn: () => api.get(`/shared/summary?date=${selectedDate}`),
  });

  const { data: connections = [] } = useConnections();
  useInviteAcceptedNotifier(connections);

  const pendingInvites = connections.filter((c) => c.status === 'pending_received');
  const { accept: acceptInvite, decline: declineInvite, actingInviteId } = useInviteActions();

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

  const hasActiveShare = connections.some((c) => c.status === 'active');
  const activeConnections = connections.filter((c) => c.status === 'active');
  const sharedColumns = sharedSummary?.columns ?? [];
  const sharedExpenseGroups = sharedSummary?.expenseGroups ?? [];
  const sharedNoteGroups = sharedSummary?.noteGroups ?? [];

  const addNote = useMutation({
    mutationFn: async (payload: { content: string; scope: ShareScope }) => {
      if (payload.scope.kind === 'connection') {
        return api.post(`/shared/${payload.scope.spaceId}/notes`, {
          content: payload.content,
          noteDate: selectedDate,
        });
      }
      return api.post('/notes', {
        content: payload.content,
        area: 'PERSONAL',
        noteDate: selectedDate,
        visibility: payload.scope.kind === 'personal' && members.length > 1
          ? payload.scope.visibility
          : 'SHARED',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['shared-summary'] });
    },
  });

  const [dayNote, setDayNote] = React.useState('');
  const [showNote, setShowNote] = React.useState(false);
  const [noteShareScope, setNoteShareScope] = React.useState<ShareScope>({ kind: 'personal', visibility: 'SHARED' });
  const [taskModalOpen, setTaskModalOpen] = React.useState(false);
  const [simpleMode] = React.useState(() => getSimpleMode());
  const [showMore, setShowMore] = React.useState(false);
  const [morningLoading, setMorningLoading] = React.useState(false);
  const autoMorningRef = React.useRef(false);
  const [taskModalDefaults, setTaskModalDefaults] = React.useState<{
    defaultAssigneeId?: string;
    defaultShareScope?: ShareScope;
  }>({});

  const isToday = selectedDate === todayISO();

  const handleMorningSetup = React.useCallback(async (opts?: { silent?: boolean }) => {
    if (!user?.id || morningLoading) return;
    setMorningLoading(true);
    try {
      const result = await runMorningSetup(user.id, routines);
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      if (result.added > 0) {
        toast.success(`Added ${result.added} morning task${result.added > 1 ? 's' : ''}`);
      } else if (!opts?.silent) {
        toast.success('Morning tasks already set for today');
      }
    } catch {
      if (!opts?.silent) toast.error('Could not fill morning tasks — try again');
    } finally {
      setMorningLoading(false);
    }
  }, [user?.id, morningLoading, routines, queryClient]);

  React.useEffect(() => {
    if (!simpleMode || !isToday || !user?.id || isLoading || autoMorningRef.current) return;
    if (!shouldOfferMorningSetup()) return;
    autoMorningRef.current = true;
    void handleMorningSetup({ silent: true });
  }, [simpleMode, isToday, user?.id, isLoading, handleMorningSetup]);

  React.useEffect(() => {
    if (searchParams.get('focus') === 'tasks') {
      setTaskModalOpen(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  if (isLoading) {
    return (
      <div className="p-4 max-w-3xl mx-auto animate-pulse space-y-4">
        <div className="h-28 bg-gray-200 rounded-2xl" />
        <div className="h-64 bg-gray-200 rounded-2xl" />
      </div>
    );
  }

  const byPerson = data?.byPerson ?? [];
  const isMultiMember = members.length > 1;
  const monthKey = selectedDate.slice(0, 7);
  const monthTasksPending = data?.monthTasksPending ?? [];
  const shoppingPending = shoppingData?.data.filter((i) => !i.checked) ?? [];
  const upcomingReminders = data?.upcomingReminders ?? [];
  const todayExpenses = data?.todayExpenses ?? [];
  const hasTodayExpenses =
    todayExpenses.length > 0 || sharedExpenseGroups.some((g) => g.expenses.length > 0);

  const allTodayTasks = byPerson.flatMap((p) => p.tasks);
  const todayDone = allTodayTasks.filter((t) => t.status === 'DONE').length;
  const todayTotal = allTodayTasks.length + sharedColumns.reduce((n, c) => n + c.tasks.length, 0);
  const todayDoneAll =
    todayDone + sharedColumns.reduce((n, c) => n + c.tasks.filter((t) => t.status === 'DONE').length, 0);

  const showHouseholdView = isMultiMember || sharedColumns.length > 0;
  const showEveningReflection = isToday && (dayPhase === 'evening' || dayPhase === 'afternoon');

  const openVoice = () => window.dispatchEvent(new Event('rozka-open-voice'));

  const routinesPending = routines.reduce(
    (n, r) => n + r.items.filter((i) => !i.done).length,
    0,
  );

  const lifeSnapshot: LifeSnapshot = {
    userName: user?.name,
    today: selectedDate,
    tasksDone: todayDoneAll,
    tasksTotal: todayTotal,
    overdueCount: data?.overdueCount ?? 0,
    dreams: visionPreview.slice(0, 3).map((v) => v.title),
    routinesPending,
    shoppingPending: shoppingPending.length,
    monthTasksPending: monthTasksPending.length,
    todayExpenseTotal: data?.todayExpenseTotal,
  };

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto space-y-5">
      <PageHeader
        theme="today"
        icon={LayoutDashboard}
        title={formatDayHeading(selectedDate)}
        subtitle={
          simpleMode && isToday
            ? user?.name
              ? `${phaseGreeting(user.name, dayPhase)} — ${APP_TAGLINE.toLowerCase()}`
              : APP_TAGLINE
            : isToday && user?.name
              ? phaseGreeting(user.name, dayPhase)
              : 'Your day at a glance'
        }
        hint={simpleMode && isToday ? 'AI life lesson · auto tasks · voice add' : isToday ? phaseHint(dayPhase) : 'Pick a date above to review another day'}
        action={
          todayTotal > 0 ? (
            <div className="text-right shrink-0">
              <p className="text-2xl font-bold tabular-nums">{todayDoneAll}/{todayTotal}</p>
              <p className="text-xs text-white/80">done today</p>
            </div>
          ) : undefined
        }
      />

      <PendingInvitesBanner
        invites={pendingInvites}
        onAccept={(id) => acceptInvite.mutate(id)}
        onDecline={(id) => declineInvite.mutate(id)}
        acceptingId={actingInviteId}
      />

      {simpleMode && isToday && (
        <SimpleTodayHero
          greeting={user?.name ? phaseGreeting(user.name, dayPhase) : 'Good morning'}
          done={todayDoneAll}
          total={todayTotal}
          showMorningSetup={shouldOfferMorningSetup() || morningLoading}
          morningLoading={morningLoading}
          onVoice={openVoice}
          onMorningSetup={() => void handleMorningSetup()}
        />
      )}

      {isToday && (
        <AiCoachCard snapshot={lifeSnapshot} userId={user?.id} compact={simpleMode} />
      )}

      {(!simpleMode || showMore) && (
      <>
      <section className="rounded-2xl overflow-hidden border border-violet-200 bg-gradient-to-br from-violet-600 via-fuchsia-600 to-amber-500 text-white shadow-md">
        <div className="p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-white/80">
                Your why · read this first
              </p>
              <h2 className="text-lg sm:text-xl font-bold mt-1">Dreams & goals</h2>
              <p className="text-sm text-white/90 mt-1 max-w-md">
                See what you&apos;re building toward, then go through your day.
              </p>
            </div>
            <Link
              to="/vision"
              className="shrink-0 px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-xs font-semibold backdrop-blur"
            >
              Open board
            </Link>
          </div>

          {visionPreview.length === 0 ? (
            <Link
              to="/vision"
              className="mt-4 block text-center py-3 rounded-xl bg-white/15 hover:bg-white/25 text-sm font-medium"
            >
              Add your first dream →
            </Link>
          ) : (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
              {visionPreview.slice(0, 3).map((v) => (
                <Link
                  key={v.id}
                  to="/vision"
                  className="rounded-xl bg-white/15 hover:bg-white/25 backdrop-blur p-3 min-w-0"
                >
                  <span className="text-2xl">{v.emoji || '✨'}</span>
                  <p className="font-semibold text-sm mt-1 truncate">{v.title}</p>
                  {v.caption && (
                    <p className="text-xs text-white/85 mt-0.5 line-clamp-2">{v.caption}</p>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      <WelcomeDayCard
        hasVision={visionPreview.length > 0}
        hasTasks={todayTotal > 0}
        hasRoutines={routines.some((r) => r.total > 0)}
        onAddTask={() => {
          setTaskModalDefaults({
            defaultAssigneeId: user?.id,
            defaultShareScope: { kind: 'personal', visibility: defaultVisibility(members.length) },
          });
          setTaskModalOpen(true);
        }}
      />

      {isToday && (
        <DailyRhythmSection
          routines={routines}
          selectedDate={selectedDate}
          isToday={isToday}
          onToggleItem={(routineId, itemId) => toggleRoutineItem.mutate({ routineId, itemId })}
          toggling={toggleRoutineItem.isPending}
        />
      )}
      </>
      )}

      {(data?.overdueCount ?? 0) > 0 && isToday && (
        <Link
          to="/tasks?status=TODO"
          className="flex items-center gap-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800"
        >
          <AlertCircle size={16} className="shrink-0" />
          <span>{data!.overdueCount} overdue — open task inbox</span>
          <ChevronRight size={16} className="ml-auto shrink-0" />
        </Link>
      )}

      <DaySection
        accent="blue"
        icon={CheckSquare}
        title={simpleMode ? "Today's tasks" : showHouseholdView ? "Today's plan" : "Today's to-dos"}
        subtitle={
          simpleMode
            ? 'Tap to check off · mic button adds more'
            : showHouseholdView
              ? 'Everyone on one screen — tap to check off'
              : 'Quick check-off — add with + or voice'
        }
        action={
          <Link to="/tasks" className="text-xs font-medium text-blue-600 hover:underline shrink-0">
            All tasks →
          </Link>
        }
      >
        {showHouseholdView ? (
          <HouseholdDayView
            members={members}
            byPerson={byPerson}
            sharedColumns={sharedColumns}
            routines={routines}
            currentUserId={user?.id}
            onAddTask={(assigneeId, spaceId) => {
              if (spaceId) {
                setTaskModalDefaults({ defaultShareScope: { kind: 'connection', spaceId } });
              } else {
                setTaskModalDefaults({
                  defaultAssigneeId: assigneeId,
                  defaultShareScope: { kind: 'personal', visibility: defaultVisibility(members.length) },
                });
              }
              setTaskModalOpen(true);
            }}
          />
        ) : (
          <>
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
                      onAddTask={() => {
                        setTaskModalDefaults({
                          defaultAssigneeId: member.id,
                          defaultShareScope: { kind: 'personal', visibility: defaultVisibility(members.length) },
                        });
                        setTaskModalOpen(true);
                      }}
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
                  onAddTask={() => {
                    setTaskModalDefaults({
                      defaultShareScope: { kind: 'connection', spaceId: col.spaceId },
                    });
                    setTaskModalOpen(true);
                  }}
                />
              ))}
            </div>
            {todayTotal === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">
                Nothing planned yet. Type a task above or tap + to add one.
              </p>
            )}
          </>
        )}
        {showHouseholdView && todayTotal === 0 && (
          <p className="text-sm text-gray-500 text-center py-4 mt-2">
            Nothing planned yet — tap + next to someone&apos;s name to add a task.
          </p>
        )}
      </DaySection>

      {simpleMode && (
        <SimpleMoreToggle
          open={showMore}
          onToggle={() => setShowMore((v) => !v)}
          label={showMore ? 'Show less' : 'Shopping, money, dreams & more'}
        />
      )}

      {(!simpleMode || showMore) && (
      <>
      <EveningReflectionSection selectedDate={selectedDate} visible={showEveningReflection} />

      <div className="grid sm:grid-cols-2 gap-4">
        <DaySection
          accent="green"
          icon={ShoppingCart}
          title="Buy today"
          subtitle={shoppingPending.length === 0 ? 'List is clear' : `${shoppingPending.length} items to get`}
          action={
            <Link to="/daily?tab=shopping" className="text-xs font-medium text-emerald-600 hover:underline">
              Open list →
            </Link>
          }
        >
          {shoppingPending.length === 0 ? (
            <p className="text-sm text-gray-500">Need milk, veggies, or medicine? Add to your shopping list.</p>
          ) : (
            <ul className="space-y-2">
              {shoppingPending.slice(0, 4).map((item) => (
                <li key={item.id} className="flex items-center gap-2 text-sm">
                  <button
                    type="button"
                    onClick={() => toggleShopping.mutate(item.id)}
                    className="text-emerald-600 shrink-0"
                  >
                    <Circle size={16} />
                  </button>
                  <span className="truncate">{item.name}</span>
                  {item.quantity && <span className="text-gray-400 text-xs shrink-0">×{item.quantity}</span>}
                </li>
              ))}
              {shoppingPending.length > 4 && (
                <Link to="/daily?tab=shopping" className="text-xs text-emerald-600 font-medium">
                  +{shoppingPending.length - 4} more
                </Link>
              )}
            </ul>
          )}
        </DaySection>

        <DaySection
          accent="rose"
          icon={Bell}
          title="Coming up"
          subtitle={upcomingReminders.length === 0 ? 'No dates soon' : 'Birthdays, bills & reminders'}
          action={
            <Link to="/daily?tab=reminders" className="text-xs font-medium text-rose-600 hover:underline">
              All dates →
            </Link>
          }
        >
          {upcomingReminders.length === 0 ? (
            <p className="text-sm text-gray-500">Add rent due dates, birthdays, or appointments.</p>
          ) : (
            <ul className="space-y-2">
              {upcomingReminders.slice(0, 3).map((r) => (
                <li key={r.id} className="flex justify-between gap-2 text-sm">
                  <span className="truncate font-medium">{r.title}</span>
                  <span className="text-rose-600 text-xs shrink-0">
                    {r.daysUntil === 0 ? 'Today' : r.daysUntil === 1 ? 'Tomorrow' : `${r.daysUntil}d`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </DaySection>
      </div>

      <DaySection
        accent="orange"
        icon={Receipt}
        title="Money today"
        subtitle={hasTodayExpenses ? formatMoney(data?.todayExpenseTotal) : 'Nothing logged yet'}
        action={
          <Link
            to={`/expenses?date=${selectedDate}`}
            className="text-xs font-medium text-orange-600 hover:underline"
          >
            Expenses →
          </Link>
        }
      >
        {!hasTodayExpenses ? (
          <p className="text-sm text-gray-500">
            Log what you spent. Shared expenses with a partner go in the purple box on Expenses.
          </p>
        ) : (
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
        )}
      </DaySection>

      {hasActiveShare && activeConnections.length > 0 && (
        <div className="px-3 py-2.5 rounded-xl bg-violet-50 border border-violet-100 text-sm space-y-2">
          {activeConnections.map((conn) => (
            <div key={conn.id}>
              <p className="text-violet-900 font-medium break-words">
                Sharing with @{conn.partnerUsername}:{' '}
                <span className="text-violet-700">{shareScopeLabel(conn.features)}</span>
              </p>
              {sharedColumns.length === 0 && conn.features.includes('tasks') && conn.features.length === 1 && (
                <p className="text-xs text-violet-600 mt-1">Only shared tasks appear on Today — not expenses or shopping.</p>
              )}
              <SharedFeatureLinks features={conn.features} className="mt-2" />
            </div>
          ))}
        </div>
      )}

      {!hasActiveShare && (
        <p className="text-center text-sm text-gray-500">
          Share lists with someone?{' '}
          <Link to="/share" className="text-brand-600 font-medium hover:underline">
            Invite by username
          </Link>
        </p>
      )}

      {monthTasksPending.length > 0 && (
        <section className="bg-white rounded-xl border p-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-800">Open this month</h3>
            <Link to={`/tasks?month=${monthKey}&status=TODO`} className="text-xs text-brand-600">
              Task inbox
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
              placeholder="How was today? Write a quick journal line..."
              rows={2}
              className="w-full mt-3 px-3 py-2 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand-500"
            />
            <div className="mt-2">
              <ShareScopePicker
                feature="notes"
                value={noteShareScope}
                onChange={setNoteShareScope}
                membersCount={members.length}
              />
            </div>
            <button
              type="button"
              onClick={() => {
                if (dayNote.trim()) {
                  addNote.mutate({ content: dayNote.trim(), scope: noteShareScope });
                  setDayNote('');
                }
              }}
              disabled={!dayNote.trim()}
              className="mt-2 px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
            >
              Save note
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
              <div key={group.spaceId} className="mt-3 pt-3 border-t border-violet-100 space-y-2">
                <p className="text-xs font-medium text-violet-700">Shared with {group.partnerName}</p>
                {group.notes.map((note) => (
                  <div key={note.id} className="p-2.5 bg-violet-50 rounded-lg text-sm text-violet-900">
                    {note.content}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </section>
      </>
      )}
      {taskModalOpen && (
        <TaskFormModal
          members={members}
          defaultDueDate={selectedDate}
          defaultAssigneeId={taskModalDefaults.defaultAssigneeId}
          defaultShareScope={taskModalDefaults.defaultShareScope}
          onClose={() => setTaskModalOpen(false)}
        />
      )}
    </div>
  );
}
