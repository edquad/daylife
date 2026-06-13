import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { todayISO } from '../../lib/format';
import { getVoiceLang } from '../../lib/voiceCommands';
import {
  Film, Loader2, Star, TrendingDown, Share2,
  Calendar, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { cn } from '../../lib/utils';

const VOICE_PARSE_URL = (import.meta.env.VITE_VOICE_PARSE_URL || '').trim();

interface ReplayStat {
  value: string;
  label: string;
  emoji: string;
  sentiment: 'good' | 'neutral' | 'bad';
}

interface LifeReplayResult {
  month_title: string;
  headline_stat: { value: string; label: string; emoji: string };
  stats: ReplayStat[];
  highlights: string[];
  lowlights: string[];
  money_story: string;
  productivity_story: string;
  habit_streak: string;
  ai_letter: string;
  next_month_focus: string;
  share_text: string;
}

function getMonthLabel(offset: number): { label: string; key: string } {
  const d = new Date();
  d.setMonth(d.getMonth() + offset);
  return {
    label: d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
    key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
  };
}

export default function LifeReplayPage() {
  const [monthOffset, setMonthOffset] = useState(-1);
  const { label: monthLabel, key: monthKey } = getMonthLabel(monthOffset);

  const { data, isLoading, error } = useQuery<LifeReplayResult>({
    queryKey: ['life-replay', monthKey],
    queryFn: async () => {
      const [tasks, expenses, routines] = await Promise.all([
        api.get(`/tasks?month=${monthKey}`).catch(() => []),
        api.get(`/expenses?month=${monthKey}`).catch(() => []),
        api.get(`/routines/today?date=${monthKey}-15`).catch(() => ({ routines: [] })),
      ]);

      const res = await fetch(VOICE_PARSE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'life_replay',
          lang: getVoiceLang(),
          context: { today: todayISO(), month: monthKey, monthLabel, tasks, expenses, routines },
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Failed');
      return json as LifeReplayResult;
    },
    staleTime: 1000 * 60 * 60 * 24,
  });

  const handleShare = () => {
    if (data?.share_text && navigator.share) {
      navigator.share({ text: data.share_text }).catch(() => {});
    } else if (data?.share_text) {
      navigator.clipboard.writeText(data.share_text);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white pb-24">
      {/* Header */}
      <div className="px-5 pt-8 pb-4">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Film size={22} className="text-amber-400" /> Life Replay
        </h1>
        <p className="text-sm text-white/50 mt-1">Your month in review</p>
      </div>

      {/* Month selector */}
      <div className="flex items-center justify-center gap-4 px-4 pb-4">
        <button type="button" onClick={() => setMonthOffset((v) => v - 1)} className="p-2 text-white/50 hover:text-white">
          <ChevronLeft size={20} />
        </button>
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20">
          <Calendar size={14} className="text-amber-400" />
          <span className="text-sm font-medium">{monthLabel}</span>
        </div>
        <button
          type="button"
          onClick={() => setMonthOffset((v) => Math.min(v + 1, 0))}
          disabled={monthOffset >= 0}
          className="p-2 text-white/50 hover:text-white disabled:opacity-30"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      <div className="px-4 space-y-4">
        {isLoading && (
          <div className="text-center py-16">
            <Loader2 size={32} className="animate-spin text-amber-400 mx-auto mb-3" />
            <p className="text-sm text-white/60">Generating your replay...</p>
          </div>
        )}

        {error && (
          <div className="text-center py-12">
            <p className="text-sm text-red-400">Not enough data for this month's replay</p>
          </div>
        )}

        {data && (
          <>
            {/* Title */}
            <div className="text-center py-4">
              <p className="text-3xl font-black bg-gradient-to-r from-amber-300 to-orange-400 bg-clip-text text-transparent">
                {data.month_title}
              </p>
            </div>

            {/* Headline stat */}
            {data.headline_stat && (
              <div className="text-center py-6 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30">
                <p className="text-5xl font-black text-amber-300">{data.headline_stat.value}</p>
                <p className="text-sm text-white/70 mt-1">{data.headline_stat.emoji} {data.headline_stat.label}</p>
              </div>
            )}

            {/* Stats grid */}
            {data.stats?.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                {data.stats.map((stat, i) => (
                  <div
                    key={i}
                    className={cn(
                      'rounded-xl p-3 border',
                      stat.sentiment === 'good' ? 'bg-emerald-500/10 border-emerald-500/30' :
                      stat.sentiment === 'bad' ? 'bg-red-500/10 border-red-500/30' :
                      'bg-white/5 border-white/10',
                    )}
                  >
                    <p className="text-xl font-bold">{stat.value}</p>
                    <p className="text-xs text-white/60">{stat.emoji} {stat.label}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Highlights */}
            {data.highlights?.length > 0 && (
              <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/30 p-4">
                <p className="text-xs font-bold text-emerald-400 uppercase mb-2 flex items-center gap-1">
                  <Star size={12} /> Highlights
                </p>
                <ul className="space-y-1.5">
                  {data.highlights.map((h, i) => (
                    <li key={i} className="text-sm text-white/80 flex items-start gap-2">
                      <span className="text-emerald-400 shrink-0">✦</span> {h}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Lowlights */}
            {data.lowlights?.length > 0 && (
              <div className="rounded-2xl bg-red-500/10 border border-red-500/30 p-4">
                <p className="text-xs font-bold text-red-400 uppercase mb-2 flex items-center gap-1">
                  <TrendingDown size={12} /> Could be better
                </p>
                <ul className="space-y-1.5">
                  {data.lowlights.map((l, i) => (
                    <li key={i} className="text-sm text-white/70 flex items-start gap-2">
                      <span className="text-red-400 shrink-0">·</span> {l}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Stories */}
            <div className="space-y-2">
              {data.money_story && (
                <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-3">
                  <p className="text-xs text-amber-400 font-bold mb-1">💰 Money</p>
                  <p className="text-sm text-white/80">{data.money_story}</p>
                </div>
              )}
              {data.productivity_story && (
                <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-3">
                  <p className="text-xs text-blue-400 font-bold mb-1">✅ Productivity</p>
                  <p className="text-sm text-white/80">{data.productivity_story}</p>
                </div>
              )}
              {data.habit_streak && (
                <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-3">
                  <p className="text-xs text-violet-400 font-bold mb-1">🔥 Best Streak</p>
                  <p className="text-sm text-white/80">{data.habit_streak}</p>
                </div>
              )}
            </div>

            {/* AI Letter */}
            {data.ai_letter && (
              <div className="rounded-2xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 border border-violet-500/30 p-5">
                <p className="text-xs text-violet-300 font-bold mb-2">A letter from Rozka AI</p>
                <p className="text-sm text-white/90 italic leading-relaxed">"{data.ai_letter}"</p>
              </div>
            )}

            {/* Next month focus */}
            {data.next_month_focus && (
              <div className="text-center py-4">
                <p className="text-xs text-white/50 uppercase font-bold mb-2">Next month, focus on:</p>
                <p className="text-lg font-bold text-amber-300">{data.next_month_focus}</p>
              </div>
            )}

            {/* Share */}
            <button
              type="button"
              onClick={handleShare}
              className="w-full py-3.5 bg-white/10 border border-white/20 rounded-xl text-sm font-medium flex items-center justify-center gap-2 hover:bg-white/20 transition-colors"
            >
              <Share2 size={16} /> Share your month
            </button>
          </>
        )}
      </div>
    </div>
  );
}
