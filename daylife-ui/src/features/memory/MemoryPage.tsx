import React, { useState } from 'react';
import { Brain, Clock, Lightbulb, Target, MessageSquare, Check, Trash2 } from 'lucide-react';
import { getMemories, markMemoryActioned, getMemorySummary, getStaleMemories, type MemoryEntry } from '../../lib/lifeAutopilot';
import { cn } from '../../lib/utils';

const TYPE_ICON: Record<MemoryEntry['type'], React.ReactNode> = {
  promise: <Target size={14} className="text-amber-600" />,
  idea: <Lightbulb size={14} className="text-violet-600" />,
  goal: <Target size={14} className="text-emerald-600" />,
  note: <MessageSquare size={14} className="text-blue-600" />,
  voice_input: <MessageSquare size={14} className="text-gray-500" />,
};

const TYPE_LABEL: Record<MemoryEntry['type'], string> = {
  promise: 'Promise',
  idea: 'Idea',
  goal: 'Goal',
  note: 'Note',
  voice_input: 'Voice Input',
};

export default function MemoryPage() {
  const [filter, setFilter] = useState<MemoryEntry['type'] | 'all' | 'stale'>('all');
  const [refresh, setRefresh] = useState(0);

  const allMemories = getMemories();
  const summary = getMemorySummary();
  const stale = getStaleMemories(14);

  const filtered = filter === 'all'
    ? allMemories
    : filter === 'stale'
      ? stale
      : allMemories.filter((m) => m.type === filter);

  const sorted = [...filtered].reverse();

  function handleAction(id: string) {
    markMemoryActioned(id);
    setRefresh((v) => v + 1);
  }

  function daysSince(date: string): number {
    return Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="px-4 pt-6 pb-4">
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Brain size={22} className="text-indigo-600" />
          AI Memory
        </h1>
        <p className="text-sm text-gray-500 mt-1">Everything Rozka remembers about you</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-2 px-4 mb-4">
        <div className="bg-white rounded-xl p-2.5 text-center border border-gray-100">
          <p className="text-lg font-bold text-indigo-700">{summary.total}</p>
          <p className="text-[10px] text-gray-500">Total</p>
        </div>
        <div className="bg-white rounded-xl p-2.5 text-center border border-gray-100">
          <p className="text-lg font-bold text-amber-600">{summary.promises}</p>
          <p className="text-[10px] text-gray-500">Promises</p>
        </div>
        <div className="bg-white rounded-xl p-2.5 text-center border border-gray-100">
          <p className="text-lg font-bold text-violet-600">{summary.ideas}</p>
          <p className="text-[10px] text-gray-500">Ideas</p>
        </div>
        <div className="bg-white rounded-xl p-2.5 text-center border border-gray-100">
          <p className="text-lg font-bold text-red-600">{summary.unactioned}</p>
          <p className="text-[10px] text-gray-500">Pending</p>
        </div>
      </div>

      {/* Stale warning */}
      {stale.length > 0 && (
        <div className="mx-4 mb-4 p-3 rounded-xl bg-red-50 border border-red-200">
          <p className="text-xs font-bold text-red-700 mb-1">
            {stale.length} forgotten {stale.length === 1 ? 'item' : 'items'}
          </p>
          <p className="text-xs text-red-600">
            You made {stale.length === 1 ? 'a promise/idea' : 'promises/ideas'} over 14 days ago with no action.
          </p>
        </div>
      )}

      {/* Filter chips */}
      <div className="flex gap-2 px-4 overflow-x-auto pb-3 no-scrollbar">
        {(['all', 'promise', 'idea', 'goal', 'voice_input', 'stale'] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors border',
              filter === f
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-gray-700 border-gray-200',
            )}
          >
            {f === 'all' ? 'All' : f === 'stale' ? `Stale (${stale.length})` : TYPE_LABEL[f]}
          </button>
        ))}
      </div>

      {/* Memory list */}
      <div className="px-4 space-y-2">
        {sorted.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <Brain size={40} className="mx-auto mb-3 opacity-50" />
            <p className="text-sm">No memories yet. Start talking to Rozka!</p>
          </div>
        )}
        {sorted.map((m) => (
          <div
            key={m.id}
            className={cn(
              'rounded-xl p-3 border bg-white',
              m.actionTaken ? 'border-green-200 bg-green-50/30' : 'border-gray-100',
            )}
          >
            <div className="flex items-start gap-2">
              <div className="shrink-0 mt-0.5">{TYPE_ICON[m.type]}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900">{m.content}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-[10px] text-gray-400 flex items-center gap-1">
                    <Clock size={10} />
                    {daysSince(m.date) === 0 ? 'today' : `${daysSince(m.date)}d ago`}
                  </span>
                  <span className={cn(
                    'text-[10px] px-1.5 py-0.5 rounded-full font-medium',
                    m.type === 'promise' ? 'bg-amber-100 text-amber-700' :
                    m.type === 'idea' ? 'bg-violet-100 text-violet-700' :
                    m.type === 'goal' ? 'bg-emerald-100 text-emerald-700' :
                    'bg-gray-100 text-gray-600'
                  )}>
                    {TYPE_LABEL[m.type]}
                  </span>
                  {m.actionTaken && (
                    <span className="text-[10px] text-green-600 flex items-center gap-0.5">
                      <Check size={10} /> Done
                    </span>
                  )}
                </div>
              </div>
              {!m.actionTaken && m.type !== 'voice_input' && (
                <button
                  type="button"
                  onClick={() => handleAction(m.id)}
                  className="shrink-0 w-7 h-7 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center"
                  title="Mark as done"
                >
                  <Check size={14} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
