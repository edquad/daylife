import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchDreamPlan, type DreamPlan } from '../lib/dreamPlan';
import {
  X, Loader2, Target, Calendar, Repeat,
  Wallet, AlertTriangle, Zap, TrendingUp,
} from 'lucide-react';

interface DreamPlanModalProps {
  dreamTitle: string;
  category?: string;
  onClose: () => void;
}

export function DreamPlanModal({ dreamTitle, category, onClose }: DreamPlanModalProps) {
  const { data: plan, isLoading, error } = useQuery<DreamPlan>({
    queryKey: ['dream-plan', dreamTitle],
    queryFn: () => fetchDreamPlan(dreamTitle, category),
    staleTime: Infinity,
  });

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl sm:rounded-2xl w-full max-w-md max-h-[85vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-4 py-3 flex items-center justify-between rounded-t-3xl sm:rounded-t-2xl z-10">
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <Target size={18} className="text-indigo-600" />
            AI Action Plan
          </h2>
          <button type="button" onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
            <X size={16} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 size={32} className="animate-spin text-indigo-600 mb-3" />
              <p className="text-sm text-gray-500">AI creating your action plan...</p>
              <p className="text-xs text-gray-400 mt-1">This may take a few seconds</p>
            </div>
          )}

          {error && (
            <div className="text-center py-12">
              <p className="text-sm text-red-600">Failed to generate plan. Try again later.</p>
            </div>
          )}

          {plan && (
            <>
              {/* Summary */}
              <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200">
                <p className="text-sm text-indigo-900 font-medium">{plan.summary}</p>
              </div>

              {/* Success probability */}
              <div className="flex items-center gap-3">
                <div className="relative w-14 h-14">
                  <svg viewBox="0 0 36 36" className="w-14 h-14 -rotate-90">
                    <circle cx="18" cy="18" r="15" fill="none" stroke="#E5E7EB" strokeWidth="3" />
                    <circle
                      cx="18" cy="18" r="15" fill="none"
                      stroke={plan.successProbability >= 70 ? '#10B981' : plan.successProbability >= 40 ? '#F59E0B' : '#EF4444'}
                      strokeWidth="3"
                      strokeDasharray={`${plan.successProbability * 0.94} 100`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">{plan.successProbability}%</span>
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">Success Probability</p>
                  <p className="text-xs text-gray-500">Based on typical achievement data</p>
                </div>
              </div>

              {/* First step today */}
              {plan.firstStepToday && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200">
                  <Zap size={14} className="text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[10px] font-bold text-amber-700 uppercase">Start today (15 min)</p>
                    <p className="text-sm text-amber-900">{plan.firstStepToday}</p>
                  </div>
                </div>
              )}

              {/* Monthly targets */}
              <div>
                <p className="text-xs font-bold text-gray-700 uppercase mb-2 flex items-center gap-1">
                  <Calendar size={12} /> Monthly Targets
                </p>
                <div className="space-y-2">
                  {plan.monthlyTargets.map((mt) => (
                    <div key={mt.month} className="p-3 rounded-xl border border-gray-100 bg-white">
                      <p className="text-xs font-bold text-indigo-700 mb-1">Month {mt.month}: {mt.target}</p>
                      <ul className="space-y-0.5">
                        {mt.tasks.map((t, i) => (
                          <li key={i} className="text-xs text-gray-700 flex items-start gap-1.5">
                            <span className="text-indigo-400">•</span> {t}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>

              {/* Weekly habits */}
              {plan.weeklyHabits.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-gray-700 uppercase mb-2 flex items-center gap-1">
                    <Repeat size={12} /> Build These Habits
                  </p>
                  <div className="space-y-1">
                    {plan.weeklyHabits.map((h, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm text-gray-800">
                        <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-[10px] font-bold">{i + 1}</span>
                        {h}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Budget impact */}
              {plan.budgetImpact && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-blue-50 border border-blue-200">
                  <Wallet size={14} className="text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[10px] font-bold text-blue-700 uppercase">Money impact</p>
                    <p className="text-xs text-blue-800">{plan.budgetImpact}</p>
                  </div>
                </div>
              )}

              {/* Risks */}
              {plan.risks.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-gray-700 uppercase mb-2 flex items-center gap-1">
                    <AlertTriangle size={12} /> Watch Out For
                  </p>
                  <ul className="space-y-1">
                    {plan.risks.map((r, i) => (
                      <li key={i} className="text-xs text-red-700 flex items-start gap-1.5">
                        <span className="text-red-400 shrink-0">⚠</span> {r}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
