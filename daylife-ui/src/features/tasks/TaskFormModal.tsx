import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, Connection, Task, User } from '../../lib/api';
import { todayISO } from '../../lib/format';
import { useAuth } from '../auth/AuthContext';
import { toast } from '../../components/Toaster';
import { X } from 'lucide-react';
import { ShareScopePicker } from '../../components/ShareScopePicker';
import { defaultVisibility } from '../../lib/privacy';
import type { ShareScope } from '../../lib/shareScope';
import { activeShareConnections, connectionLabel, findConnectionBySpaceId } from '../../lib/shareScope';
import { useGitHubSync } from '../sync/GitHubSyncContext';

interface Props {
  task?: Task | null;
  members: User[];
  defaultArea?: Task['area'];
  defaultDueDate?: string;
  defaultAssigneeId?: string;
  defaultShareScope?: ShareScope;
  onClose: () => void;
}

export function TaskFormModal({
  task,
  members,
  defaultArea,
  defaultDueDate,
  defaultAssigneeId,
  defaultShareScope,
  onClose,
}: Props) {
  const { user } = useAuth();
  const { cloudReady } = useGitHubSync();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [area, setArea] = useState<Task['area']>(task?.area || defaultArea || 'PERSONAL');
  const [priority, setPriority] = useState<Task['priority']>(task?.priority || 'MEDIUM');
  const [status, setStatus] = useState<Task['status']>(task?.status || 'TODO');
  const [dueDate, setDueDate] = useState(task?.dueDate?.slice(0, 10) || defaultDueDate || todayISO());
  const [assigneeId, setAssigneeId] = useState(
    task?.assignee?.id || defaultAssigneeId || user?.id || members[0]?.id || '',
  );
  const [shareScope, setShareScope] = useState<ShareScope>(
    defaultShareScope || { kind: 'personal', visibility: defaultVisibility(members.length) },
  );
  const [loading, setLoading] = useState(false);

  const { data: connections = [] } = useQuery<Connection[]>({
    queryKey: ['connections'],
    queryFn: () => api.get('/connections'),
    enabled: cloudReady,
  });

  const save = useMutation({
    mutationFn: async () => {
      if (shareScope.kind === 'connection' && !task) {
        return api.post<Task>(`/shared/${shareScope.spaceId}/tasks`, {
          title: title.trim(),
          area,
          dueDate: dueDate || null,
          priority,
        });
      }

      const body = {
        title,
        description: description || undefined,
        area,
        priority,
        status,
        dueDate: dueDate || null,
        assigneeId: assigneeId || null,
        visibility:
          shareScope.kind === 'personal' && members.length > 1
            ? shareScope.visibility
            : 'SHARED',
      };
      if (task) return api.put<Task>(`/tasks/${task.id}`, body);
      return api.post<Task>('/tasks', body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['shared-summary'] });
      if (shareScope.kind === 'connection' && !task) {
        const conn = findConnectionBySpaceId(connections, shareScope.spaceId);
        toast.success(conn ? `Shared with ${connectionLabel(conn)}` : 'Shared task created');
      } else {
        toast.success(task ? 'Task updated' : 'Task created');
      }
      onClose();
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to save'),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    if (shareScope.kind === 'connection' && !task) {
      const allowed = activeShareConnections(connections, 'tasks');
      if (!allowed.some((c) => c.sharedSpaceId === shareScope.spaceId)) {
        toast.error('Pick someone to share with');
        return;
      }
    }
    setLoading(true);
    try {
      await save.mutateAsync();
    } finally {
      setLoading(false);
    }
  };

  const isSharedCreate = !task && shareScope.kind === 'connection';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-xl z-10 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
          <h2 className="text-lg font-semibold">{task ? 'Edit task' : 'New task'}</h2>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {!task && (
            <ShareScopePicker
              feature="tasks"
              value={shareScope}
              onChange={setShareScope}
              membersCount={members.length}
            />
          )}
          <div>
            <label className="block text-sm font-medium mb-1">Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} required
              className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          {!isSharedCreate && (
            <div>
              <label className="block text-sm font-medium mb-1">Notes</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
                className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Area</label>
              <select value={area} onChange={(e) => setArea(e.target.value as Task['area'])} className="w-full px-3 py-2 border rounded-lg">
                <option value="PERSONAL">Personal</option>
                <option value="WORK">Work</option>
                <option value="HOME">Home</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Priority</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value as Task['priority'])} className="w-full px-3 py-2 border rounded-lg">
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Due date</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg" />
            </div>
            {!isSharedCreate && (
              <div>
                <label className="block text-sm font-medium mb-1">Assign to</label>
                <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} className="w-full px-3 py-2 border rounded-lg">
                  <option value="">Anyone</option>
                  {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
            )}
          </div>
          {task && (
            <div>
              <label className="block text-sm font-medium mb-1">Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value as Task['status'])} className="w-full px-3 py-2 border rounded-lg">
                <option value="TODO">To do</option>
                <option value="IN_PROGRESS">In progress</option>
                <option value="DONE">Done</option>
              </select>
            </div>
          )}
          <button type="submit" disabled={loading}
            className={`w-full py-2.5 text-white rounded-lg disabled:opacity-50 font-medium ${
              isSharedCreate ? 'bg-violet-600 hover:bg-violet-700' : 'bg-brand-600 hover:bg-brand-700'
            }`}>
            {loading ? 'Saving...' : task ? 'Save changes' : isSharedCreate ? 'Create shared task' : 'Create task'}
          </button>
        </form>
      </div>
    </div>
  );
}
