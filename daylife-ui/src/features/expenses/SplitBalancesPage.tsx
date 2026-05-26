import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, SplitBalancesResponse, User } from '../../lib/api';
import { formatMoney, todayISO } from '../../lib/format';
import { toast } from '../../components/Toaster';
import { ArrowRight, HandCoins, Plus, Trash2, Users } from 'lucide-react';

export function SplitBalancesPage() {
  const queryClient = useQueryClient();
  const [fromUserId, setFromUserId] = useState('');
  const [toUserId, setToUserId] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  const { data: members = [] } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: () => api.get('/users'),
  });

  const { data, isLoading } = useQuery<SplitBalancesResponse>({
    queryKey: ['splits', 'balances'],
    queryFn: () => api.get('/splits/balances'),
  });

  const { data: sharedSplits } = useQuery<{
    groups: Array<
      SplitBalancesResponse & {
        spaceId: string;
        partnerName: string;
        memberUserIds?: [string, string];
      }
    >;
  }>({
    queryKey: ['shared-splits'],
    queryFn: () => api.get('/shared/splits/balances'),
  });

  const sharedGroups = sharedSplits?.groups ?? [];

  const settle = useMutation({
    mutationFn: () =>
      api.post('/splits/settlements', {
        fromUserId,
        toUserId,
        amount: parseFloat(amount),
        note: note || undefined,
        settledAt: todayISO(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['splits'] });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setAmount('');
      setNote('');
      toast.success('Settlement recorded');
    },
    onError: (err: any) => toast.error(err.message || 'Failed to record settlement'),
  });

  const removeSettlement = useMutation({
    mutationFn: (id: string) => api.delete(`/splits/settlements/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['splits'] });
      toast.success('Settlement removed');
    },
  });

  const settleShared = useMutation({
    mutationFn: ({
      spaceId,
      fromUserId,
      toUserId,
      settleAmount,
      settleNote,
    }: {
      spaceId: string;
      fromUserId: string;
      toUserId: string;
      settleAmount: string;
      settleNote: string;
    }) =>
      api.post(`/shared/${spaceId}/splits/settlements`, {
        fromUserId,
        toUserId,
        amount: parseFloat(settleAmount),
        note: settleNote || undefined,
        settledAt: todayISO(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shared-splits'] });
      queryClient.invalidateQueries({ queryKey: ['shared-expenses'] });
      toast.success('Shared settlement recorded');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const removeSharedSettlement = useMutation({
    mutationFn: ({ spaceId, id }: { spaceId: string; id: string }) =>
      api.delete(`/shared/${spaceId}/splits/settlements/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shared-splits'] });
      toast.success('Settlement removed');
    },
  });

  const quickSettle = (debt: SplitBalancesResponse['debts'][0]) => {
    setFromUserId(debt.fromUserId);
    setToUserId(debt.toUserId);
    setAmount(debt.amount);
  };

  const balances = data?.balances ?? [];
  const debts = data?.debts ?? [];
  const settlements = data?.settlements ?? [];

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-3xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <HandCoins size={24} className="text-brand-600" /> Split money
          </h1>
          <p className="text-gray-500 text-sm">Who paid, who owes, settle up together</p>
        </div>
        <Link
          to="/expenses?add=true"
          className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 text-sm font-medium"
        >
          <Plus size={16} /> Shared expense
        </Link>
      </div>

      {sharedGroups.length === 0 && members.length < 2 && (
        <div className="bg-violet-50 border border-violet-200 rounded-2xl p-4 text-sm">
          <p className="font-medium text-violet-900 mb-1">Want to split money with someone?</p>
          <p className="text-violet-700">
            Open <Link to="/share" className="underline font-medium">Share</Link>, invite their username, and check{' '}
            <strong>Money split</strong> under Money. Then log shared expenses on Expenses.
          </p>
        </div>
      )}

      {sharedGroups.map((group) => (
        <section key={group.spaceId} className="bg-violet-50 border border-violet-200 rounded-2xl p-5 space-y-4">
          <h2 className="font-semibold text-violet-900">Split with {group.partnerName}</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {group.balances.map((row) => {
              const value = parseFloat(row.balance);
              const positive = value > 0.005;
              const negative = value < -0.005;
              return (
                <div key={row.userId} className="rounded-xl border bg-white p-4">
                  <p className="font-medium">{row.name}</p>
                  <p className={`text-sm ${positive ? 'text-green-700' : negative ? 'text-red-600' : 'text-gray-500'}`}>
                    {positive && `Gets back ${formatMoney(row.balance)}`}
                    {negative && `Owes ${formatMoney(Math.abs(value).toFixed(2))}`}
                    {!positive && !negative && 'All settled'}
                  </p>
                </div>
              );
            })}
          </div>
          {group.debts.length > 0 && (
            <div className="space-y-2">
              {group.debts.map((debt) => (
                <div key={`${debt.fromUserId}-${debt.toUserId}`} className="flex items-center justify-between bg-white rounded-xl border p-3 text-sm">
                  <span>{debt.fromName} → {debt.toName}: <strong>{formatMoney(debt.amount)}</strong></span>
                  <button
                    type="button"
                    onClick={() =>
                      settleShared.mutate({
                        spaceId: group.spaceId,
                        fromUserId: debt.fromUserId,
                        toUserId: debt.toUserId,
                        settleAmount: debt.amount,
                        settleNote: '',
                      })
                    }
                    className="text-xs px-3 py-1.5 bg-violet-600 text-white rounded-lg"
                  >
                    Mark settled
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      ))}

      {isLoading ? (
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-gray-200 rounded-2xl" />
          ))}
        </div>
      ) : (
        <>
          <section className="bg-white rounded-2xl border shadow-sm p-5 space-y-4">
            <h2 className="font-semibold flex items-center gap-2">
              <Users size={18} className="text-brand-600" /> Balances
            </h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {balances.map((row) => {
                const value = parseFloat(row.balance);
                const positive = value > 0.005;
                const negative = value < -0.005;
                return (
                  <div key={row.userId} className="rounded-xl border p-4 bg-gray-50">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-full text-white flex items-center justify-center font-semibold"
                        style={{ backgroundColor: row.color }}
                      >
                        {row.name[0]}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{row.name}</p>
                        <p className={`text-sm ${positive ? 'text-green-700' : negative ? 'text-red-600' : 'text-gray-500'}`}>
                          {positive && `Gets back ${formatMoney(row.balance)}`}
                          {negative && `Owes ${formatMoney(Math.abs(value).toFixed(2))}`}
                          {!positive && !negative && 'All settled'}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="bg-white rounded-2xl border shadow-sm p-5 space-y-4">
            <h2 className="font-semibold">Who pays who</h2>
            {debts.length === 0 ? (
              <p className="text-sm text-gray-500">Everyone is even — no payments needed.</p>
            ) : (
              <div className="space-y-3">
                {debts.map((debt, index) => (
                  <div key={`${debt.fromUserId}-${debt.toUserId}-${index}`} className="flex flex-wrap items-center gap-3 p-4 rounded-xl border bg-violet-50 border-violet-100">
                    <span className="text-sm font-medium px-2 py-1 rounded-full text-white" style={{ backgroundColor: debt.fromColor }}>
                      {debt.fromName}
                    </span>
                    <ArrowRight size={16} className="text-violet-500" />
                    <span className="text-sm font-medium px-2 py-1 rounded-full text-white" style={{ backgroundColor: debt.toColor }}>
                      {debt.toName}
                    </span>
                    <span className="ml-auto font-bold tabular-nums text-violet-900">{formatMoney(debt.amount)}</span>
                    <button
                      type="button"
                      onClick={() => quickSettle(debt)}
                      className="text-sm px-3 py-1.5 rounded-lg border border-violet-200 text-violet-800 hover:bg-white"
                    >
                      Settle
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="bg-white rounded-2xl border shadow-sm p-5 space-y-4">
            <h2 className="font-semibold">Record payment</h2>
            <p className="text-sm text-gray-500">When someone pays back cash, UPI, or bank transfer.</p>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Who paid</label>
                <select value={fromUserId} onChange={(e) => setFromUserId(e.target.value)} className="w-full px-3 py-2 border rounded-lg">
                  <option value="">Select person</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">To whom</label>
                <select value={toUserId} onChange={(e) => setToUserId(e.target.value)} className="w-full px-3 py-2 border rounded-lg">
                  <option value="">Select person</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Amount</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Note (optional)</label>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="UPI, cash…"
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
            </div>
            <button
              type="button"
              disabled={!fromUserId || !toUserId || !amount || settle.isPending}
              onClick={() => settle.mutate()}
              className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
            >
              Record settlement
            </button>
          </section>

          {settlements.length > 0 && (
            <section className="bg-white rounded-2xl border shadow-sm p-5 space-y-3">
              <h2 className="font-semibold">Settlement history</h2>
              <div className="divide-y">
                {settlements.map((s) => (
                  <div key={s.id} className="py-3 flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-medium">{s.fromUser.name}</span>
                    <span className="text-gray-400">paid</span>
                    <span className="font-medium">{s.toUser.name}</span>
                    <span className="font-semibold tabular-nums text-brand-700">{formatMoney(s.amount)}</span>
                    <span className="text-gray-400">{s.settledAt.slice(0, 10)}</span>
                    {s.note && <span className="text-gray-500">· {s.note}</span>}
                    <button
                      type="button"
                      onClick={() => removeSettlement.mutate(s.id)}
                      className="ml-auto p-1 text-gray-400 hover:text-red-500"
                      title="Remove"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
