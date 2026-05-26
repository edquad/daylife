import React, { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api, Expense } from '../../lib/api';
import { useDateStore } from '../../lib/dateStore';
import {
  formatDate,
  formatDayHeading,
  formatMonthHeading,
  formatMoney,
  formatYearHeading,
  todayISO,
} from '../../lib/format';
import { cn } from '../../lib/utils';
import { BarChart3, Calendar, ChevronLeft, Search } from 'lucide-react';

type ReportPeriod = 'daily' | 'monthly' | 'yearly';

interface CategoryBreakdown {
  id: string;
  name: string;
  color: string;
  total: string;
  count: number;
}

interface PersonBreakdown {
  userId: string;
  name: string;
  color: string;
  total: string;
  count: number;
}

interface ExpenseReport {
  period: ReportPeriod;
  label: string;
  from: string;
  to: string;
  total: string;
  count: number;
  byCategory: CategoryBreakdown[];
  byPerson: PersonBreakdown[];
  expenses: Expense[];
}

const PERIODS: { id: ReportPeriod; label: string }[] = [
  { id: 'daily', label: 'Daily' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'yearly', label: 'Yearly' },
];

function periodHeading(period: ReportPeriod, anchor: string): string {
  if (period === 'daily') return formatDayHeading(anchor);
  if (period === 'monthly') return formatMonthHeading(anchor.slice(0, 7));
  return formatYearHeading(anchor.slice(0, 4));
}

