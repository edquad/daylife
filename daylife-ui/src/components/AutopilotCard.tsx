import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchAutopilot, type AutopilotContext } from '../lib/lifeAutopilot';
import { cn } from '../lib/utils';
import {
  Zap, Ban, AlertTriangle, Heart, Wallet,
  Target, Brain, Loader2, ChevronDown, ChevronUp,
} from 'lucide-react';

interface AutopilotCardProps {
  context: AutopilotContext;
}

export function AutopilotCard({ context }: AutopilotCardProps) {
  const [expanded, setExpanded] = React.useState(true);

  const { data, isLoading } = useQuery({
    queryKey: ['life-autopilot', context.tasksToday, context.overdue],
    queryFn: () => fetchAutopilot(context),
    staleTime: 1000 * 60 * 60 * 4,
  });

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 animate-pulse">
        <div className="flex items-center gap-2">
          <Loader2 size={16} className="animate-spin text-indigo-600" />
          <span className="text-sm text-indigo-700 font-medium">AI Autopilot loading...</span>
        </div>
      </div>
    );
  }

  if (!data || (data.doToday.length === 0 && !data.aiMessage)) return null;

  return (
    <section className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 via-white to-violet-50 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-sm font-bold text-indigo-900 flex items-center gap-2">
          <Brain size={16} className="text-indigo-600" /> AI Autopilot
        </span>
        {expanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {/* AI message */}
          {data.aiMessage && (
            <p className="text-sm text-indigo-900 italic border-l-2 border-indigo-300 pl-3">
              {data.aiMessage}
            </p>
          )}

          {/* High impact task */}
          {data.highImpactTask && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-amber-50 border border-amber-200">
              <Target size={14} className="text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] font-bold text-amber-700 uppercase">Highest impact today</p>
                <p className="text-sm text-amber-900 font-medium">{data.highImpactTask}</p>
              </div>
            </div>
          )}

          {/* Do today */}
          {data.doToday.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-emerald-700 uppercase mb-1.5 flex items-center gap-1">
                <Zap size={10} /> Do today
              </p>
              <ul className="space-y-1">
                {data.doToday.map((item, i) => (
                  <li key={i} className="text-sm text-gray-800 flex items-start gap-2">
                    <span className="text-emerald-500 shrink-0">→</span> {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Don't today */}
          {data.dontToday.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-red-700 uppercase mb-1.5 flex items-center gap-1">
                <Ban size={10} /> Avoid today
              </p>
              <ul className="space-y-1">
                {data.dontToday.map((item, i) => (
                  <li key={i} className="text-sm text-red-800 flex items-start gap-2">
                    <span className="text-red-400 shrink-0">✗</span> {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Warnings row */}
          <div className="flex flex-wrap gap-2">
            {data.spendingWarning && (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-orange-50 border border-orange-200 text-xs text-orange-800">
                <Wallet size={12} /> {data.spendingWarning}
              </div>
            )}
            {data.healthWarning && (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800">
                <Heart size={12} /> {data.healthWarning}
              </div>
            )}
            {data.relationshipReminder && (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-violet-50 border border-violet-200 text-xs text-violet-800">
                <Heart size={12} /> {data.relationshipReminder}
              </div>
            )}
          </div>

          {/* Regret alerts */}
          {data.regretAlerts.length > 0 && (
            <div className="space-y-1.5">
              {data.regretAlerts.map((alert, i) => (
                <div key={i} className="flex items-start gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200">
                  <AlertTriangle size={14} className="text-red-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-800">{alert.warning}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
