import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { todayISO } from '../../lib/format';
import { getVoiceLang } from '../../lib/voiceCommands';
import {
  Brain, Loader2, ThumbsUp, ThumbsDown, Clock,
  HelpCircle, TrendingDown, Lightbulb, Send, Sparkles,
} from 'lucide-react';
import { cn } from '../../lib/utils';

const VOICE_PARSE_URL = (import.meta.env.VITE_VOICE_PARSE_URL || '').trim();

interface DecisionResult {
  verdict: 'YES' | 'NO' | 'WAIT' | 'MAYBE';
  confidence: number;
  reasoning: string;
  impact: {
    savings_delay_days: number;
    goal_affected: string | null;
    budget_status: string;
    opportunity_cost: string;
  };
  alternatives: string[];
  ai_advice: string;
}

const VERDICT_STYLES: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  YES: { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', icon: <ThumbsUp size={20} /> },
  NO: { bg: 'bg-red-50 border-red-200', text: 'text-red-700', icon: <ThumbsDown size={20} /> },
  WAIT: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', icon: <Clock size={20} /> },
  MAYBE: { bg: 'bg-blue-50 border-blue-200', text: 'text-blue-700', icon: <HelpCircle size={20} /> },
};

const EXAMPLE_QUESTIONS = [
  'Should I buy AirPods for ₹15,000?',
  'Should I order food today?',
  'Should I take a trip this month?',
  'Should I buy new clothes?',
  'Should I invest in a course?',
];

export default function DecisionPage() {
  const [question, setQuestion] = useState('');
  const [result, setResult] = useState<DecisionResult | null>(null);

  const analyze = useMutation({
    mutationFn: async (q: string): Promise<DecisionResult> => {
      const res = await fetch(VOICE_PARSE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'decision_engine',
          lang: getVoiceLang(),
          context: {
            today: todayISO(),
            question: q,
            expenses: await api.get('/expenses?limit=50').catch(() => []),
            expenseReport: await api.get(`/expenses/report?month=${todayISO().slice(0, 7)}`).catch(() => null),
            dreams: await api.get('/vision-board').catch(() => []),
          },
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Failed');
      return json as DecisionResult;
    },
    onSuccess: (data) => setResult(data),
  });

  const handleSubmit = (q?: string) => {
    const text = (q || question).trim();
    if (!text) return;
    setQuestion(text);
    setResult(null);
    analyze.mutate(text);
  };

  const style = result ? (VERDICT_STYLES[result.verdict] || VERDICT_STYLES.MAYBE) : null;

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-gradient-to-br from-indigo-600 to-violet-700 px-5 pt-8 pb-6 text-white">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Brain size={22} /> AI Decision Engine
        </h1>
        <p className="text-sm text-white/70 mt-1">Should I buy this? AI checks your budget & goals</p>
      </div>

      <div className="px-4 -mt-3 space-y-4">
        {/* Input */}
        <div className="bg-white rounded-2xl border shadow-sm p-4">
          <p className="text-xs font-bold text-gray-700 mb-2">Ask any spending decision:</p>
          <div className="flex gap-2">
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
              placeholder="Should I buy..."
              className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl text-sm outline-none focus:border-violet-500"
            />
            <button
              type="button"
              onClick={() => handleSubmit()}
              disabled={!question.trim() || analyze.isPending}
              className="px-4 py-3 bg-violet-600 text-white rounded-xl disabled:opacity-50"
            >
              {analyze.isPending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            </button>
          </div>

          {/* Example questions */}
          {!result && (
            <div className="flex flex-wrap gap-2 mt-3">
              {EXAMPLE_QUESTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => handleSubmit(q)}
                  disabled={analyze.isPending}
                  className="px-3 py-1.5 rounded-full text-xs bg-violet-50 text-violet-700 border border-violet-100 hover:bg-violet-100"
                >
                  {q}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Loading */}
        {analyze.isPending && (
          <div className="bg-white rounded-2xl border p-6 text-center">
            <Loader2 size={32} className="animate-spin text-violet-600 mx-auto mb-3" />
            <p className="text-sm text-gray-600">AI analyzing your finances & goals...</p>
          </div>
        )}

        {/* Result */}
        {result && style && (
          <div className="space-y-3">
            {/* Verdict */}
            <div className={cn('rounded-2xl border p-5 text-center', style.bg)}>
              <div className={cn('w-14 h-14 rounded-full mx-auto flex items-center justify-center mb-3', style.text, 'bg-white shadow-sm')}>
                {style.icon}
              </div>
              <p className={cn('text-2xl font-black', style.text)}>{result.verdict}</p>
              <p className="text-sm text-gray-600 mt-1">Confidence: {result.confidence}%</p>
            </div>

            {/* Reasoning */}
            <div className="bg-white rounded-2xl border p-4">
              <p className="text-xs font-bold text-gray-700 mb-2">Why?</p>
              <p className="text-sm text-gray-800 leading-relaxed">{result.reasoning}</p>
            </div>

            {/* Impact */}
            {result.impact && (
              <div className="bg-white rounded-2xl border p-4 space-y-3">
                <p className="text-xs font-bold text-gray-700 flex items-center gap-1">
                  <TrendingDown size={12} /> Impact Analysis
                </p>
                {result.impact.savings_delay_days > 0 && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-50 border border-red-100">
                    <Clock size={14} className="text-red-500" />
                    <p className="text-xs text-red-800">
                      Delays savings by <strong>{result.impact.savings_delay_days} days</strong>
                    </p>
                  </div>
                )}
                {result.impact.goal_affected && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 border border-amber-100">
                    <Sparkles size={14} className="text-amber-500" />
                    <p className="text-xs text-amber-800">Affects: {result.impact.goal_affected}</p>
                  </div>
                )}
                <p className="text-xs text-gray-600">Budget: {result.impact.budget_status}</p>
                <p className="text-xs text-gray-600">Instead: {result.impact.opportunity_cost}</p>
              </div>
            )}

            {/* Alternatives */}
            {result.alternatives?.length > 0 && (
              <div className="bg-white rounded-2xl border p-4">
                <p className="text-xs font-bold text-gray-700 mb-2 flex items-center gap-1">
                  <Lightbulb size={12} /> Better Options
                </p>
                <ul className="space-y-1.5">
                  {result.alternatives.map((alt, i) => (
                    <li key={i} className="text-sm text-gray-800 flex items-start gap-2">
                      <span className="text-violet-500 shrink-0">→</span> {alt}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* AI Advice */}
            {result.ai_advice && (
              <div className="bg-gradient-to-br from-violet-50 to-indigo-50 rounded-2xl border border-violet-200 p-4">
                <p className="text-sm text-violet-900 italic">"{result.ai_advice}"</p>
              </div>
            )}

            {/* Ask another */}
            <button
              type="button"
              onClick={() => { setResult(null); setQuestion(''); }}
              className="w-full py-3 text-sm text-violet-600 font-medium"
            >
              Ask another question
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
