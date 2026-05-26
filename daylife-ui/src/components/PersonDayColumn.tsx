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
}

export function PersonDayColumn({ person, tasks, selectedDate, showCompleted = true }: PersonDayColumnProps) {
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
      toast.success(`Added for ${person.name}`);
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
          'flex items-start gap-3 p-3 rounded-xl group transition-colors',
          isDone ? 'bg-green-50/80' : 'bg-gray-50 hover:bg-gray-100',
        )}
      >
        <button
          type="button"
          onClick={() => toggleTask.mutate(task.id)}
          className="shrink-0 mt-0.5"
          title={isDone ? 'Mark not done' : 'Mark done'}
        >
          {isDone ? (
            <CheckCircle2 size={22} className="text-green-500" />
          ) : (
            <Circle size={22} className="text-gray-300 hover:text-brand-600" />
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
          className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 shrink-0"
        >
          <Trash2 size={14} />
        </button>
      </div>
    );
  };

  return (
    <section className="bg-white rounded-2xl border shadow-sm flex flex-col min-h-[420px]">
      <div className="p-4 border-b">
        <div className="flex items-center gap-3 mb-3">
          <div
            className="w-11 h-11 rounded-full flex items-center justify-center text-white text-lg font-bold shadow-sm"
            style={{ backgroundColor: person.color }}
          >
            {person.name[0]}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-lg truncate">{person.name}</h2>
            <p className="text-xs text-gray-500">
              {doneCount} of {total} done
            </p>
          </div>
          <span className="text-sm font-bold tabular-nums" style={{ color: person.color }}>
            {progress}%
          </span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${progress}%`, backgroundColor: person.color }}
          />
        </div>
      </div>

      <div className="p-3 space-y-2 flex-1 overflow-y-auto max-h-[50vh] lg:max-h-none">
        {pending.length === 0 && (!showCompleted || done.length === 0) && (
          <p className="text-center text-gray-400 text-sm py-8">No tasks yet — add one below</p>
        )}
        {pending.map(renderTask)}
        {showCompleted && done.length > 0 && (
          <>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide pt-2 px-1">Completed</p>
            {done.map(renderTask)}
          </>
        )}
      </div>

      <form onSubmit={handleAdd} className="p-3 border-t bg-gray-50/80 rounded-b-2xl space-y-2">
        <div className="flex flex-wrap gap-1">
          {AREA_OPTIONS.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setArea(a)}
              className={cn(
                'text-[10px] px-2 py-0.5 rounded-full border transition-colors',
                area === a ? AREA_COLORS[a] + ' border-transparent' : 'bg-white text-gray-500 border-gray-200',
              )}
            >
              {AREA_LABELS[a]}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder={`Add task for ${person.name}...`}
            className="flex-1 px-3 py-2.5 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand-500 bg-white"
          />
          <button
            type="submit"
            disabled={!newTitle.trim() || addTask.isPending}
            className="px-4 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-50"
            style={{ backgroundColor: person.color }}
          >
            Add
          </button>
        </div>
      </form>
    </section>
  );
}
