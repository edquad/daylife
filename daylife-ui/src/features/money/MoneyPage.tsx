import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, Expense, User, SplitBalancesResponse, Connection } from '../../lib/api';
import { formatMoney, todayISO } from '../../lib/format';
import { useDateStore } from '../../lib/dateStore';
import { useGitHubSync } from '../sync/GitHubSyncContext';
import { ExpenseFormModal } from '../expenses/ExpenseFormModal';
import { toast } from '../../components/Toaster';
import { Plus, Trash2, HandCoins } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ExpensesResponse {
  data: Expense[];
  total: number;
}

export function MoneyPage() {
  const queryClient = useQueryClient();
  const { cloudReady } = useGitHubSync();
  const selectedDate = useDateStore((s) => s.selectedDate);
  const [modalOpen, setModalOpen] = useState(false);
  const [editExpense, setEditExpense] = useState<Expense | null>(null);
  const [tab, setTab] = useState<'today' | 'month' | 'splits'>('today');

  const { data: members = [] } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: () => api.get('/users'),
  });

  const { data: todayData, isLoading } = useQuery<ExpensesResponse>({
    queryKey: ['expenses', selectedDate],
    queryFn: () => api.get(`/expenses?date=${selectedDate}&limit=100`),
  });

  const monthKey = selectedDate.slice(0, 7);
  const { data: monthData } = useQuery<{
    categories: Array<{ categoryId: string; name: string; color: string; total: number }>;
    total: number;
  }>({
    queryKey: ['expense-report', monthKey],
    queryFn: () => api.get(`/expenses/report?period=monthly&date=${selectedDate}`),
  });

  const { data: sharedExpenses } = useQuery<{
    groups: Array<{ spaceId: string; partnerName: string; expenses: Expense[]; total: string }>;
  }>({
    queryKey: ['shared-expenses', selectedDate],
    queryFn: () => api.get(`/shared/expenses?date=${selectedDate}`),
  });

  const { data: splits } = useQuery<SplitBalancesResponse>({
    queryKey: ['splits', 'balances'],
    queryFn: () => api.get('/splits/balances'),
  });

  const { data: sharedSplits } = useQuery<{
    groups: Array<SplitBalancesResponse & { spaceId: string; partnerName: string }>;
  }>({
    queryKey: ['shared-splits'],
    queryFn: () => api.get('/shared/splits/balances'),
  });

  const deleteExpense = useMutation({
    mutationFn: (id: string) => api.delete(`/expenses/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['expense-report'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Expense deleted');
    },
  });

  const todayExpenses = todayData?.data ?? [];
  const todayTotal = todayData?.total ?? 0;
  const sharedGroups = sharedExpenses?.groups ?? [];
  const sharedSplitGroups = sharedSplits?.groups ?? [];
  const allDebts = splits?.debts ?? [];

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      {/* Header with quick-add */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Money</h1>
        <button
          type="button"
          onClick={() => { setEditExpense(null); setModalOpen(true); }}
          className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-medium"
        >
          <Plus size={16} /> Log expense
        </button>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {([
          { key: 'today', label: 'Today' },
          { key: 'month', label: 'This month' },
          { key: 'splits', label: 'Splits' },
        ] as const).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              'flex-1 py-2 rounded-lg text-sm font-medium transition-colors',
              tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Today tab */}
      {tab === 'today' && (
        <>
          <div className="bg-gradient-to-br from-orange-500 to-amber-500 rounded-2xl p-5 text-white">
            <p className="text-sm text-white/80">Spent today</p>
            <p className="text-3xl font-bold tabular-nums mt-1">{formatMoney(todayTotal)}</p>
          </div>

          {todayExpenses.length === 0 && sharedGroups.every((g) => g.expenses.length === 0) ? (
            <p className="text-center text-sm text-gray-400 py-6">No expenses logged today</p>
          ) : (
            <div className="space-y-2">
              {todayExpenses.map((exp) => (
                <div key={exp.id} className="flex items-center gap-3 py-2.5 px-3 bg-white rounded-xl border group">
                  <div
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: exp.category?.color || '#6B7280' }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{exp.description || exp.category?.name}</p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums shrink-0">{formatMoney(exp.amount)}</span>
                  <button
                    type="button"
                    onClick={() => { setEditExpense(exp); setModalOpen(true); }}
                    className="text-xs text-gray-400 hover:text-brand-600 shrink-0"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteExpense.mutate(exp.id)}
                    className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 shrink-0"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              {sharedGroups.map((group) =>
                group.expenses.map((exp) => (
                  <div key={exp.id} className="flex items-center gap-3 py-2.5 px-3 bg-violet-50 rounded-xl border border-violet-200">
                    <div className="w-3 h-3 rounded-full bg-violet-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate text-violet-900">{exp.description || 'Shared'}</p>
                      <p className="text-[10px] text-violet-600">with {group.partnerName}</p>
                    </div>
                    <span className="text-sm font-semibold tabular-nums text-violet-900 shrink-0">{formatMoney(exp.amount)}</span>
                  </div>
                )),
              )}
            </div>
          )}
        </>
      )}

      {/* Month tab */}
      {tab === 'month' && (
        <>
          <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl p-5 text-white">
            <p className="text-sm text-white/80">{monthKey} total</p>
            <p className="text-3xl font-bold tabular-nums mt-1">{formatMoney(monthData?.total ?? 0)}</p>
          </div>

          {(monthData?.categories ?? []).length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-6">No expenses this month</p>
          ) : (
            <div className="space-y-2">
              {(monthData?.categories ?? [])
                .sort((a, b) => b.total - a.total)
                .map((cat) => (
                  <div key={cat.categoryId} className="flex items-center gap-3 py-2.5 px-3 bg-white rounded-xl border">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                    <span className="text-sm font-medium flex-1">{cat.name}</span>
                    <span className="text-sm font-semibold tabular-nums">{formatMoney(cat.total)}</span>
                  </div>
                ))}
            </div>
          )}
        </>
      )}

      {/* Splits tab */}
      {tab === 'splits' && (
        <>
          {allDebts.length === 0 && sharedSplitGroups.every((g) => (g.debts ?? []).length === 0) ? (
            <p className="text-center text-sm text-gray-400 py-6">
              No split expenses yet. Log an expense with a split to see balances here.
            </p>
          ) : (
            <div className="space-y-3">
              {allDebts.map((debt, i) => (
                <div key={i} className="flex items-center gap-3 py-3 px-4 bg-white rounded-xl border">
                  <HandCoins size={18} className="text-amber-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{debt.fromName} owes {debt.toName}</p>
                  </div>
                  <span className="text-sm font-bold tabular-nums text-amber-700">{formatMoney(debt.amount)}</span>
                </div>
              ))}
              {sharedSplitGroups.map((group) =>
                (group.debts ?? []).map((debt, i) => (
                  <div key={`${group.spaceId}-${i}`} className="flex items-center gap-3 py-3 px-4 bg-violet-50 rounded-xl border border-violet-200">
                    <HandCoins size={18} className="text-violet-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-violet-900">{debt.fromName} owes {debt.toName}</p>
                      <p className="text-[10px] text-violet-600">with {group.partnerName}</p>
                    </div>
                    <span className="text-sm font-bold tabular-nums text-violet-700">{formatMoney(debt.amount)}</span>
                  </div>
                )),
              )}
            </div>
          )}
        </>
      )}

      {modalOpen && (
        <ExpenseFormModal
          members={members}
          expense={editExpense}
          onClose={() => { setModalOpen(false); setEditExpense(null); }}
        />
      )}
    </div>
  );
}
