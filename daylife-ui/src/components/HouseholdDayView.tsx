import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Circle, Plus, Users } from 'lucide-react';
import { api, Task, User, RoutineToday } from '../lib/api';
import { cn } from '../lib/utils';

interface PersonSummary {
  userId: string;
  name: string;
  color: string;
  tasks: Task[];
}

interface SharedColumn {
  spaceId: string;
  partnerName: string;
  tasks: Task[];
}

interface HouseholdDayViewProps {
  members: User[];
  byPerson: PersonSummary[];
  sharedColumns: SharedColumn[];
  routines: RoutineToday[];
  currentUserId?: string;
  onAddTask: (assigneeId?: string, spaceId?: string) => void;
}

function TaskRow({ task, onToggle }: { task: Task; onToggle: (id: string) => void }) {
  const done = task.status === 'DONE';
  return (
    <button
      type="button"
      onClick={() => onToggle(task.id)}
      className={cn(
        'w-full flex items-center gap-2 py-1.5 px-2 rounded-lg text-left text-sm touch-manipulation',
        done ? 'text-gray-400 line-through' : 'hover:bg-white/80',
      )}
    >
      {done ? <CheckCircle2 size={16} className="text-green-500 shrink-0" /> : <Circle size={16} className="text-gray-300 shrink-0" />}
      <span className="truncate">{task.title}</span>
    </button>
  );
}

export function HouseholdDayView({
  members,
  byPerson,
  sharedColumns,
  routines,
  currentUserId,
  onAddTask,
}: HouseholdDayViewProps) {
  const queryClient = useQueryClient();

  const toggleTask = useMutation({
    mutationFn: (id: string) => api.patch(`/tasks/${id}/toggle`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const sortedMembers = [...members].sort((a, b) => {
    if (a.id === currentUserId) return -1;
    if (b.id === currentUserId) return 1;
    return a.name.localeCompare(b.name);
  });

  const allTasks = [
    ...byPerson.flatMap((p) => p.tasks),
    ...sharedColumns.flatMap((c) => c.tasks),
  ];
  const totalDone = allTasks.filter((t) => t.status === 'DONE').length;
  const totalTasks = allTasks.length;
  const routineDone = routines.reduce((s, r) => s + r.done, 0);
  const routineTotal = routines.reduce((s, r) => s + r.total, 0);
  const progress = totalTasks > 0 ? Math.round((totalDone / totalTasks) * 100) : 0;

  return (
    <section className="rounded-2xl border-2 border-brand-200 bg-gradient-to-br from-brand-50 via-white to-violet-50 overflow-hidden">
      <div className="px-4 py-3 border-b border-brand-100 bg-white/70 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-brand-100 flex items-center justify-center shrink-0">
            <Users size={18} className="text-brand-700" />
          </div>
          <div className="min-w-0">
            <h2 className="font-bold text-gray-900 text-sm sm:text-base">Our day together</h2>
            <p className="text-xs text-gray-500 truncate">
              {totalDone}/{totalTasks} tasks · {routineDone}/{routineTotal} habits
            </p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xl font-bold text-brand-700 tabular-nums">{progress}%</p>
          <p className="text-[10px] text-gray-400">tasks done</p>
        </div>
      </div>

      <div className="h-2 bg-gray-100">
        <div className="h-full bg-brand-500 transition-all" style={{ width: `${progress}%` }} />
      </div>

      <div className="p-3 sm:p-4 space-y-3">
        {sortedMembers.map((member) => {
          const personData = byPerson.find((p) => p.userId === member.id);
          const tasks = personData?.tasks ?? [];
          const done = tasks.filter((t) => t.status === 'DONE').length;
          const pending = tasks.filter((t) => t.status !== 'DONE');

          return (
            <div key={member.id} className="rounded-xl border bg-white p-3 shadow-sm">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-8 h-8 rounded-full text-white text-xs font-bold flex items-center justify-center shrink-0"
                    style={{ backgroundColor: member.color }}
                  >
                    {member.name[0]}
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">
                      {member.name}
                      {member.id === currentUserId && <span className="text-gray-400 font-normal"> · you</span>}
                    </p>
                    <p className="text-xs text-gray-400">{done}/{tasks.length} tasks done</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onAddTask(member.id)}
                  className="p-2 text-brand-600 hover:bg-brand-50 rounded-lg shrink-0 touch-manipulation"
                  title="Add task"
                >
                  <Plus size={16} />
                </button>
              </div>
              {pending.length === 0 && tasks.length === 0 ? (
                <p className="text-xs text-gray-400 pl-10">No tasks today</p>
              ) : pending.length === 0 ? (
                <p className="text-xs text-green-600 pl-10 font-medium">All done for today ✓</p>
              ) : (
                <div className="space-y-0.5 pl-1">
                  {pending.slice(0, 5).map((task) => (
                    <TaskRow key={task.id} task={task} onToggle={(id) => toggleTask.mutate(id)} />
                  ))}
                  {pending.length > 5 && (
                    <p className="text-xs text-gray-400 pl-8">+{pending.length - 5} more</p>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {sharedColumns.map((col) => {
          const done = col.tasks.filter((t) => t.status === 'DONE').length;
          const pending = col.tasks.filter((t) => t.status !== 'DONE');
          return (
            <div key={col.spaceId} className="rounded-xl border border-violet-200 bg-violet-50/80 p-3">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-violet-900 truncate">Shared with {col.partnerName}</p>
                  <p className="text-xs text-violet-600">{done}/{col.tasks.length} tasks done</p>
                </div>
                <button
                  type="button"
                  onClick={() => onAddTask(undefined, col.spaceId)}
                  className="p-2 text-violet-600 hover:bg-violet-100 rounded-lg shrink-0"
                >
                  <Plus size={16} />
                </button>
              </div>
              {pending.length === 0 ? (
                <p className="text-xs text-violet-600/70">No shared tasks today</p>
              ) : (
                <div className="space-y-0.5">
                  {pending.slice(0, 4).map((task) => (
                    <TaskRow key={task.id} task={task} onToggle={(id) => toggleTask.mutate(id)} />
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {routines.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3">
            <p className="text-xs font-semibold text-amber-900 mb-2">Household habits today</p>
            <div className="flex flex-wrap gap-2">
              {routines.map((r) => (
                <span key={r.id} className="text-xs px-2.5 py-1 rounded-full bg-white border border-amber-200 text-amber-800">
                  {r.name}: {r.done}/{r.total}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