export function ExpenseReportsPage() {
  const selectedDate = useDateStore((s) => s.selectedDate);
  const [searchParams, setSearchParams] = useSearchParams();
  const period = (searchParams.get('period') || 'monthly') as ReportPeriod;
  const anchor = searchParams.get('date') || selectedDate || todayISO();
  const [search, setSearch] = useState('');

  const setPeriod = (next: ReportPeriod) => {
    const params = new URLSearchParams(searchParams);
    params.set('period', next);
    if (!params.get('date')) params.set('date', selectedDate);
    setSearchParams(params);
  };

  const setAnchor = (next: string) => {
    const params = new URLSearchParams(searchParams);
    params.set('date', next);
    setSearchParams(params);
  };

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set('period', period);
    params.set('date', anchor);
    if (search) params.set('search', search);
    return params.toString();
  }, [period, anchor, search]);

  const { data, isLoading } = useQuery<ExpenseReport>({
    queryKey: ['expense-report', period, anchor, search],
    queryFn: () => api.get(`/expenses/report?${queryParams}`),
  });

  const maxCategoryTotal = useMemo(() => {
    if (!data?.byCategory.length) return 1;
    return Math.max(...data.byCategory.map((c) => parseFloat(c.total)));
  }, [data?.byCategory]);

  const maxPersonTotal = useMemo(() => {
    if (!data?.byPerson.length) return 1;
    return Math.max(...data.byPerson.map((p) => parseFloat(p.total)));
  }, [data?.byPerson]);

  return (
    <div className="p-4 lg:p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <Link to="/expenses" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-brand-600 mb-2">
            <ChevronLeft size={16} /> Back to expenses
          </Link>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 size={24} className="text-brand-600" />
            Expense reports
          </h1>
          <p className="text-gray-500 text-sm">Daily, monthly & yearly — all spend in detail</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 p-1 bg-gray-100 rounded-xl w-fit">
        {PERIODS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPeriod(p.id)}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              period === p.id ? 'bg-white shadow-sm text-brand-700' : 'text-gray-500 hover:text-gray-700',
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        {period === 'daily' && (
          <label className="flex items-center gap-2 text-sm">
            <Calendar size={16} className="text-gray-400" />
            <input
              type="date"
              value={anchor.slice(0, 10)}
              onChange={(e) => setAnchor(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm"
            />
          </label>
        )}
        {period === 'monthly' && (
          <label className="flex items-center gap-2 text-sm">
            <Calendar size={16} className="text-gray-400" />
            <input
              type="month"
              value={anchor.slice(0, 7)}
              onChange={(e) => setAnchor(`${e.target.value}-01`)}
              className="border rounded-lg px-3 py-2 text-sm"
            />
          </label>
        )}
        {period === 'yearly' && (
          <label className="flex items-center gap-2 text-sm">
            <Calendar size={16} className="text-gray-400" />
            <select
              value={anchor.slice(0, 4)}
              onChange={(e) => setAnchor(`${e.target.value}-01-01`)}
              className="border rounded-lg px-3 py-2 text-sm"
            >
              {Array.from({ length: 8 }, (_, i) => new Date().getFullYear() - i).map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </label>
        )}

        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search description or category..."
            className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="animate-pulse space-y-4">
          <div className="h-24 bg-gray-200 rounded-2xl" />
          <div className="h-48 bg-gray-200 rounded-2xl" />
        </div>
      ) : (
        <>
          <div className="bg-brand-50 border border-brand-100 rounded-2xl p-5">
            <p className="text-sm text-brand-700 font-medium">{periodHeading(period, anchor)}</p>
            <p className="text-3xl font-bold tabular-nums text-brand-800 mt-1">{formatMoney(data?.total)}</p>
            <p className="text-sm text-brand-600 mt-1">
              {data?.count ?? 0} transaction{(data?.count ?? 0) !== 1 ? 's' : ''}
              {period !== 'daily' && data?.from && data?.to && (
                <span className="text-brand-500"> · {formatDate(data.from)} – {formatDate(data.to)}</span>
              )}
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-5">
            <section className="bg-white rounded-2xl border shadow-sm p-4">
              <h3 className="font-semibold mb-4">By category</h3>
              {(data?.byCategory ?? []).length === 0 ? (
                <p className="text-sm text-gray-400 py-6 text-center">No spending in this period</p>
              ) : (
                <div className="space-y-3">
                  {data!.byCategory.map((cat) => (
                    <div key={cat.id}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="inline-flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                          {cat.name}
                          <span className="text-gray-400">({cat.count})</span>
                        </span>
                        <span className="font-semibold tabular-nums">{formatMoney(cat.total)}</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${(parseFloat(cat.total) / maxCategoryTotal) * 100}%`,
                            backgroundColor: cat.color,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="bg-white rounded-2xl border shadow-sm p-4">
              <h3 className="font-semibold mb-4">By person</h3>
              {(data?.byPerson ?? []).length === 0 ? (
                <p className="text-sm text-gray-400 py-6 text-center">No spending in this period</p>
              ) : (
                <div className="space-y-3">
                  {data!.byPerson.map((person) => (
                    <div key={person.userId}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="inline-flex items-center gap-2">
                          <span
                            className="w-6 h-6 rounded-full text-white text-xs flex items-center justify-center"
                            style={{ backgroundColor: person.color }}
                          >
                            {person.name[0]}
                          </span>
                          {person.name}
                          <span className="text-gray-400">({person.count})</span>
                        </span>
                        <span className="font-semibold tabular-nums">{formatMoney(person.total)}</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${(parseFloat(person.total) / maxPersonTotal) * 100}%`,
                            backgroundColor: person.color,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <section className="bg-white rounded-2xl border shadow-sm overflow-hidden">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold">All expenses</h3>
              <span className="text-sm text-gray-400">{data?.expenses.length ?? 0} rows</span>
            </div>
            {(data?.expenses ?? []).length === 0 ? (
              <p className="text-sm text-gray-400 py-12 text-center">No expenses in this period</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left p-3 font-medium text-gray-500">Date</th>
                      <th className="text-left p-3 font-medium text-gray-500 hidden sm:table-cell">Description</th>
                      <th className="text-left p-3 font-medium text-gray-500">Category</th>
                      <th className="text-left p-3 font-medium text-gray-500 hidden md:table-cell">Paid by</th>
                      <th className="text-right p-3 font-medium text-gray-500">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {data!.expenses.map((exp) => (
                      <tr key={exp.id} className="hover:bg-gray-50">
                        <td className="p-3 whitespace-nowrap">{formatDate(exp.expenseDate)}</td>
                        <td className="p-3 hidden sm:table-cell text-gray-600">{exp.description || '—'}</td>
                        <td className="p-3">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: exp.category.color }} />
                            {exp.category.name}
                          </span>
                        </td>
                        <td className="p-3 hidden md:table-cell">
                          <span
                            className="text-xs px-2 py-0.5 rounded-full text-white"
                            style={{ backgroundColor: exp.paidBy.color }}
                          >
                            {exp.paidBy.name}
                          </span>
                        </td>
                        <td className="p-3 text-right font-semibold tabular-nums">{formatMoney(exp.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t">
                    <tr>
                      <td colSpan={4} className="p-3 text-right font-medium text-gray-600">Total</td>
                      <td className="p-3 text-right font-bold tabular-nums">{formatMoney(data?.total)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
