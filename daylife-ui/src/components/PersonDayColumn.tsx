import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Circle, Trash2 } from 'lucide-react';
import { api, Task, User } from '../lib/api';
import { AREA_COLORS, AREA_LABELS, cn } from '../lib/utils';
import { toast } from './Toaster';

const AREA_OPTIONS: Task['area'][] = ['PERSONAL', 'WORK', 'HOME'];

interface PersonDayColumnProps {
  person: User;
  tasks: Task[];
  selectedDate: string;
  showCompleted?: boolean;
  highlight?: boolean;
  compact?: boolean;
}

export function PersonDayColumn({ person, tasks, selectedDate, showCompleted = true, highlight, compact }: PersonDayColumnProps) {
  const queryClient = useQueryClient();
  const [newTitle, setNewTitle] = useState('');
  const [area, setArea] = useState<Task['area']>('PERSONAL');

  const pending = tasks.filter((t) => t.status !== 'DONE');
  const done = tasks.filter((t) => t.status === 'DONE');
  const total = tasks.length;
  const doneCount = done.length;
  const progress = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
  };

  const addTask = useMutation({
    mutationFn: (title: string) =>
      api.post<Task>('/tasks', {
        title,
        area,
        dueDate: selectedDate,
        assigneeId: person.id,
        priority: 'MEDIUM',
      }),
    onSuccess: () => {
      setNewTitle('');
      invalidate();
      toast.success(highlight ? 'Added to your list' : `Added for ${person.name}`);
    },
  });

  const toggleTask = useMutation({
    mutationFn: (id: string) => api.patch<Task>(`/tasks/${id}/toggle`),
    onSuccess: invalidate,
  });

  const deleteTask = useMutation({
    mutationFn: (id: string) => api.delete(`/tasks/${id}`),
    onSuccess: invalidate,
  });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title) return;
    addTask.mutate(title);
  };

  const renderTask = (task: Task) => {
    const isDone = task.status === 'DONE';
    return (
      <div
        key={task.id}
        className={cn(
          'flex items-start gap-3 p-3 rounded-xl group transition-colors active:scale-[0.99]',
          isDone ? 'bg-green-50/80' : 'bg-gray-50 hover:bg-gray-100',
        )}
      >
        <button
          type="button"
          onClick={() => toggleTask.mutate(task.id)}
          className="shrink-0 mt-0.5 p-1 -m-1 touch-manipulation"
          aria-label={isDone ? 'Mark not done' : 'Mark done'}
        >
          {isDone ? (
            <CheckCircle2 size={24} className="text-green-500" />
          ) : (
            <Circle size={24} className="text-gray-300 hover:text-brand-600" />
          )}
        </button>
        <div className="flex-1 min-w-0">
          <p className={cn('font-medium text-sm', isDone && 'line-through text-gray-400')}>{task.title}</p>
          <span className={`inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full ${AREA_COLORS[task.area]}`}>
            {AREA_LABELS[task.area]}
          </span>
        </div>
        <button
          type="button"
          onClick={() => deleteTask.mutate(task.id)}
          className="p-2 text-gray-400 hover:text-red-500 shrink-0 opacity-60 sm:opacity-0 sm:group-hover:opacity-100 touch-manipulation"
          aria-label="Delete task"
        >
          <Trash2 size={16} />
        </button>
      </div>
    );
  };

  return (
    <section
      className={cn(
        'bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col overflow-hidden',
        compact ? 'min-h-0' : 'min-h-[320px]',
      )}
    >
      <div className={cn('border-b', compact ? 'px-3 py-2.5' : 'p-4')}>
        <div className="flex items-center gap-2.5">
          {!compact && (
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
              style={{ backgroundColor: person.color }}
            >
              {person.name[0]}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-base truncate">
              {highlight ? (compact ? 'Tasks' : 'My tasks') : person.name}
            </h2>
            {total > 0 && (
              <p className="text-xs text-gray-500">{doneCount} of {total} done</p>
            )}
          </div>
          {total > 0 && (
            <span className="text-sm font-bold tabular-nums shrink-0" style={{ color: person.color }}>
              {progress}%
            </span>
          )}
        </div>
        {total > 0 && (
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mt-2">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${progress}%`, backgroundColor: person.color }}
            />
          </div>
        )}
      </div>

      <div className={cn('space-y-1.5 flex-1 overflow-y-auto', compact ? 'p-2 max-h-[40vh]' : 'p-3 max-h-[50vh] lg:max-h-none')}>
        {pending.length === 0 && (!showCompleted || done.length === 0) && (
          <p className="text-sm text-gray-400 text-center py-6">No tasks yet</p>
        )}
        {pending.map(renderTask)}
        {showCompleted && done.length > 0 && (
          <>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide pt-2 px-1">Done</p>
            {done.map(renderTask)}
          </>
        )}
      </div>

      <form onSubmit={handleAdd} className={cn('border-t bg-gray-50/80', compact ? 'p-2 space-y-1.5' : 'p-3 space-y-2')}>
        {!compact && (
          <div className="flex flex-wrap gap-1">
            {AREA_OPTIONS.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setArea(a)}
                className={cn(
                  'text-[10px] px-2.5 py-1 rounded-full border transition-all touch-manipulation',
                  area === a ? AREA_COLORS[a] + ' border-transparent' : 'bg-white text-gray-500 border-gray-200',
                )}
              >
                {AREA_LABELS[a]}
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Add a task..."
            className="flex-1 px-3 py-2.5 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand-500 bg-white"
          />
          <button
            type="submit"
            disabled={!newTitle.trim() || addTask.isPending}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white active:scale-95 disabled:opacity-50 touch-manipulation"
            style={{ backgroundColor: person.color }}
          >
            Add
          </button>
        </div>
      </form>
    </section>
  );
}
