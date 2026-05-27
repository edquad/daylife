import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, Task, User } from '../../lib/api';
import { formatDate, formatDayHeading, todayISO } from '../../lib/format';
import { useDateStore } from '../../lib/dateStore';
import { DayPicker } from '../../components/DayPicker';
import { AREA_COLORS, AREA_LABELS, PRIORITY_COLORS } from '../../lib/utils';
import { Plus, Search, CheckCircle2, Circle, Trash2, Inbox } from 'lucide-react';
import { TaskFormModal } from './TaskFormModal';
import { toast } from '../../components/Toaster';
import { PageHeader } from '../../components/PageHeader';

interface TasksResponse {
  data: Task[];
  total: number;
}

export function TasksPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const selectedDate = useDateStore((s) => s.selectedDate);
  const monthFromUrl = searchParams.get('month');
  const [search, setSearch] = useState('');
  const [areaFilter, setAreaFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
  const [dateFilter, setDateFilter] = useState(monthFromUrl ? '' : selectedDate);
  const [monthFilter, setMonthFilter] = useState(monthFromUrl || '');
  const [modalOpen, setModalOpen] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);

  useEffect(() => {
    if (!monthFilter) setDateFilter(selectedDate);
  }, [selectedDate, monthFilter]);

  useEffect(() => {
    const status = searchParams.get('status');
    const month = searchParams.get('month');
    if (status) setStatusFilter(status);
    if (month) {
      setMonthFilter(month);
      setDateFilter('');
    }
  }, [searchParams]);

  useEffect(() => {
    if (searchParams.get('add') === 'true') {
      setModalOpen(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const defaultArea = searchParams.get('area') as Task['area'] | null;

  const params = new URLSearchParams();
  if (monthFilter) params.set('month', monthFilter);
  else if (dateFilter) params.set('date', dateFilter);
  if (areaFilter) params.set('area', areaFilter);
  if (statusFilter) params.set('status', statusFilter);
  if (search) params.set('search', search);
  params.set('limit', '100');

  const { data, isLoading } = useQuery<TasksResponse>({
    queryKey: ['tasks', dateFilter, monthFilter, areaFilter, statusFilter, search],
    queryFn: () => api.get(`/tasks?${params}`),
  });

  const { data: members = [] } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: () => api.get('/users'),
  });

  const toggleTask = useMutation({
    mutationFn: (id: string) => api.patch<Task>(`/tasks/${id}/toggle`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  const deleteTask = useMutation({
    mutationFn: (id: string) => api.delete(`/tasks/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Task deleted');
    },
  });

  const tasks = data?.data ?? [];
  const heading = monthFilter
    ? new Date(`${monthFilter}-01`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    : formatDayHeading(dateFilter);

  return (
    <div className="p-4 lg:p-6 space-y-4 max-w-3xl mx-auto">
      <PageHeader
        theme="tasks"
        icon={Inbox}
        title={monthFilter ? 'Tasks this month' : 'Task inbox'}
        subtitle={heading}
        hint="Search & filter all tasks. For today's quick check-off, use the Today page."
        action={
          <button
            onClick={() => { setEditTask(null); setModalOpen(true); }}
            className="flex items-center gap-1.5 px-3 py-2 bg-white/20 hover:bg-white/30 rounded-xl text-sm font-medium shrink-0"
          >
            <Plus size={16} /> Add
          </button>
        }
      />

      {!monthFilter && <DayPicker />}

      {monthFilter && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Showing month:</span>
          <button
            type="button"
            onClick={() => {
              setMonthFilter('');
              setDateFilter(selectedDate);
              setSearchParams({});
            }}
            className="text-sm text-brand-600 hover:underline"
          >
            Back to day view
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks..."
            className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <select value={areaFilter} onChange={(e) => setAreaFilter(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
          <option value="">All areas</option>
          <option value="PERSONAL">Personal</option>
          <option value="WORK">Work</option>
          <option value="HOME">Home</option>
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
          <option value="">All status</option>
          <option value="TODO">To do</option>
          <option value="IN_PROGRESS">In progress</option>
          <option value="DONE">Done</option>
        </select>
      </div>

      {isLoading ? (
        <div className="animate-pulse space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-16 bg-gray-200 rounded-xl" />)}</div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p>No tasks yet. Add your first one!</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border shadow-sm divide-y">
          {tasks.map((task) => (
            <div key={task.id} className="flex items-center gap-3 p-4 hover:bg-gray-50 group">
              <button onClick={() => toggleTask.mutate(task.id)} className="shrink-0">
                {task.status === 'DONE'
                  ? <CheckCircle2 size={22} className="text-green-500" />
                  : <Circle size={22} className="text-gray-300 hover:text-brand-600" />}
              </button>
              <button
                onClick={() => { setEditTask(task); setModalOpen(true); }}
                className="flex-1 text-left min-w-0"
              >
                <p className={`font-medium ${task.status === 'DONE' ? 'line-through text-gray-400' : ''}`}>{task.title}</p>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${AREA_COLORS[task.area]}`}>{AREA_LABELS[task.area]}</span>
                  <span className={`text-xs ${PRIORITY_COLORS[task.priority]}`}>{task.priority.toLowerCase()}</span>
                  {task.dueDate && <span className="text-xs text-gray-400">Due {formatDate(task.dueDate)}</span>}
                  {task.assignee && (
                    <span className="text-xs px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: task.assignee.color }}>
                      {task.assignee.name}
                    </span>
                  )}
                </div>
              </button>
              <button
                onClick={() => deleteTask.mutate(task.id)}
                className="opacity-0 group-hover:opacity-100 p-2 text-gray-400 hover:text-red-500"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <TaskFormModal
          task={editTask}
          members={members}
          defaultArea={defaultArea || undefined}
          defaultDueDate={monthFilter ? `${monthFilter}-01` : dateFilter}
          onClose={() => { setModalOpen(false); setEditTask(null); }}
        />
      )}
    </div>
  );
}
