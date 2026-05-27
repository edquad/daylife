import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, Connection, Expense, User } from '../../lib/api';
import { formatMoney, formatDate, formatDayHeading } from '../../lib/format';
import { useDateStore } from '../../lib/dateStore';
import { Plus, Search, Trash2, HandCoins, Users } from 'lucide-react';
import { supportsExpenseSplits } from '../../lib/household';
import { ExpenseFormModal } from './ExpenseFormModal';
import { toast } from '../../components/Toaster';
import { useGitHubSync } from '../sync/GitHubSyncContext';

interface ExpensesResponse {
  data: Expense[];
  total: number;
}

export function ExpensesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { cloudReady } = useGitHubSync();
  const selectedDate = useDateStore((s) => s.selectedDate);
  const dateParam = searchParams.get('date');
  const viewDate = dateParam || selectedDate;
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editExpense, setEditExpense] = useState<Expense | null>(null);

  useEffect(() => {
    if (searchParams.get('add') === 'true') {
      setModalOpen(true);
      const next = new URLSearchParams(searchParams);
      next.delete('add');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const params = new URLSearchParams();
  params.set('date', viewDate);
  if (search) params.set('search', search);
  params.set('limit', '100');

  const { data, isLoading } = useQuery<ExpensesResponse>({
    queryKey: ['expenses', viewDate, search],
    queryFn: () => api.get(`/expenses?${params}`),
  });

  const { data: sharedExpenses, isFetching: sharedLoading } = useQuery<{
    groups: Array<{ spaceId: string; partnerName: string; expenses: Expense[]; total: string }>;
  }>({
    queryKey: ['shared-expenses', viewDate],
    queryFn: () => api.get(`/shared/expenses?date=${viewDate}`),
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  const { data: connections = [] } = useQuery<Connection[]>({
    queryKey: ['connections'],
    queryFn: () => api.get('/connections'),
    enabled: cloudReady,
  });

  const expenseShareConnections = connections.filter(
    (c) => c.features.includes('expenses') && (c.status === 'active' || c.status === 'pending_sent'),
  );
  const pendingExpenseShare = connections.find(
    (c) => c.features.includes('expenses') && c.status === 'pending_sent' && c.initiatedByMe,
  );

  const sharedGroups = sharedExpenses?.groups ?? [];

  const { data: members = [] } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: () => api.get('/users'),
  });

  const deleteExpense = useMutation({
    mutationFn: (id: string) => api.delete(`/expenses/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Expense deleted');
    },
  });

  const deleteSharedExpense = useMutation({
    mutationFn: ({ spaceId, id }: { spaceId: string; id: string }) =>
      api.delete(`/shared/${spaceId}/expenses/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shared-expenses'] });
      queryClient.invalidateQueries({ queryKey: ['shared-summary'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Shared expense deleted');
    },
  });

  const expenses = data?.data ?? [];
  const total = expenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);
  const sharedTotal = sharedGroups.reduce((sum, g) => sum + parseFloat(g.total), 0);

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Expenses</h1>
          <p className="text-gray-500 text-sm">{formatDayHeading(viewDate)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {supportsExpenseSplits(members.length) && (
            <Link
              to="/splits"
              className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50 text-sm font-medium"
            >
              <HandCoins size={16} /> Split money
            </Link>
          )}
          <Link
            to={`/reports?period=daily&date=${viewDate}`}
            className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50 text-sm font-medium"
          >
            View reports
          </Link>
          <button
          onClick={() => { setEditExpense(null); setModalOpen(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 text-sm font-medium"
        >
          <Plus size={16} /> Log expense
        </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..."
            className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500" />
        </div>
        <input type="date" value={viewDate} onChange={(e) => {
          const next = new URLSearchParams(searchParams);
          next.set('date', e.target.value);
          setSearchParams(next);
        }}
          className="border rounded-lg px-3 py-2 text-sm" />
      </div>

      <div className="bg-brand-50 border border-brand-100 rounded-2xl p-4 flex items-center justify-between">
        <span className="text-sm text-brand-700 font-medium">
          {expenseShareConnections.length > 0 ? 'Your personal total' : 'Day total (yours)'}
        </span>
        <span className="text-xl font-bold tabular-nums text-brand-800">{formatMoney(total)}</span>
      </div>

      {pendingExpenseShare && (
        <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-900">
          <Users size={16} className="shrink-0 mt-0.5" />
          <p>
            Waiting for <strong>@{pendingExpenseShare.partnerUsername}</strong> to accept your share invite.
            Shared expenses appear here after they accept.
          </p>
        </div>
      )}

      {sharedGroups.length > 0 && (
        <div className="px-4 py-3 rounded-xl bg-violet-100/80 border border-violet-200 text-sm text-violet-900">
          <p className="font-medium">Shared expenses with your connections</p>
          <p className="text-violet-700 mt-1">Use Log expense and pick Share to add new shared spending.</p>
        </div>
      )}

      {sharedGroups.length > 0 && (
        <div className="space-y-4">
          {sharedGroups.map((group) => (
              <section key={group.spaceId} className="bg-violet-50 border border-violet-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-semibold text-violet-900">Shared with {group.partnerName}</h2>
                  <span className="text-sm font-bold tabular-nums text-violet-800">{formatMoney(group.total)}</span>
                </div>
                {group.expenses.length === 0 ? (
                  <p className="text-sm text-violet-600/70">No shared expenses on this day yet.</p>
                ) : (
                  <div className="bg-white rounded-xl border divide-y">
                    {group.expenses.map((exp) => (
                      <div key={exp.id} className="flex items-center justify-between p-3 group">
                        <div>
                          <p className="text-sm font-medium">{exp.description || exp.category.name}</p>
                          <p className="text-xs text-gray-400">{exp.paidBy.name}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold tabular-nums text-sm">{formatMoney(exp.amount)}</span>
                          <button
                            type="button"
                            onClick={() => deleteSharedExpense.mutate({ spaceId: group.spaceId, id: exp.id })}
                            className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
          ))}
          {sharedTotal > 0 && (
            <p className="text-xs text-violet-700 text-right">
              Shared day total: {formatMoney(sharedTotal.toFixed(2))}
            </p>
          )}
        </div>
      )}

      {expenseShareConnections.some((c) => c.status === 'active') && sharedGroups.length === 0 && !pendingExpenseShare && sharedLoading && (
        <div className="text-center py-6 text-violet-600 text-sm">
          Loading shared expenses… If this stays empty, open Share and tap Refresh from cloud.
        </div>
      )}

      {isLoading ? (
        <div className="animate-pulse space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-14 bg-gray-200 rounded-xl" />)}</div>
      ) : expenses.length === 0 && sharedGroups.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p>No expenses on this day</p>
          {expenseShareConnections.some((c) => c.status === 'active') && (
            <p className="text-sm mt-2 text-violet-600">Tap Log expense and choose Share to add partner spending</p>
          )}
        </div>
      ) : expenses.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-4">No personal expenses on this day</p>
      ) : (
        <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left p-3 font-medium text-gray-500">Date</th>
                <th className="text-left p-3 font-medium text-gray-500 hidden sm:table-cell">Description</th>
                <th className="text-left p-3 font-medium text-gray-500">Category</th>
                <th className="text-left p-3 font-medium text-gray-500 hidden md:table-cell">Paid by</th>
                <th className="text-right p-3 font-medium text-gray-500">Amount</th>
                <th className="p-3 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {expenses.map((exp) => (
                <tr key={exp.id} className="hover:bg-gray-50 group cursor-pointer" onClick={() => { setEditExpense(exp); setModalOpen(true); }}>
                  <td className="p-3 whitespace-nowrap">{formatDate(exp.expenseDate)}</td>
                  <td className="p-3 hidden sm:table-cell text-gray-600">{exp.description || '—'}</td>
                  <td className="p-3">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: exp.category.color }} />
                      {exp.category.name}
                    </span>
                  </td>
                  <td className="p-3 hidden md:table-cell">
                    <span className="text-xs px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: exp.paidBy.color }}>
                      {exp.paidBy.name}
                    </span>
                    {exp.isShared && (
                      <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded bg-violet-100 text-violet-700">split</span>
                    )}
                  </td>
                  <td className="p-3 text-right font-semibold tabular-nums">{formatMoney(exp.amount)}</td>
                  <td className="p-3">
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteExpense.mutate(exp.id); }}
                      className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <ExpenseFormModal
          expense={editExpense}
          members={members}
          splitEnabled={supportsExpenseSplits(members.length)}
          defaultDate={viewDate}
          onClose={() => { setModalOpen(false); setEditExpense(null); }}
        />
      )}
    </div>
  );
}
