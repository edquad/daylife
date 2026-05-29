import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  api,
  ShoppingItem,
  RoutineToday,
  RoutineItem,
  Reminder,
  UpcomingReminder,
  ShoppingCategory,
  User,
} from '../../lib/api';
import { labelsToRoutineItems, templatesForTimeOfDay } from '../../lib/routines';
import { uid } from '../../lib/storage';
import { useDateStore } from '../../lib/dateStore';
import { formatDate, todayISO } from '../../lib/format';
import { cn } from '../../lib/utils';
import { toast } from '../../components/Toaster';
import { PageHeader } from '../../components/PageHeader';
import { DailyFlowStrip } from '../../components/DailyFlowStrip';
import { getDayPhase, defaultDailyTab } from '../../lib/dailyFlow';
import { ShareScopePicker } from '../../components/ShareScopePicker';
import type { ShareScope } from '../../lib/shareScope';
import {
  ShoppingCart,
  Sun,
  Moon,
  Bell,
  Plus,
  Trash2,
  CheckCircle2,
  Circle,
  Sparkles,
  Pencil,
  X,
} from 'lucide-react';

type Tab = 'shopping' | 'routines' | 'reminders';

const SHOP_CATEGORIES: { id: ShoppingCategory; label: string; color: string }[] = [
  { id: 'GROCERIES', label: 'Groceries', color: 'bg-green-100 text-green-700' },
  { id: 'HOME', label: 'Home', color: 'bg-blue-100 text-blue-700' },
  { id: 'PHARMACY', label: 'Pharmacy', color: 'bg-red-100 text-red-700' },
  { id: 'OTHER', label: 'Other', color: 'bg-gray-100 text-gray-700' },
];

const QUICK_SHOP = [
  'Milk', 'Bread', 'Eggs', 'Rice', 'Vegetables', 'Fruit',
  'Chicken', 'Snacks', 'Detergent', 'Toilet paper', 'Medicine', 'Coffee',
];

const REPEAT_LABELS = { NONE: 'Once', MONTHLY: 'Every month', YEARLY: 'Every year' };

