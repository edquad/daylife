import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Sparkles, Lightbulb, Target, Plus, RefreshCw, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AI_COACH_NAME } from '../lib/brand';
import { getAiCoachInsight, type LifeSnapshot } from '../lib/aiCoach';
import { executeVoiceActions, voiceQueryKeysToInvalidate } from '../lib/executeVoiceCommands';
import { toast } from './Toaster';
import { cn } from '../lib/utils';

interface AiCoachCardProps {
  snapshot: LifeSnapshot;
  userId?: string;
  compact?: boolean;
}

export function AiCoachCard({ snapshot, userId, compact }: AiCoachCardProps) {
  const queryClient = useQueryClient();

  const { data: insight, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['ai-coach', snapshot.today, snapshot.tasksDone, snapshot.tasksTotal],
    queryFn: () => getAiCoachInsight(snapshot),
    staleTime: 1000 * 60 * 60 * 6,
  });

  const addSuggestions = async () => {
    if (!userId || !insight?.suggestedTasks.length) return;
    const result = await executeVoiceActions(insight.suggestedTasks, userId);
    voiceQueryKeysToInvalidate().forEach((key) => {
      queryClient.invalidateQueries({ queryKey: key });
    });
    if (result.ok.length > 0) {
      toast.success(`AI added ${result.ok.length} task${result.ok.length > 1 ? 's' : ''}`);
    }
  };

  return (
    <section
      className={cn(
        'rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 via-white to-indigo-50 overflow-hidden shadow-sm',
        compact ? 'p-4' : 'p-5',
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-violet-600 text-white flex items-center justify-center shrink-0">
            <Sparkles size={20} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-600">
              {AI_COACH_NAME} AI · life lesson
            </p>
            <h3 className="font-bold text-gray-900 truncate">Today&apos;s wisdom for you</h3>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void refetch()}
          disabled={isFetching}
          className="p-2 text-violet-600 hover:bg-violet-100 rounded-lg shrink-0 touch-manipulation"
          title="Refresh AI insight"
        >
          {isFetching ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-2 animate-pulse">
          <div className="h-4 bg-violet-100 rounded w-full" />
          <div className="h-4 bg-violet-100 rounded w-5/6" />
          <div className="h-3 bg-violet-50 rounded w-2/3 mt-3" />
        </div>
      ) : insight ? (
        <div className="space-y-3">
          <div className="flex gap-2">
            <Lightbulb size={16} className="text-amber-500 shrink-0 mt-0.5" />
            <p className="text-sm text-gray-800 leading-relaxed">{insight.lesson}</p>
          </div>
          {insight.futureStep && (
            <div className="flex gap-2 p-3 rounded-xl bg-indigo-50 border border-indigo-100">
              <Target size={16} className="text-indigo-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] font-semibold uppercase text-indigo-600 mb-0.5">Future plan</p>
                <p className="text-sm text-indigo-900">{insight.futureStep}</p>
              </div>
            </div>
          )}
          {insight.encouragement && (
            <p className="text-xs text-violet-700 italic px-1">{insight.encouragement}</p>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            {insight.suggestedTasks.length > 0 && userId && (
              <button
                type="button"
                onClick={() => void addSuggestions()}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-violet-600 text-white text-xs font-semibold hover:bg-violet-700 touch-manipulation"
              >
                <Plus size={14} /> AI add {insight.suggestedTasks.length} task
                {insight.suggestedTasks.length > 1 ? 's' : ''}
              </button>
            )}
            <Link
              to="/vision"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-violet-200 text-violet-700 text-xs font-semibold hover:bg-violet-50 touch-manipulation"
            >
              <Target size={14} /> AI future plan
            </Link>
          </div>
        </div>
      ) : null}
    </section>
  );
}
