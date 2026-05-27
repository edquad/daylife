import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, Connection, Expense, ExpenseCategory, SplitMode, User } from '../../lib/api';
import { todayISO, formatMoney } from '../../lib/format';
import { toast } from '../../components/Toaster';
import { X } from 'lucide-react';
import { ShareScopePicker } from '../../components/ShareScopePicker';
import { defaultVisibility } from '../../lib/privacy';
import type { ShareScope } from '../../lib/shareScope';
import { activeShareConnections, connectionLabel, findConnectionBySpaceId } from '../../lib/shareScope';
import { useGitHubSync } from '../sync/GitHubSyncContext';

interface Props {
  expense?: Expense | null;
  members: User[];
  splitEnabled?: boolean;
  defaultDate?: string;
  defaultShareScope?: ShareScope;
  onClose: () => void;
}

export function ExpenseFormModal({
  expense,
  members,
  splitEnabled = false,
  defaultDate,
  defaultShareScope,
  onClose,
}: Props) {
  const queryClient = useQueryClient();
  const { cloudReady } = useGitHubSync();
  const [amount, setAmount] = useState(expense?.amount || '');
  const [description, setDescription] = useState(expense?.description || '');
  const [categoryId, setCategoryId] = useState(expense?.category.id || '');
  const [expenseDate, setExpenseDate] = useState(expense?.expenseDate?.slice(0, 10) || defaultDate || todayISO());
  const [paidById, setPaidById] = useState(expense?.paidBy.id || members[0]?.id || '');
  const [shareScope, setShareScope] = useState<ShareScope>(
    defaultShareScope || { kind: 'personal', visibility: defaultVisibility(members.length) },
  );
  const [isShared, setIsShared] = useState(expense?.isShared ?? false);
  const [splitMode, setSplitMode] = useState<SplitMode>(expense?.splitMode || 'EQUAL');
  const [participantIds, setParticipantIds] = useState<string[]>(
    expense?.participantIds?.length ? expense.participantIds : members.map((m) => m.id),
  );
  const [exactShares, setExactShares] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    members.forEach((m) => {
      initial[m.id] = expense?.shares?.find((s) => s.userId === m.id)?.amount || '';
    });
    return initial;
  });
  const [loading, setLoading] = useState(false);

  const { data: categories = [] } = useQuery<ExpenseCategory[]>({
    queryKey: ['expense-categories'],
    queryFn: () => api.get('/expenses/categories'),
  });

  const { data: connections = [] } = useQuery<Connection[]>({
    queryKey: ['connections'],
    queryFn: () => api.get('/connections'),
    enabled: cloudReady,
  });

  React.useEffect(() => {
    if (!categoryId && categories.length > 0) setCategoryId(categories[0].id);
  }, [categories, categoryId]);

  const equalSharePreview = useMemo(() => {
    const total = parseFloat(amount);
    if (!isShared || !total || participantIds.length === 0) return null;
    return (total / participantIds.length).toFixed(2);
  }, [amount, isShared, participantIds.length]);

  const toggleParticipant = (id: string) => {
    setParticipantIds((prev) => {
      if (prev.includes(id)) {
        if (prev.length <= 2) return prev;
        return prev.filter((pid) => pid !== id);
      }
      return [...prev, id];
    });
  };

  const isConnectionShare = !expense && shareScope.kind === 'connection';

  const save = useMutation({
    mutationFn: async () => {
      if (isConnectionShare) {
        return api.post<Expense>(`/shared/${shareScope.spaceId}/expenses`, {
          amount: parseFloat(amount),
          description: description || undefined,
          categoryId,
          expenseDate,
        });
      }

      const body: Record<string, unknown> = {
        amount: parseFloat(amount),
        description: description || undefined,
        categoryId,
        expenseDate,
        paidById,
        visibility:
          shareScope.kind === 'personal' && members.length > 1
            ? shareScope.visibility
            : 'SHARED',
        isShared: splitEnabled ? isShared : false,
      };

      if (splitEnabled && isShared) {
        body.splitMode = splitMode;
        body.participantIds = participantIds;
        if (splitMode === 'EXACT') {
          body.shares = Object.fromEntries(participantIds.map((id) => [id, exactShares[id] || '0']));
        }
      }

      if (expense) return api.put<Expense>(`/expenses/${expense.id}`, body);
      return api.post<Expense>('/expenses', body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['splits'] });
      queryClient.invalidateQueries({ queryKey: ['shared-expenses'] });
      queryClient.invalidateQueries({ queryKey: ['shared-summary'] });
      if (isConnectionShare) {
        const conn = findConnectionBySpaceId(connections, shareScope.spaceId);
        toast.success(conn ? `Shared with ${connectionLabel(conn)}` : 'Shared expense logged');
      } else {
        toast.success(expense ? 'Expense updated' : 'Expense logged');
      }
      onClose();
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to save'),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) return;
    if (isConnectionShare) {
      const allowed = activeShareConnections(connections, 'expenses');
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

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-xl z-10 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">{expense ? 'Edit expense' : 'Log expense'}</h2>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {!expense && (
            <ShareScopePicker
              feature="expenses"
              value={shareScope}
              onChange={setShareScope}
              membersCount={members.length}
            />
          )}
          <div>
            <label className="block text-sm font-medium mb-1">Amount ($)</label>
            <input type="number" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required
              className="w-full px-3 py-2 border rounded-lg text-lg font-semibold outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What was it for?"
              className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Category</label>
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required className="w-full px-3 py-2 border rounded-lg">
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Date</label>
              <input type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg" />
            </div>
          </div>
          {!isConnectionShare && (
            <div>
              <label className="block text-sm font-medium mb-1">Paid by</label>
              <select value={paidById} onChange={(e) => setPaidById(e.target.value)} className="w-full px-3 py-2 border rounded-lg">
                {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
          )}
          {splitEnabled && !isConnectionShare && (
            <div className="rounded-xl border border-violet-100 bg-violet-50/60 p-4 space-y-3">
              <label className="flex items-center gap-2 text-sm font-medium text-violet-900">
                <input
                  type="checkbox"
                  checked={isShared}
                  onChange={(e) => setIsShared(e.target.checked)}
                  className="rounded border-violet-300 text-brand-600"
                />
                Split between household members
              </label>
              {isShared && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-2">Split with</label>
                    <div className="flex flex-wrap gap-2">
                      {members.map((m) => {
                        const active = participantIds.includes(m.id);
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => toggleParticipant(m.id)}
                            className={`px-3 py-1.5 rounded-full text-sm border ${active ? 'bg-white border-violet-300 text-violet-900' : 'bg-transparent border-gray-200 text-gray-400'}`}
                          >
                            {m.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Split type</label>
                    <select value={splitMode} onChange={(e) => setSplitMode(e.target.value as SplitMode)} className="w-full px-3 py-2 border rounded-lg bg-white">
                      <option value="EQUAL">Split equally</option>
                      <option value="EXACT">Custom amounts</option>
                    </select>
                  </div>
                  {splitMode === 'EQUAL' && equalSharePreview && (
                    <p className="text-sm text-violet-800">
                      Each person owes <strong>{formatMoney(equalSharePreview)}</strong>
                    </p>
                  )}
                  {splitMode === 'EXACT' && (
                    <div className="space-y-2">
                      {participantIds.map((id) => {
                        const member = members.find((m) => m.id === id);
                        if (!member) return null;
                        return (
                          <div key={id} className="flex items-center gap-2">
                            <span className="text-sm w-24 truncate">{member.name}</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={exactShares[id] || ''}
                              onChange={(e) => setExactShares((prev) => ({ ...prev, [id]: e.target.value }))}
                              className="flex-1 px-3 py-2 border rounded-lg bg-white"
                              placeholder="0.00"
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
          <button type="submit" disabled={loading}
            className={`w-full py-2.5 text-white rounded-lg disabled:opacity-50 font-medium ${
              isConnectionShare ? 'bg-violet-600 hover:bg-violet-700' : 'bg-brand-600 hover:bg-brand-700'
            }`}>
            {loading ? 'Saving...' : expense ? 'Save changes' : isConnectionShare ? 'Log shared expense' : 'Log expense'}
          </button>
        </form>
      </div>
    </div>
  );
}