function ShoppingTab() {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [category, setCategory] = useState<ShoppingCategory>('GROCERIES');
  const [shareScope, setShareScope] = useState<ShareScope>({ kind: 'personal', visibility: 'SHARED' });

  const { data: members = [] } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: () => api.get('/users'),
  });

  const { data, isLoading } = useQuery<{ data: ShoppingItem[]; pending: number }>({
    queryKey: ['shopping'],
    queryFn: () => api.get('/shopping'),
  });

  const { data: sharedShopping } = useQuery<{
    groups: Array<{ spaceId: string; partnerName: string; items: ShoppingItem[]; pending: number }>;
  }>({
    queryKey: ['shared-shopping'],
    queryFn: () => api.get('/shared/shopping'),
  });

  const sharedGroups = sharedShopping?.groups ?? [];

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['shopping'] });
    queryClient.invalidateQueries({ queryKey: ['shared-shopping'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const addItem = useMutation({
    mutationFn: (payload: { name: string; quantity?: string; category?: ShoppingCategory }) =>
      api.post<ShoppingItem>('/shopping', { ...payload, category: payload.category || category }),
    onSuccess: () => { invalidate(); toast.success('Added to list'); },
  });

  const toggleItem = useMutation({
    mutationFn: (id: string) => api.patch<ShoppingItem>(`/shopping/${id}`),
    onSuccess: invalidate,
  });

  const deleteItem = useMutation({
    mutationFn: (id: string) => api.delete(`/shopping/${id}`),
    onSuccess: () => { invalidate(); toast.success('Removed'); },
  });

  const addSharedItem = useMutation({
    mutationFn: ({
      spaceId,
      itemName,
      itemQuantity,
      itemCategory,
    }: {
      spaceId: string;
      itemName: string;
      itemQuantity?: string;
      itemCategory?: ShoppingCategory;
    }) =>
      api.post<ShoppingItem>(`/shared/${spaceId}/shopping`, {
        name: itemName,
        quantity: itemQuantity,
        category: itemCategory || 'GROCERIES',
      }),
    onSuccess: () => { invalidate(); toast.success('Added to shared list'); },
  });

  const toggleSharedItem = useMutation({
    mutationFn: ({ spaceId, id }: { spaceId: string; id: string }) =>
      api.patch<ShoppingItem>(`/shared/${spaceId}/shopping/${id}`),
    onSuccess: invalidate,
  });

  const deleteSharedItem = useMutation({
    mutationFn: ({ spaceId, id }: { spaceId: string; id: string }) =>
      api.delete(`/shared/${spaceId}/shopping/${id}`),
    onSuccess: () => { invalidate(); toast.success('Removed'); },
  });

  const clearChecked = useMutation({
    mutationFn: () => api.post('/shopping/clear-checked'),
    onSuccess: () => { invalidate(); toast.success('Checked items cleared'); },
  });

  const items = data?.data ?? [];
  const pending = items.filter((i) => !i.checked);
  const checked = items.filter((i) => i.checked);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (shareScope.kind === 'connection') {
      addSharedItem.mutate({
        spaceId: shareScope.spaceId,
        itemName: name.trim(),
        itemQuantity: quantity.trim() || undefined,
        itemCategory: category,
      });
    } else {
      addItem.mutate({ name: name.trim(), quantity: quantity.trim() || undefined });
    }
    setName('');
    setQuantity('');
  };

  return (
    <div className="space-y-4">
      <section className="bg-white rounded-2xl border shadow-sm p-4">
        <h2 className="font-semibold mb-3">Quick add</h2>
        <div className="flex flex-wrap gap-2 mb-4">
          {QUICK_SHOP.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => addItem.mutate({ name: item })}
              className="px-3 py-1.5 text-sm border rounded-full hover:bg-green-50 hover:border-green-200"
            >
              + {item}
            </button>
          ))}
        </div>
        <form onSubmit={handleAdd} className="space-y-3">
          <ShareScopePicker
            feature="shopping"
            value={shareScope}
            onChange={setShareScope}
            membersCount={members.length}
          />
          <div className="flex flex-wrap gap-1">
            {SHOP_CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategory(c.id)}
                className={cn('text-xs px-2.5 py-1 rounded-full border', category === c.id ? c.color + ' border-transparent' : 'bg-white text-gray-500')}
              >
                {c.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Add item..."
              className="flex-1 px-3 py-2.5 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand-500"
            />
            <input
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="Qty"
              className="w-20 px-3 py-2.5 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand-500"
            />
            <button type="submit" disabled={!name.trim()} className="px-4 py-2.5 bg-green-600 text-white rounded-xl text-sm font-medium disabled:opacity-50">
              Add
            </button>
          </div>
        </form>
      </section>

      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{pending.length} to buy · {checked.length} in cart</p>
        {checked.length > 0 && (
          <button onClick={() => clearChecked.mutate()} className="text-sm text-brand-600 hover:underline">
            Clear checked
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="animate-pulse h-32 bg-gray-200 rounded-2xl" />
      ) : items.length === 0 ? (
        <p className="text-center text-gray-400 py-12">Shopping list is empty</p>
      ) : (
        <div className="bg-white rounded-2xl border shadow-sm divide-y">
          {[...pending, ...checked].map((item) => {
            const cat = SHOP_CATEGORIES.find((c) => c.id === item.category);
            return (
              <div key={item.id} className={cn('flex items-center gap-3 p-4 group', item.checked && 'opacity-60')}>
                <button onClick={() => toggleItem.mutate(item.id)}>
                  {item.checked ? (
                    <CheckCircle2 size={22} className="text-green-500" />
                  ) : (
                    <Circle size={22} className="text-gray-300 hover:text-green-600" />
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={cn('font-medium', item.checked && 'line-through text-gray-400')}>{item.name}</p>
                  <div className="flex gap-2 mt-0.5">
                    {item.quantity && <span className="text-xs text-gray-400">{item.quantity}</span>}
                    {cat && <span className={cn('text-[10px] px-2 py-0.5 rounded-full', cat.color)}>{cat.label}</span>}
                  </div>
                </div>
                <button
                  onClick={() => deleteItem.mutate(item.id)}
                  className="opacity-0 group-hover:opacity-100 p-2 text-gray-400 hover:text-red-500"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            );
          })}
        </div>
      )}
      {sharedGroups.map((group) => (
        <section key={group.spaceId} className="bg-violet-50 border border-violet-200 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-violet-900">Shared shopping with {group.partnerName}</h2>
            <span className="text-xs text-violet-700">{group.pending} to buy</span>
          </div>
          {group.items.length === 0 ? (
            <p className="text-sm text-violet-600/70">Shared list is empty.</p>
          ) : (
            <div className="bg-white rounded-xl border divide-y">
              {group.items.map((item) => {
                const cat = SHOP_CATEGORIES.find((c) => c.id === item.category);
                return (
                  <div key={item.id} className={cn('flex items-center gap-3 p-3 group', item.checked && 'opacity-60')}>
                    <button type="button" onClick={() => toggleSharedItem.mutate({ spaceId: group.spaceId, id: item.id })}>
                      {item.checked ? (
                        <CheckCircle2 size={22} className="text-green-500" />
                      ) : (
                        <Circle size={22} className="text-violet-300 hover:text-violet-600" />
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={cn('font-medium text-sm', item.checked && 'line-through text-gray-400')}>{item.name}</p>
                      {cat && <span className={cn('text-[10px] px-2 py-0.5 rounded-full', cat.color)}>{cat.label}</span>}
                    </div>
                    <button
                      type="button"
                      onClick={() => deleteSharedItem.mutate({ spaceId: group.spaceId, id: item.id })}
                      className="opacity-0 group-hover:opacity-100 p-2 text-gray-400 hover:text-red-500"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}

function RoutinesTab() {
  const selectedDate = useDateStore((s) => s.selectedDate);
  const queryClient = useQueryClient();
  const [newRoutineName, setNewRoutineName] = useState('');
  const [newItemLabels, setNewItemLabels] = useState('');
  const [editingRoutine, setEditingRoutine] = useState<RoutineToday | null>(null);
  const [editItems, setEditItems] = useState<RoutineItem[]>([]);

  const openEdit = (routine: RoutineToday) => {
    setEditingRoutine(routine);
    setEditItems(routine.items.map(({ id, label }) => ({ id, label })));
  };

  const closeEdit = () => {
    setEditingRoutine(null);
    setEditItems([]);
  };

  const { data, isLoading } = useQuery<{ date: string; routines: RoutineToday[] }>({
    queryKey: ['routines-today', selectedDate],
    queryFn: () => api.get(`/routines/today?date=${selectedDate}`),
  });

  const { data: sharedRoutines } = useQuery<{
    groups: Array<{ spaceId: string; partnerName: string; date: string; routines: RoutineToday[] }>;
  }>({
    queryKey: ['shared-routines', selectedDate],
    queryFn: () => api.get(`/shared/routines/today?date=${selectedDate}`),
  });

  const sharedGroups = sharedRoutines?.groups ?? [];

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['routines-today'] });
    queryClient.invalidateQueries({ queryKey: ['shared-routines'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const toggleItem = useMutation({
    mutationFn: ({ routineId, itemId }: { routineId: string; itemId: string }) =>
      api.post(`/routines/${routineId}/toggle`, { date: selectedDate, itemId }),
    onSuccess: invalidate,
  });

  const toggleSharedItem = useMutation({
    mutationFn: ({ spaceId, routineId, itemId }: { spaceId: string; routineId: string; itemId: string }) =>
      api.post(`/shared/${spaceId}/routines/${routineId}/toggle`, { date: selectedDate, itemId }),
    onSuccess: invalidate,
  });

  const addRoutine = useMutation({
    mutationFn: () =>
      api.post('/routines', {
        name: newRoutineName.trim(),
        items: newItemLabels.split('\n').map((s) => s.trim()).filter(Boolean),
      }),
    onSuccess: () => {
      setNewRoutineName('');
      setNewItemLabels('');
      invalidate();
      toast.success('Routine added');
    },
  });

  const deleteRoutine = useMutation({
    mutationFn: (id: string) => api.delete(`/routines/${id}`),
    onSuccess: () => { invalidate(); toast.success('Routine removed'); },
  });

  const updateRoutine = useMutation({
    mutationFn: () => {
      if (!editingRoutine) throw new Error('No routine selected');
      const items = editItems.map((item) => ({ id: item.id, label: item.label.trim() })).filter((item) => item.label);
      if (items.length === 0) throw new Error('Add at least one step');
      return api.put(`/routines/${editingRoutine.id}`, { items });
    },
    onSuccess: () => {
      invalidate();
      closeEdit();
      toast.success('Routine updated');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const routineTemplates = editingRoutine ? templatesForTimeOfDay(editingRoutine.timeOfDay) : [];

  const routines = data?.routines ?? [];
  const totalDone = routines.reduce((s, r) => s + r.done, 0);
  const totalItems = routines.reduce((s, r) => s + r.total, 0);

  return (
    <div className="space-y-4">
      <div className="bg-brand-50 border border-brand-100 rounded-2xl p-4 flex items-center justify-between">
        <div>
          <p className="text-sm text-brand-700">Today&apos;s habits</p>
          <p className="text-2xl font-bold text-brand-800">{totalDone}/{totalItems}</p>
        </div>
        <p className="text-sm text-brand-600">{formatDate(selectedDate)}</p>
      </div>

      {isLoading ? (
        <div className="animate-pulse h-48 bg-gray-200 rounded-2xl" />
      ) : (
        routines.map((routine) => {
          const Icon = routine.timeOfDay === 'MORNING' ? Sun : routine.timeOfDay === 'EVENING' ? Moon : Sparkles;
          const progress = routine.total > 0 ? Math.round((routine.done / routine.total) * 100) : 0;
          return (
            <section key={routine.id} className="bg-white rounded-2xl border shadow-sm overflow-hidden">
              <div className="p-4 border-b flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                  <Icon size={20} className="text-amber-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold">{routine.name}</h3>
                  <p className="text-xs text-gray-400">{routine.done} of {routine.total} done · {progress}%</p>
                </div>
                <button
                  type="button"
                  onClick={() => openEdit(routine)}
                  className="p-2 text-gray-400 hover:text-brand-600"
                  title="Edit steps"
                >
                  <Pencil size={16} />
                </button>
                {!routine.id.startsWith('routine-') && (
                  <button onClick={() => deleteRoutine.mutate(routine.id)} className="p-2 text-gray-400 hover:text-red-500">
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
              <div className="divide-y">
                {routine.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => toggleItem.mutate({ routineId: routine.id, itemId: item.id })}
                    className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 text-left"
                  >
                    {item.done ? (
                      <CheckCircle2 size={20} className="text-green-500 shrink-0" />
                    ) : (
                      <Circle size={20} className="text-gray-300 shrink-0" />
                    )}
                    <span className={cn('text-sm', item.done && 'line-through text-gray-400')}>{item.label}</span>
                  </button>
                ))}
              </div>
            </section>
          );
        })
      )}

      {sharedGroups.map((group) =>
        group.routines.map((routine) => {
          const Icon = routine.timeOfDay === 'MORNING' ? Sun : routine.timeOfDay === 'EVENING' ? Moon : Sparkles;
          const progress = routine.total > 0 ? Math.round((routine.done / routine.total) * 100) : 0;
          return (
            <section key={`${group.spaceId}-${routine.id}`} className="bg-violet-50 border border-violet-200 rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-violet-100 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center">
                  <Icon size={20} className="text-violet-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-violet-900">{routine.name}</h3>
                  <p className="text-xs text-violet-600">With {group.partnerName} · {progress}%</p>
                </div>
              </div>
              <div className="divide-y divide-violet-100 bg-white/60">
                {routine.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => toggleSharedItem.mutate({ spaceId: group.spaceId, routineId: routine.id, itemId: item.id })}
                    className="w-full flex items-center gap-3 p-4 hover:bg-violet-50 text-left"
                  >
                    {item.done ? (
                      <CheckCircle2 size={20} className="text-green-500 shrink-0" />
                    ) : (
                      <Circle size={20} className="text-violet-300 shrink-0" />
                    )}
                    <span className={cn('text-sm', item.done && 'line-through text-gray-400')}>{item.label}</span>
                  </button>
                ))}
              </div>
            </section>
          );
        }),
      )}

      <section className="bg-white rounded-2xl border shadow-sm p-4 space-y-3">
        <h3 className="font-semibold">Add custom routine</h3>
        <input
          value={newRoutineName}
          onChange={(e) => setNewRoutineName(e.target.value)}
          placeholder="Routine name (e.g. Weekend cleanup)"
          className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500"
        />
        <textarea
          value={newItemLabels}
          onChange={(e) => setNewItemLabels(e.target.value)}
          placeholder="One step per line..."
          rows={3}
          className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500"
        />
        <button
          onClick={() => newRoutineName.trim() && addRoutine.mutate()}
          disabled={!newRoutineName.trim() || addRoutine.isPending}
          className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
        >
          Add routine
        </button>
      </section>

      {editingRoutine && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <h2 className="text-lg font-semibold">Edit {editingRoutine.name}</h2>
                <p className="text-xs text-gray-500">Change steps or pick a preset</p>
              </div>
              <button type="button" onClick={closeEdit} className="p-2 text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-4 space-y-4">
              {routineTemplates.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Quick presets</p>
                  <div className="flex flex-wrap gap-2">
                    {routineTemplates.map((template) => (
                      <button
                        key={template.id}
                        type="button"
                        onClick={() => setEditItems(labelsToRoutineItems(template.items))}
                        className="px-3 py-1.5 text-sm bg-amber-50 border border-amber-200 text-amber-900 rounded-full hover:bg-amber-100"
                      >
                        {template.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <p className="text-sm font-medium mb-2">Steps</p>
                <div className="space-y-2">
                  {editItems.map((item, index) => (
                    <div key={item.id} className="flex gap-2">
                      <input
                        value={item.label}
                        onChange={(e) => {
                          const label = e.target.value;
                          setEditItems((prev) => prev.map((row, i) => (i === index ? { ...row, label } : row)));
                        }}
                        placeholder="Routine step"
                        className="flex-1 px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500"
                      />
                      <button
                        type="button"
                        onClick={() => setEditItems((prev) => prev.filter((_, i) => i !== index))}
                        className="p-2 text-gray-400 hover:text-red-500 shrink-0"
                        title="Remove step"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setEditItems((prev) => [...prev, { id: uid(), label: '' }])}
                  className="mt-2 flex items-center gap-1 text-sm text-brand-600 hover:text-brand-700 font-medium"
                >
                  <Plus size={14} /> Add step
                </button>
              </div>
              <button
                type="button"
                onClick={() => updateRoutine.mutate()}
                disabled={updateRoutine.isPending || editItems.every((item) => !item.label.trim())}
                className="w-full py-2.5 bg-brand-600 text-white font-semibold rounded-xl hover:bg-brand-700 disabled:opacity-50"
              >
                {updateRoutine.isPending ? 'Saving…' : 'Save routine'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RemindersTab() {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState(todayISO());
  const [repeat, setRepeat] = useState<Reminder['repeat']>('NONE');
  const [notes, setNotes] = useState('');
  const [shareScope, setShareScope] = useState<ShareScope>({ kind: 'personal', visibility: 'SHARED' });

  const { data: members = [] } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: () => api.get('/users'),
  });

  const { data: reminders = [], isLoading } = useQuery<Reminder[]>({
    queryKey: ['reminders'],
    queryFn: () => api.get('/reminders'),
  });

  const { data: upcoming = [] } = useQuery<UpcomingReminder[]>({
    queryKey: ['reminders-upcoming'],
    queryFn: () => api.get('/reminders/upcoming?days=30'),
  });

  const { data: sharedReminders } = useQuery<{
    groups: Array<{ spaceId: string; partnerName: string; reminders: Reminder[] }>;
  }>({
    queryKey: ['shared-reminders'],
    queryFn: () => api.get('/shared/reminders'),
  });

  const sharedGroups = sharedReminders?.groups ?? [];

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['reminders'] });
    queryClient.invalidateQueries({ queryKey: ['reminders-upcoming'] });
    queryClient.invalidateQueries({ queryKey: ['shared-reminders'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const saveReminder = useMutation({
    mutationFn: async () => {
      if (shareScope.kind === 'connection') {
        return api.post(`/shared/${shareScope.spaceId}/reminders`, {
          title: title.trim(),
          dueDate,
          repeat: 'NONE' as const,
          notes: notes || undefined,
        });
      }
      return api.post<Reminder>('/reminders', { title, dueDate, repeat, notes });
    },
    onSuccess: () => {
      setTitle('');
      setNotes('');
      invalidate();
      toast.success(shareScope.kind === 'connection' ? 'Shared reminder saved' : 'Reminder saved');
    },
  });

  const deleteReminder = useMutation({
    mutationFn: (id: string) => api.delete(`/reminders/${id}`),
    onSuccess: () => { invalidate(); toast.success('Reminder removed'); },
  });


  const deleteSharedReminder = useMutation({
    mutationFn: ({ spaceId, id }: { spaceId: string; id: string }) =>
      api.delete(`/shared/${spaceId}/reminders/${id}`),
    onSuccess: () => { invalidate(); toast.success('Shared reminder removed'); },
  });

  return (
    <div className="space-y-4">
      <section className="bg-white rounded-2xl border shadow-sm p-4 space-y-3">
        <h2 className="font-semibold flex items-center gap-2"><Bell size={18} className="text-brand-600" /> New reminder</h2>
        <ShareScopePicker
          feature="reminders"
          value={shareScope}
          onChange={setShareScope}
          membersCount={members.length}
        />
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Bill due, doctor visit, birthday..."
          className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500"
        />
        <div className="flex flex-wrap gap-2">
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="px-3 py-2 border rounded-lg text-sm" />
          <select value={repeat} onChange={(e) => setRepeat(e.target.value as Reminder['repeat'])} className="px-3 py-2 border rounded-lg text-sm">
            <option value="NONE">Once</option>
            <option value="MONTHLY">Every month</option>
            <option value="YEARLY">Every year</option>
          </select>
        </div>
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes (optional)"
          className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500"
        />
        <button
          onClick={() => title.trim() && saveReminder.mutate()}
          disabled={!title.trim() || saveReminder.isPending}
          className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
        >
          Save reminder
        </button>
      </section>

      {upcoming.length > 0 && (
        <section className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
          <h3 className="font-semibold text-amber-900 mb-3">Coming up (30 days)</h3>
          <div className="space-y-2">
            {upcoming.slice(0, 6).map((r) => (
              <div key={r.id} className="flex justify-between items-start text-sm">
                <div>
                  <p className="font-medium text-amber-900">{r.title}</p>
                  <p className="text-xs text-amber-700">
                    {formatDate(r.nextDate)}
                    {r.daysUntil === 0 ? ' · Today' : r.daysUntil === 1 ? ' · Tomorrow' : ` · in ${r.daysUntil} days`}
                    {' · '}{REPEAT_LABELS[r.repeat]}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="bg-white rounded-2xl border shadow-sm">
        <div className="p-4 border-b"><h3 className="font-semibold">All reminders</h3></div>
        {isLoading ? (
          <div className="animate-pulse h-24 m-4 bg-gray-100 rounded-xl" />
        ) : reminders.length === 0 ? (
          <p className="text-center text-gray-400 py-10 text-sm">No reminders yet</p>
        ) : (
          <div className="divide-y">
            {reminders.map((r) => (
              <div key={r.id} className="flex items-start gap-3 p-4 group">
                <Bell size={18} className="text-brand-500 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{r.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {formatDate(r.dueDate)} · {REPEAT_LABELS[r.repeat]}
                  </p>
                  {r.notes && <p className="text-sm text-gray-600 mt-1">{r.notes}</p>}
                </div>
                <button
                  onClick={() => deleteReminder.mutate(r.id)}
                  className="opacity-0 group-hover:opacity-100 p-2 text-gray-400 hover:text-red-500"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {sharedGroups.map((group) => (
          <section key={group.spaceId} className="bg-violet-50 border border-violet-200 rounded-2xl p-4 space-y-3">
            <h3 className="font-semibold text-violet-900">Shared reminders with {group.partnerName}</h3>
            {group.reminders.length === 0 ? (
              <p className="text-sm text-violet-600/70">No shared reminders yet.</p>
            ) : (
              <div className="bg-white rounded-xl border divide-y">
                {group.reminders.map((r) => (
                  <div key={r.id} className="flex items-start gap-3 p-3 group">
                    <Bell size={16} className="text-violet-500 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{r.title}</p>
                      <p className="text-xs text-gray-400">{formatDate(r.dueDate)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => deleteSharedReminder.mutate({ spaceId: group.spaceId, id: r.id })}
                      className="opacity-0 group-hover:opacity-100 p-2 text-gray-400 hover:text-red-500"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
      ))}
    </div>
  );
}

export function DailyLifePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedDate = useDateStore((s) => s.selectedDate);
  const tabParam = searchParams.get('tab');
  const tab = (tabParam || defaultDailyTab(getDayPhase())) as Tab;

  const { data: routinesData } = useQuery<{ date: string; routines: RoutineToday[] }>({
    queryKey: ['routines-today', selectedDate],
    queryFn: () => api.get(`/routines/today?date=${selectedDate}`),
  });
  const routines = routinesData?.routines ?? [];
  const routineDone = routines.reduce((s, r) => s + r.done, 0);
  const routineTotal = routines.reduce((s, r) => s + r.total, 0);

  const { data: shoppingData } = useQuery<{ data: ShoppingItem[] }>({
    queryKey: ['shopping'],
    queryFn: () => api.get('/shopping'),
  });
  const shoppingPending = shoppingData?.data.filter((i) => !i.checked).length ?? 0;

  const setTab = (next: Tab) => {
    setSearchParams({ tab: next });
  };

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-3xl mx-auto">
      <PageHeader
        theme="life"
        icon={Sun}
        title="Daily lists & habits"
        subtitle="Shopping · morning & evening routines · important dates"
        hint="Everything here supports your Today page — check habits on Today without opening this page"
      />

      <DailyFlowStrip
        activeTab={tab}
        onTabChange={setTab}
        routineDone={routineDone}
        routineTotal={routineTotal}
        shoppingPending={shoppingPending}
      />

      {tab === 'shopping' && <ShoppingTab />}
      {tab === 'routines' && <RoutinesTab />}
      {tab === 'reminders' && <RemindersTab />}
    </div>
  );
}
