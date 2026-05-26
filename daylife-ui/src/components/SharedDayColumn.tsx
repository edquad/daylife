import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Circle, Trash2, Users } from 'lucide-react';
import { api, Task } from '../lib/api';
import { AREA_COLORS, AREA_LABELS, cn } from '../lib/utils';
import { toast } from './Toaster';

const AREA_OPTIONS: Task['area'][] = ['PERSONAL', 'WORK', 'HOME'];

interface SharedDayColumnProps {
  spaceId: string;
  partnerName: string;
  tasks: Task[];
  selectedDate: string;
}

export function SharedDayColumn({ spaceId, partnerName, tasks, selectedDate }: SharedDayColumnProps) {
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
    queryClient.invalidateQueries({ queryKey: ['shared-summary'] });
  };

  const addTask = useMutation({
    mutationFn: (title: string) =>
      api.post<Task>(`/shared/${spaceId}/tasks`, { title, area, dueDate: selectedDate }),
    onSuccess: () => {
      setNewTitle('');
      invalidate();
      toast.success(`Shared with ${partnerName}`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggleTask = useMutation({
    mutationFn: (id: string) => api.patch<Task>(`/shared/${spaceId}/tasks/${id}/toggle`),
    onSuccess: invalidate,
  });

  const deleteTask = useMutation({
    mutationFn: (id: string) => api.delete(`/shared/${spaceId}/tasks/${id}`),
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
          isDone ? 'bg-green-50/80' : 'bg-violet-50/80 hover:bg-violet-100/80',
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
            <Circle size={24} className="text-violet-300 hover:text-violet-600" />
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
    <section className="bg-white rounded-2xl border border-violet-200 shadow-sm flex flex-col overflow-hidden min-h-0">
      <div className="px-3 py-2.5 border-b bg-violet-50/80">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-violet-700 bg-white border border-violet-200 shrink-0">
            <Users size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-base truncate text-violet-900">With {partnerName}</h2>
            {total > 0 && (
              <p className="text-xs text-violet-600">{doneCount} of {total} done</p>
            )}
          </div>
          {total > 0 && (
            <span className="text-sm font-bold tabular-nums text-violet-700 shrink-0">{progress}%</span>
          )}
        </div>
      </div>

      <div className="p-2 space-y-1.5 flex-1 overflow-y-auto max-h-[40vh]">
        {pending.length === 0 && done.length === 0 && (
          <p className="text-sm text-violet-600/70 text-center py-6">No shared tasks yet</p>
        )}
        {pending.map(renderTask)}
        {done.length > 0 && (
          <>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide pt-2 px-1">Done</p>
            {done.map(renderTask)}
          </>
        )}
      </div>

      <form onSubmit={handleAdd} className="p-2 border-t border-violet-100 bg-violet-50/40">
        <div className="flex gap-2">
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Add shared task..."
            className="flex-1 px-3 py-2.5 border border-violet-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-violet-500 bg-white"
          />
          <button
            type="submit"
            disabled={!newTitle.trim() || addTask.isPending}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-violet-600 hover:bg-violet-700 active:scale-95 disabled:opacity-50 touch-manipulation"
          >
            Add
          </button>
        </div>
      </form>
    </section>
  );
}
