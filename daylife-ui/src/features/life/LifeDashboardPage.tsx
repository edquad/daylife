import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';
import { fetchLifeDashboard, lifeDashboardSupported } from '../../lib/lifeAnalysis';
import { executeVoiceActions, voiceQueryKeysToInvalidate } from '../../lib/executeVoiceCommands';
import { toast } from '../../components/Toaster';
import { cn } from '../../lib/utils';
import {
  Brain, TrendingUp, Wallet, Heart, Target,
  AlertTriangle, Lightbulb, Sparkles, RefreshCw,
  Loader2, ChevronRight, Plus, Trophy, X,
  Eye, Zap,
} from 'lucide-react';

function ScoreRing({ score, label, color, size = 80 }: { score: number; label: string; color: string; size?: number }) {
  const radius = (size - 10) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e5e7eb" strokeWidth={5} />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke={color} strokeWidth={5} strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          className="transition-all duration-1000"
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center" style={{ width: size, height: size }}>
        <span className="text-lg font-bold">{score}</span>
      </div>
      <p className="text-[10px] font-medium text-gray-500 text-center mt-1">{label}</p>
    </div>
  );
}

function ScoreCard({ score, label, icon: Icon, color }: { score: number; label: string; icon: any; color: string }) {
  const bg = score >= 70 ? 'bg-emerald-50 border-emerald-200' : score >= 40 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200';
  return (
    <div className={cn('rounded-xl border p-3 flex items-center gap-3', bg)}>
      <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center shrink-0', color)}>
        <Icon size={20} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-xl font-bold">{score}<span className="text-sm text-gray-400">/100</span></p>
      </div>
      <div className="w-12 h-2 bg-gray-200 rounded-full overflow-hidden shrink-0">
        <div
          className={cn('h-full rounded-full transition-all duration-700', score >= 70 ? 'bg-emerald-500' : score >= 40 ? 'bg-amber-500' : 'bg-red-500')}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

export function LifeDashboardPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const supported = lifeDashboardSupported();

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['life-dashboard'],
    queryFn: () => fetchLifeDashboard({ userId: user?.id, userName: user?.name }),
    staleTime: 1000 * 60 * 60 * 2,
    enabled: supported,
  });

  const addRecommended = async () => {
    if (!user?.id || !data?.recommended_actions?.length) return;
    const result = await executeVoiceActions(data.recommended_actions, user.id);
    voiceQueryKeysToInvalidate().forEach((key) => {
      queryClient.invalidateQueries({ queryKey: key });
    });
    if (result.ok.length > 0) toast.success(`Added ${result.ok.length} recommended task${result.ok.length > 1 ? 's' : ''}`);
  };

  if (!supported) {
    return (
      <div className="p-4 max-w-lg mx-auto">
        <div className="rounded-2xl bg-violet-50 border border-violet-200 p-6 text-center">
          <Brain size={40} className="mx-auto text-violet-400 mb-3" />
          <h2 className="font-bold text-lg">Life Intelligence Coming Soon</h2>
          <p className="text-sm text-gray-600 mt-2">AI analysis requires cloud connection. Enable it in Settings.</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-4 max-w-lg mx-auto space-y-4 animate-pulse">
        <div className="h-40 bg-gray-200 rounded-2xl" />
        <div className="grid grid-cols-2 gap-3">
          <div className="h-24 bg-gray-200 rounded-xl" />
          <div className="h-24 bg-gray-200 rounded-xl" />
          <div className="h-24 bg-gray-200 rounded-xl" />
          <div className="h-24 bg-gray-200 rounded-xl" />
        </div>
        <div className="h-32 bg-gray-200 rounded-2xl" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Brain size={22} className="text-violet-600" /> Life Dashboard
        </h1>
        <button
          type="button"
          onClick={() => void refetch()}
          disabled={isFetching}
          className="p-2 text-violet-600 hover:bg-violet-50 rounded-lg"
        >
          {isFetching ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
        </button>
      </div>

      {/* Main life score */}
      <section className="rounded-2xl bg-gradient-to-br from-violet-600 via-indigo-600 to-purple-700 text-white p-6 text-center">
        <p className="text-sm text-white/70 uppercase tracking-wider font-semibold">Life Score</p>
        <p className="text-6xl font-black mt-2 tabular-nums">{data.life_score}</p>
        <p className="text-sm text-white/80 mt-2">{data.ai_coach_message}</p>
      </section>

      {/* Score cards */}
      <div className="grid grid-cols-2 gap-3">
        <ScoreCard score={data.productivity_score} label="Productivity" icon={Zap} color="bg-blue-100 text-blue-600" />
        <ScoreCard score={data.financial_score} label="Financial" icon={Wallet} color="bg-emerald-100 text-emerald-600" />
        <ScoreCard score={data.health_score} label="Health" icon={Heart} color="bg-rose-100 text-rose-600" />
        <ScoreCard score={data.consistency_score} label="Consistency" icon={Target} color="bg-amber-100 text-amber-600" />
      </div>

      {/* Morning briefing */}
      {data.morning_briefing && (
        <section className="rounded-xl bg-blue-50 border border-blue-200 p-4">
          <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-1">Today's Focus</p>
          <p className="text-sm text-blue-900">{data.morning_briefing}</p>
        </section>
      )}

      {/* Strengths & Weaknesses */}
      <div className="grid grid-cols-2 gap-3">
        {data.top_strengths.length > 0 && (
          <section className="rounded-xl bg-emerald-50 border border-emerald-200 p-3">
            <p className="text-xs font-semibold text-emerald-700 mb-2 flex items-center gap-1">
              <Trophy size={12} /> Strengths
            </p>
            <ul className="space-y-1">
              {data.top_strengths.map((s, i) => (
                <li key={i} className="text-xs text-emerald-900">• {s}</li>
              ))}
            </ul>
          </section>
        )}
        {data.top_weaknesses.length > 0 && (
          <section className="rounded-xl bg-red-50 border border-red-200 p-3">
            <p className="text-xs font-semibold text-red-700 mb-2 flex items-center gap-1">
              <AlertTriangle size={12} /> Weaknesses
            </p>
            <ul className="space-y-1">
              {data.top_weaknesses.map((w, i) => (
                <li key={i} className="text-xs text-red-900">• {w}</li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {/* Hidden patterns */}
      {data.hidden_patterns.length > 0 && (
        <section className="rounded-xl bg-white border p-4">
          <p className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
            <Eye size={16} className="text-violet-600" /> Hidden Patterns
          </p>
          <ul className="space-y-2">
            {data.hidden_patterns.map((p, i) => (
              <li key={i} className="text-sm text-gray-700 flex gap-2">
                <span className="text-violet-500 shrink-0">→</span> {p}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Life loopholes */}
      {data.life_loopholes.length > 0 && (
        <section className="rounded-xl bg-white border p-4">
          <p className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-600" /> Life Loopholes
          </p>
          <div className="space-y-3">
            {data.life_loopholes.map((l, i) => (
              <div key={i} className={cn(
                'rounded-lg p-3 border',
                l.priority === 'high' ? 'bg-red-50 border-red-200' : l.priority === 'medium' ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200',
              )}>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium">{l.problem}</p>
                  <span className={cn(
                    'text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0',
                    l.priority === 'high' ? 'bg-red-200 text-red-800' : l.priority === 'medium' ? 'bg-amber-200 text-amber-800' : 'bg-gray-200 text-gray-700',
                  )}>
                    {l.priority}
                  </span>
                </div>
                {l.evidence && <p className="text-xs text-gray-500 mt-1">Evidence: {l.evidence}</p>}
                {l.fix && <p className="text-xs text-emerald-700 mt-1 font-medium">Fix: {l.fix}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Goal progress */}
      {data.goal_progress.length > 0 && (
        <section className="rounded-xl bg-white border p-4">
          <p className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Target size={16} className="text-indigo-600" /> Goal Progress
          </p>
          <div className="space-y-3">
            {data.goal_progress.map((g, i) => (
              <div key={i}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium truncate">{g.goal}</span>
                  <span className="text-xs text-gray-500 shrink-0">{g.progress_pct}%</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500 rounded-full transition-all duration-500" style={{ width: `${g.progress_pct}%` }} />
                </div>
                {g.next_step && <p className="text-xs text-gray-500 mt-1">Next: {g.next_step}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Future predictions */}
      {data.future_predictions.length > 0 && (
        <section className="rounded-xl bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-200 p-4">
          <p className="text-sm font-semibold text-indigo-900 mb-2 flex items-center gap-2">
            <TrendingUp size={16} className="text-indigo-600" /> Future Predictions
          </p>
          <ul className="space-y-2">
            {data.future_predictions.map((p, i) => (
              <li key={i} className="text-sm text-indigo-800 flex gap-2">
                <Sparkles size={14} className="text-indigo-500 shrink-0 mt-0.5" /> {p}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Spending insight */}
      {data.spending_insight && (
        <section className="rounded-xl bg-emerald-50 border border-emerald-200 p-4">
          <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider mb-1 flex items-center gap-1">
            <Wallet size={12} /> Spending Insight
          </p>
          <p className="text-sm text-emerald-900">{data.spending_insight}</p>
        </section>
      )}

      {/* Weekly wins & misses */}
      {(data.weekly_wins.length > 0 || data.weekly_misses.length > 0) && (
        <div className="grid grid-cols-2 gap-3">
          {data.weekly_wins.length > 0 && (
            <section className="rounded-xl bg-white border p-3">
              <p className="text-xs font-semibold text-emerald-700 mb-2">This week's wins</p>
              <ul className="space-y-1">
                {data.weekly_wins.map((w, i) => (
                  <li key={i} className="text-xs text-gray-700">✓ {w}</li>
                ))}
              </ul>
            </section>
          )}
          {data.weekly_misses.length > 0 && (
            <section className="rounded-xl bg-white border p-3">
              <p className="text-xs font-semibold text-amber-700 mb-2">Needs attention</p>
              <ul className="space-y-1">
                {data.weekly_misses.map((m, i) => (
                  <li key={i} className="text-xs text-gray-700">• {m}</li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      {/* Recommended actions */}
      {data.recommended_actions.length > 0 && (
        <section className="rounded-xl bg-white border p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <Lightbulb size={16} className="text-amber-500" /> AI Recommended
            </p>
            <button
              type="button"
              onClick={() => void addRecommended()}
              className="flex items-center gap-1 px-3 py-1.5 bg-violet-600 text-white rounded-lg text-xs font-semibold"
            >
              <Plus size={14} /> Add all
            </button>
          </div>
          <ul className="space-y-1.5">
            {data.recommended_actions.map((a, i) => (
              <li key={i} className="text-sm text-gray-700 flex items-center gap-2">
                <ChevronRight size={14} className="text-violet-500 shrink-0" />
                {'title' in a ? a.title : 'name' in a ? a.name : ''}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
