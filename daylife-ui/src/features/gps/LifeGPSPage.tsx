import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { todayISO } from '../../lib/format';
import { getVoiceLang } from '../../lib/voiceCommands';
import {
  Navigation, TrendingUp, TrendingDown, Minus, AlertTriangle,
  Loader2, Zap, ArrowRight, Target,
} from 'lucide-react';
import { cn } from '../../lib/utils';

const VOICE_PARSE_URL = (import.meta.env.VITE_VOICE_PARSE_URL || '').trim();

interface Direction {
  arrow: 'up' | 'down' | 'flat';
  momentum: number;
  trend: string;
}

interface LifeGPSResult {
  directions: Record<string, Direction>;
  twelve_month_prediction: Record<string, string>;
  course_corrections: string[];
  speed: string;
  life_direction_summary: string;
  warning: string | null;
}

const AREA_CONFIG: Record<string, { label: string; emoji: string; color: string }> = {
  financial: { label: 'Financial', emoji: '💰', color: 'text-amber-600' },
  health: { label: 'Health', emoji: '💪', color: 'text-emerald-600' },
  career: { label: 'Career', emoji: '🚀', color: 'text-blue-600' },
  relationships: { label: 'Relationships', emoji: '❤️', color: 'text-rose-600' },
  learning: { label: 'Learning', emoji: '📚', color: 'text-violet-600' },
  discipline: { label: 'Discipline', emoji: '⚡', color: 'text-indigo-600' },
};

const SPEED_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  ACCELERATING: { label: 'Accelerating', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
  CRUISING: { label: 'Cruising', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
  SLOWING: { label: 'Slowing Down', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
  STALLED: { label: 'Stalled', color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
};

function ArrowIcon({ dir }: { dir: string }) {
  if (dir === 'up') return <TrendingUp size={18} className="text-emerald-500" />;
  if (dir === 'down') return <TrendingDown size={18} className="text-red-500" />;
  return <Minus size={18} className="text-gray-400" />;
}

function MomentumBar({ value }: { value: number }) {
  return (
    <div className="h-1.5 bg-gray-100 rounded-full flex-1 overflow-hidden">
      <div
        className={cn(
          'h-full rounded-full transition-all',
          value >= 7 ? 'bg-emerald-500' : value >= 4 ? 'bg-amber-400' : 'bg-red-400',
        )}
        style={{ width: `${value * 10}%` }}
      />
    </div>
  );
}

export default function LifeGPSPage() {
  const { data, isLoading, error, refetch } = useQuery<LifeGPSResult>({
    queryKey: ['life-gps'],
    queryFn: async () => {
      const [tasks, expenses, routines, dreams] = await Promise.all([
        api.get('/tasks?limit=100').catch(() => []),
        api.get('/expenses?limit=50').catch(() => []),
        api.get(`/routines/today?date=${todayISO()}`).catch(() => ({ routines: [] })),
        api.get('/vision-board').catch(() => []),
      ]);

      const res = await fetch(VOICE_PARSE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'life_gps',
          lang: getVoiceLang(),
          context: { today: todayISO(), tasks, expenses, routines, dreams },
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Failed');
      return json as LifeGPSResult;
    },
    staleTime: 1000 * 60 * 60 * 2,
  });

  const speedStyle = data?.speed ? (SPEED_STYLES[data.speed] || SPEED_STYLES.CRUISING) : null;

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-gradient-to-br from-slate-800 to-indigo-900 px-5 pt-8 pb-6 text-white">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Navigation size={22} /> Life GPS
        </h1>
        <p className="text-sm text-white/70 mt-1">Where your life is heading right now</p>
      </div>

      <div className="px-4 -mt-3 space-y-4">
        {isLoading && (
          <div className="bg-white rounded-2xl border p-8 text-center">
            <Loader2 size={32} className="animate-spin text-indigo-600 mx-auto mb-3" />
            <p className="text-sm text-gray-600">Calculating your life direction...</p>
          </div>
        )}

        {error && (
          <div className="bg-white rounded-2xl border p-6 text-center">
            <p className="text-sm text-red-600 mb-3">Could not load Life GPS</p>
            <button type="button" onClick={() => refetch()} className="text-sm text-violet-600 font-medium">
              Try again
            </button>
          </div>
        )}

        {data && (
          <>
            {/* Speed indicator */}
            {speedStyle && (
              <div className={cn('rounded-2xl border p-4 text-center', speedStyle.bg)}>
                <p className="text-xs font-bold text-gray-500 uppercase mb-1">Life Speed</p>
                <p className={cn('text-xl font-black', speedStyle.color)}>{speedStyle.label}</p>
              </div>
            )}

            {/* Summary */}
            {data.life_direction_summary && (
              <div className="bg-gradient-to-br from-indigo-50 to-violet-50 rounded-2xl border border-indigo-200 p-4">
                <p className="text-sm text-indigo-900 font-medium italic">"{data.life_direction_summary}"</p>
              </div>
            )}

            {/* Warning */}
            {data.warning && (
              <div className="flex items-start gap-2 px-4 py-3 rounded-2xl bg-red-50 border border-red-200">
                <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
                <p className="text-sm text-red-800 font-medium">{data.warning}</p>
              </div>
            )}

            {/* Direction cards */}
            <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b bg-gray-50">
                <p className="text-xs font-bold text-gray-700 uppercase">Current Direction</p>
              </div>
              <div className="divide-y">
                {Object.entries(data.directions || {}).map(([key, dir]) => {
                  const config = AREA_CONFIG[key];
                  if (!config || !dir) return null;
                  return (
                    <div key={key} className="px-4 py-3 flex items-center gap-3">
                      <span className="text-lg">{config.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-medium text-gray-900">{config.label}</p>
                          <ArrowIcon dir={dir.arrow} />
                        </div>
                        <div className="flex items-center gap-2">
                          <MomentumBar value={dir.momentum} />
                          <span className="text-[10px] text-gray-400 shrink-0">{dir.momentum}/10</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">{dir.trend}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 12-month predictions */}
            <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b bg-gray-50">
                <p className="text-xs font-bold text-gray-700 uppercase flex items-center gap-1">
                  <Target size={12} /> 12-Month Prediction
                </p>
              </div>
              <div className="p-4 space-y-3">
                {Object.entries(data.twelve_month_prediction || {}).map(([key, text]) => {
                  const config = AREA_CONFIG[key];
                  return (
                    <div key={key} className="flex items-start gap-2">
                      <span className="text-sm shrink-0">{config?.emoji || '📍'}</span>
                      <div>
                        <p className="text-xs font-bold text-gray-700">{config?.label || key}</p>
                        <p className="text-sm text-gray-600">{text}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Course corrections */}
            {data.course_corrections?.length > 0 && (
              <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b bg-amber-50">
                  <p className="text-xs font-bold text-amber-800 uppercase flex items-center gap-1">
                    <Zap size={12} /> Change Direction
                  </p>
                </div>
                <div className="p-4 space-y-2">
                  {data.course_corrections.map((action, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-gray-800">
                      <ArrowRight size={14} className="text-violet-500 shrink-0 mt-0.5" />
                      {action}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
