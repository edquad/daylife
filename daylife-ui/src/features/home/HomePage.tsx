import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, Task, DailyNote, User } from '../../lib/api';
import { formatDate, todayISO } from '../../lib/format';
import { Plus, Circle, Trash2, Home as HomeIcon } from 'lucide-react';
import { TaskFormModal } from '../tasks/TaskFormModal';
import { toast } from '../../components/Toaster';

interface TasksResponse { data: Task[]; }
interface NotesResponse { data: DailyNote[]; }

const HOME_CHORES = [
  'Dishes & kitchen cleanup',
  'Laundry',
  'Vacuum / mop floors',
  'Take out trash',
  'Grocery run',
  'Pay bills',
  'Water plants',
  'Tidy living room',
];

export function HomePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [noteContent, setNoteContent] = useState('');
  const [noteDate, setNoteDate] = useState(todayISO());
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [quickChore, setQuickChore] = useState('');

  useEffect(() => {
    if (searchParams.get('add') === 'true') {
      setTaskModalOpen(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const { data: tasksData } = useQuery<TasksResponse>({
    queryKey: ['tasks', 'home'],
    queryFn: () => api.get('/tasks?area=HOME&status=TODO&limit=50'),
  });

  const { data: notesData } = useQuery<NotesResponse>({
    queryKey: ['notes', 'home'],
    queryFn: () => api.get('/notes?area=HOME&limit=10'),
  });

  const { data: members = [] } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: () => api.get('/users'),
  });

  const toggleTask = useMutation({
    mutationFn: (id: string) => api.patch(`/tasks/${id}/toggle`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  });

  const addTask = useMutation({
    mutationFn: (title: string) => api.post('/tasks', {
      title,
      area: 'HOME',
      dueDate: todayISO(),
      priority: 'MEDIUM',
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Chore added');
    },
  });

  const addNote = useMutation({
    mutationFn: () => api.post('/notes', { content: noteContent, area: 'HOME', noteDate }),
    onSuccess: () => {
      setNoteContent('');
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      toast.success('Home note saved');
    },
  });

  const homeTasks = tasksData?.data ?? [];
  const notes = notesData?.data ?? [];

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <HomeIcon size={24} className="text-green-600" /> Home
          </h1>
          <p className="text-gray-500 text-sm">Chores, maintenance & household notes</p>
        </div>
        <button onClick={() => setTaskModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium">
          <Plus size={16} /> Add chore
        </button>
      </div>

      <section className="bg-white rounded-2xl border shadow-sm p-4">
        <h2 className="font-semibold mb-3">Quick add chore</h2>
        <div className="flex flex-wrap gap-2 mb-3">
          {HOME_CHORES.map((chore) => (
            <button
              key={chore}
              onClick={() => addTask.mutate(chore)}
              className="px-3 py-1.5 text-sm border rounded-full hover:bg-green-50 hover:border-green-200 transition-colors"
            >
              + {chore}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={quickChore}
            onChange={(e) => setQuickChore(e.target.value)}
            placeholder="Custom chore..."
            className="flex-1 px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-green-500"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && quickChore.trim()) {
                addTask.mutate(quickChore.trim());
                setQuickChore('');
              }
            }}
          />
          <button
            onClick={() => { if (quickChore.trim()) { addTask.mutate(quickChore.trim()); setQuickChore(''); } }}
            className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm"
          >
            Add
          </button>
        </div>
      </section>

      <div className="grid lg:grid-cols-2 gap-6">
        <section className="bg-white rounded-2xl border shadow-sm">
          <div className="p-4 border-b flex justify-between items-center">
            <h2 className="font-semibold">Home to-do</h2>
            <Link to="/tasks?area=HOME" className="text-sm text-brand-600 hover:underline">All →</Link>
          </div>
          <div className="divide-y">
            {homeTasks.length === 0 ? (
              <p className="p-6 text-center text-gray-400 text-sm">All caught up at home!</p>
            ) : homeTasks.map((task) => (
              <div key={task.id} className="flex items-center gap-3 p-4">
                <button onClick={() => toggleTask.mutate(task.id)}>
                  <Circle size={20} className="text-gray-300 hover:text-green-600" />
                </button>
                <div className="flex-1">
                  <p className="font-medium">{task.title}</p>
                  <div className="flex gap-2 mt-0.5">
                    {task.dueDate && <span className="text-xs text-gray-400">{formatDate(task.dueDate)}</span>}
                    {task.assignee && (
                      <span className="text-xs px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: task.assignee.color }}>
                        {task.assignee.name}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white rounded-2xl border shadow-sm">
          <div className="p-4 border-b"><h2 className="font-semibold">Household notes</h2></div>
          <div className="p-4 space-y-3">
            <textarea
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              placeholder="Shopping list, maintenance reminders, etc."
              rows={3}
              className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-green-500 text-sm"
            />
            <button
              onClick={() => noteContent.trim() && addNote.mutate()}
              disabled={!noteContent.trim()}
              className="w-full py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
            >
              Save note
            </button>
          </div>
          <div className="divide-y">
            {notes.map((note) => (
              <div key={note.id} className="p-4">
                <p className="text-xs text-gray-400 mb-1">{formatDate(note.noteDate)} · {note.author.name}</p>
                <p className="text-sm whitespace-pre-wrap">{note.content}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      {taskModalOpen && (
        <TaskFormModal members={members} defaultArea="HOME" onClose={() => setTaskModalOpen(false)} />
      )}
    </div>
  );
}
