import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, Expense, ExpenseCategory, User } from '../../lib/api';
import { todayISO } from '../../lib/format';
import { toast } from '../../components/Toaster';
import { X } from 'lucide-react';

interface Props {
  expense?: Expense | null;
  members: User[];
  defaultDate?: string;
  onClose: () => void;
}

export function ExpenseFormModal({ expense, members, defaultDate, onClose }: Props) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState(expense?.amount || '');
  const [description, setDescription] = useState(expense?.description || '');
  const [categoryId, setCategoryId] = useState(expense?.category.id || '');
  const [expenseDate, setExpenseDate] = useState(expense?.expenseDate?.slice(0, 10) || defaultDate || todayISO());
  const [paidById, setPaidById] = useState(expense?.paidBy.id || members[0]?.id || '');
  const [loading, setLoading] = useState(false);

  const { data: categories = [] } = useQuery<ExpenseCategory[]>({
    queryKey: ['expense-categories'],
    queryFn: () => api.get('/expenses/categories'),
  });

  React.useEffect(() => {
    if (!categoryId && categories.length > 0) setCategoryId(categories[0].id);
  }, [categories, categoryId]);

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        amount: parseFloat(amount),
        description: description || undefined,
        categoryId,
        expenseDate,
        paidById,
      };
      if (expense) return api.put<Expense>(`/expenses/${expense.id}`, body);
      return api.post<Expense>('/expenses', body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success(expense ? 'Expense updated' : 'Expense logged');
      onClose();
    },
    onError: (err: any) => toast.error(err.message || 'Failed to save'),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) return;
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
      <div className="relative bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-xl z-10">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">{expense ? 'Edit expense' : 'Log expense'}</h2>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
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
          <div>
            <label className="block text-sm font-medium mb-1">Paid by</label>
            <select value={paidById} onChange={(e) => setPaidById(e.target.value)} className="w-full px-3 py-2 border rounded-lg">
              {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <button type="submit" disabled={loading}
            className="w-full py-2.5 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 font-medium">
            {loading ? 'Saving...' : expense ? 'Save changes' : 'Log expense'}
          </button>
        </form>
      </div>
    </div>
  );
}
