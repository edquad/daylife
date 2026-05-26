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
      api.post<Task>(`/shared/${spaceId}/tasks`, {
        title,
        area,
        dueDate: selectedDate,
      }),
    onSuccess: () => {
      setNewTitle('');
      invalidate();
      toast.success('Added to shared list');
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
          'flex items-start gap-3 p-3 rounded-xl group transition-colors',
          isDone ? 'bg-green-50/80' : 'bg-violet-50/80 hover:bg-violet-100/80',
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
            <Circle size={22} className="text-violet-300 hover:text-violet-600" />
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
    <section className="bg-white rounded-2xl border border-violet-200 shadow-sm flex flex-col min-h-[420px] ring-2 ring-violet-100">
      <div className="p-4 border-b bg-gradient-to-r from-violet-50 to-fuchsia-50">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-11 h-11 rounded-full flex items-center justify-center text-violet-700 bg-white border border-violet-200 shadow-sm">
            <Users size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-lg truncate">With {partnerName}</h2>
            <p className="text-xs text-violet-600">Shared tasks · both can edit</p>
          </div>
          <span className="text-sm font-bold tabular-nums text-violet-700">
            {progress}%
          </span>
        </div>
        <div className="h-2 bg-white/80 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300 bg-violet-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-xs text-violet-600 mt-2">
          {doneCount} of {total} done
        </p>
      </div>

      <div className="p-3 space-y-2 flex-1 overflow-y-auto max-h-[50vh] lg:max-h-none">
        {pending.length === 0 && done.length === 0 && (
          <p className="text-center text-gray-400 text-sm py-8">No shared tasks yet — add one below</p>
        )}
        {pending.map(renderTask)}
        {done.length > 0 && (
          <>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide pt-2 px-1">Completed</p>
            {done.map(renderTask)}
          </>
        )}
      </div>

      <form onSubmit={handleAdd} className="p-3 border-t bg-violet-50/50 rounded-b-2xl space-y-2">
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
            placeholder={`Shared task with ${partnerName}...`}
            className="flex-1 px-3 py-2.5 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-violet-500 bg-white"
          />
          <button
            type="submit"
            disabled={!newTitle.trim() || addTask.isPending}
            className="px-4 py-2.5 rounded-xl text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-50"
          >
            Add
          </button>
        </div>
      </form>
    </section>
  );
}
