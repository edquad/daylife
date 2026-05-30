import { Mic, Sparkles, Sun, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '../lib/utils';

interface SimpleTodayHeroProps {
  greeting: string;
  done: number;
  total: number;
  showMorningSetup: boolean;
  morningLoading?: boolean;
  onVoice: () => void;
  onMorningSetup: () => void;
}

export function SimpleTodayHero({
  greeting,
  done,
  total,
  showMorningSetup,
  morningLoading,
  onVoice,
  onMorningSetup,
}: SimpleTodayHeroProps) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <section className="rounded-2xl bg-gradient-to-br from-brand-600 to-teal-600 text-white p-5 shadow-md space-y-4">
      <div>
        <p className="text-sm text-white/85">{greeting}</p>
        <h2 className="text-xl font-bold mt-0.5">Your simple day</h2>
        {total > 0 && (
          <div className="mt-3">
            <div className="flex justify-between text-xs text-white/90 mb-1">
              <span>{done} of {total} done</span>
              <span>{pct}%</span>
            </div>
            <div className="h-2 bg-white/20 rounded-full overflow-hidden">
              <div className="h-full bg-white rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          type="button"
          onClick={onVoice}
          className="flex items-center gap-3 p-4 rounded-xl bg-white/15 hover:bg-white/25 active:scale-[0.98] touch-manipulation text-left"
        >
          <div className="w-12 h-12 rounded-full bg-white text-violet-600 flex items-center justify-center shrink-0">
            <Mic size={24} />
          </div>
          <div>
            <p className="font-semibold">Speak or type</p>
            <p className="text-xs text-white/85">Hindi / English — AI fixes mistakes</p>
          </div>
        </button>

        {showMorningSetup && (
          <button
            type="button"
            onClick={onMorningSetup}
            disabled={morningLoading}
            className={cn(
              'flex items-center gap-3 p-4 rounded-xl bg-amber-400/90 text-amber-950 hover:bg-amber-300 active:scale-[0.98] touch-manipulation text-left',
              morningLoading && 'opacity-70',
            )}
          >
            <div className="w-12 h-12 rounded-full bg-white/90 text-amber-600 flex items-center justify-center shrink-0">
              {morningLoading ? <Sparkles size={24} className="animate-pulse" /> : <Sun size={24} />}
            </div>
            <div>
              <p className="font-semibold">Fill my morning</p>
              <p className="text-xs text-amber-900/80">AI adds today&apos;s tasks from routines</p>
            </div>
          </button>
        )}
      </div>
    </section>
  );
}

export function SimpleMoreToggle({
  open,
  onToggle,
  label,
}: {
  open: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center justify-center gap-1 py-2 text-sm text-gray-500 hover:text-gray-700 touch-manipulation"
    >
      {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      {label}
    </button>
  );
}
