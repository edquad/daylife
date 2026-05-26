import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, Task, DailyNote, User } from '../../lib/api';
import { formatDate, todayISO } from '../../lib/format';
import { AREA_COLORS } from '../../lib/utils';
import { Plus, CheckCircle2, Circle, Trash2, PenLine } from 'lucide-react';
import { TaskFormModal } from '../tasks/TaskFormModal';
import { toast } from '../../components/Toaster';

interface TasksResponse { data: Task[]; }
interface NotesResponse { data: DailyNote[]; }

export function WorkPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [noteContent, setNoteContent] = useState('');
  const [noteDate, setNoteDate] = useState(todayISO());
  const [taskModalOpen, setTaskModalOpen] = useState(false);

  useEffect(() => {
    if (searchParams.get('add') === 'true') {
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const { data: tasksData } = useQuery<TasksResponse>({
    queryKey: ['tasks', 'work'],
    queryFn: () => api.get('/tasks?area=WORK&status=TODO&limit=50'),
  });

  const { data: notesData, isLoading: notesLoading } = useQuery<NotesResponse>({
    queryKey: ['notes', 'work'],
    queryFn: () => api.get('/notes?area=WORK&limit=20'),
  });

  const { data: members = [] } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: () => api.get('/users'),
  });

  const toggleTask = useMutation({
    mutationFn: (id: string) => api.patch(`/tasks/${id}/toggle`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  });

  const addNote = useMutation({
    mutationFn: () => api.post('/notes', { content: noteContent, area: 'WORK', noteDate }),
    onSuccess: () => {
      setNoteContent('');
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Work note saved');
    },
  });

  const deleteNote = useMutation({
    mutationFn: (id: string) => api.delete(`/notes/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notes'] }),
  });

  const workTasks = tasksData?.data ?? [];
  const notes = notesData?.data ?? [];

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Work</h1>
          <p className="text-gray-500 text-sm">Daily work tasks & journal</p>
        </div>
        <button onClick={() => setTaskModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 text-sm font-medium">
          <Plus size={16} /> Work task
        </button>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <section className="bg-white rounded-2xl border shadow-sm">
          <div className="p-4 border-b">
            <h2 className="font-semibold">Work tasks</h2>
          </div>
          <div className="divide-y">
            {workTasks.length === 0 ? (
              <p className="p-6 text-center text-gray-400 text-sm">No open work tasks</p>
            ) : workTasks.map((task) => (
              <div key={task.id} className="flex items-center gap-3 p-4">
                <button onClick={() => toggleTask.mutate(task.id)}>
                  <Circle size={20} className="text-gray-300 hover:text-brand-600" />
                </button>
                <div className="flex-1">
                  <p className="font-medium">{task.title}</p>
                  {task.dueDate && <p className="text-xs text-gray-400">Due {formatDate(task.dueDate)}</p>}
                </div>
              </div>
            ))}
          </div>
          <div className="p-3 border-t">
            <Link to="/tasks?area=WORK" className="text-sm text-brand-600 hover:underline">View all work tasks →</Link>
          </div>
        </section>

        <section className="bg-white rounded-2xl border shadow-sm">
          <div className="p-4 border-b flex items-center gap-2">
            <PenLine size={18} className="text-brand-600" />
            <h2 className="font-semibold">Daily work log</h2>
          </div>
          <div className="p-4 space-y-3">
            <textarea
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              placeholder="What did you work on today?"
              rows={3}
              className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-brand-500 text-sm"
            />
            <div className="flex gap-2">
              <input type="date" value={noteDate} onChange={(e) => setNoteDate(e.target.value)}
                className="px-3 py-2 border rounded-lg text-sm" />
              <button
                onClick={() => noteContent.trim() && addNote.mutate()}
                disabled={!noteContent.trim() || addNote.isPending}
                className="flex-1 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
              >
                Save note
              </button>
            </div>
          </div>
          <div className="divide-y max-h-64 overflow-y-auto">
            {notesLoading ? null : notes.length === 0 ? (
              <p className="p-4 text-center text-gray-400 text-sm">No work notes yet</p>
            ) : notes.map((note) => (
              <div key={note.id} className="p-4 group">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-400">{formatDate(note.noteDate)} · {note.author.name}</span>
                  <button onClick={() => deleteNote.mutate(note.id)}
                    className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500">
                    <Trash2 size={14} />
                  </button>
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{note.content}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      {taskModalOpen && (
        <TaskFormModal members={members} defaultArea="WORK" onClose={() => setTaskModalOpen(false)} />
      )}
    </div>
  );
}
