import { Link } from 'react-router-dom';
import { Sun, Moon, CheckCircle2, Circle, ChevronRight, Pencil } from 'lucide-react';
import type { RoutineToday } from '../lib/api';
import { getDayPhase, phaseLabel } from '../lib/dailyFlow';
import { cn } from '../lib/utils';

interface DailyRhythmSectionProps {
  routines: RoutineToday[];
  selectedDate: string;
  isToday: boolean;
  onToggleItem: (routineId: string, itemId: string) => void;
  toggling?: boolean;
}

function RoutineBlock({
  routine,
  highlight,
  isToday,
  onToggleItem,
  toggling,
}: {
  routine: RoutineToday;
  highlight: boolean;
  isToday: boolean;
  onToggleItem: (routineId: string, itemId: string) => void;
  toggling?: boolean;
}) {
  const Icon = routine.timeOfDay === 'EVENING' ? Moon : Sun;
  const progress = routine.total > 0 ? Math.round((routine.done / routine.total) * 100) : 0;
  const pending = routine.items.filter((i) => !i.done);
  const nextItems = pending.slice(0, 5);

  return (
    <div
      className={cn(
        'rounded-xl border p-3 sm:p-4 transition-shadow',
        highlight ? 'border-amber-300 bg-amber-50/80 shadow-sm' : 'border-gray-200 bg-white/90',
      )}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', highlight ? 'bg-amber-100' : 'bg-gray-100')}>
            <Icon size={18} className={highlight ? 'text-amber-600' : 'text-gray-500'} />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">{routine.name}</p>
            <p className="text-xs text-gray-500">{routine.done}/{routine.total} done · {progress}%</p>
          </div>
        </div>
        <Link
          to="/daily?tab=routines"
          className="p-2 text-gray-400 hover:text-amber-600 shrink-0"
          title="Edit routine"
        >
          <Pencil size={14} />
        </Link>
      </div>

      <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden mb-3">
        <div
          className={cn('h-full rounded-full transition-all', highlight ? 'bg-amber-500' : 'bg-gray-400')}
          style={{ width: `${progress}%` }}
        />
      </div>

      {routine.total === 0 ? (
        <p className="text-xs text-gray-500">No steps yet — tap edit to add your routine.</p>
      ) : nextItems.length === 0 ? (
        <p className="text-sm text-green-700 font-medium flex items-center gap-1">
          <CheckCircle2 size={16} /> All done for today
        </p>
      ) : (
        <ul className="space-y-1">
          {nextItems.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                disabled={!isToday || toggling}
                onClick={() => onToggleItem(routine.id, item.id)}
                className={cn(
                  'w-full flex items-center gap-2.5 py-2 px-2 -mx-2 rounded-lg text-left text-sm touch-manipulation',
                  isToday ? 'hover:bg-amber-100/80 active:bg-amber-100' : 'opacity-60 cursor-default',
                )}
              >
                <Circle size={18} className={cn('shrink-0', highlight ? 'text-amber-400' : 'text-gray-300')} />
                <span className="truncate">{item.label}</span>
              </button>
            </li>
          ))}
          {pending.length > 5 && (
            <Link to="/daily?tab=routines" className="block text-xs text-amber-700 font-medium pt-1 pl-9">
              +{pending.length - 5} more steps
            </Link>
          )}
        </ul>
      )}
    </div>
  );
}

export function DailyRhythmSection({
  routines,
  selectedDate,
  isToday,
  onToggleItem,
  toggling,
}: DailyRhythmSectionProps) {
  const phase = getDayPhase();
  const morning = routines.find((r) => r.timeOfDay === 'MORNING');
  const evening = routines.find((r) => r.timeOfDay === 'EVENING');
  const other = routines.filter((r) => r.timeOfDay !== 'MORNING' && r.timeOfDay !== 'EVENING');

  if (routines.length === 0) {
    return (
      <section className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-4 sm:p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">Daily rhythm</p>
        <h2 className="text-lg font-bold text-amber-950 mt-1">Build your morning & evening flow</h2>
        <p className="text-sm text-amber-900/80 mt-1">Wake up, skincare, walk, wind down — tap presets or make your own.</p>
        <Link
          to="/daily?tab=routines"
          className="mt-3 inline-flex items-center gap-1 px-4 py-2.5 bg-amber-600 text-white rounded-xl text-sm font-semibold hover:bg-amber-700"
        >
          Set up routines <ChevronRight size={16} />
        </Link>
      </section>
    );
  }

  const totalDone = routines.reduce((s, r) => s + r.done, 0);
  const totalItems = routines.reduce((s, r) => s + r.total, 0);

  return (
    <section className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-violet-50 p-4 sm:p-5 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-amber-800">
            Daily rhythm · {phaseLabel(phase)}
          </p>
          <h2 className="text-lg font-bold text-gray-900 mt-0.5">Your habits today</h2>
          <p className="text-xs text-gray-600 mt-0.5">
            {isToday ? 'Tap to check off — no need to leave this page.' : `Viewing ${selectedDate}`}
            {totalItems > 0 && ` · ${totalDone}/${totalItems} done`}
          </p>
        </div>
        <Link
          to="/daily?tab=routines"
          className="text-xs font-medium text-amber-700 hover:underline shrink-0 pt-1"
        >
          Full list →
        </Link>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        {morning && (
          <RoutineBlock
            routine={morning}
            highlight={phase === 'morning'}
            isToday={isToday}
            onToggleItem={onToggleItem}
            toggling={toggling}
          />
        )}
        {evening && (
          <RoutineBlock
            routine={evening}
            highlight={phase === 'evening'}
            isToday={isToday}
            onToggleItem={onToggleItem}
            toggling={toggling}
          />
        )}
        {other.map((r) => (
          <RoutineBlock
            key={r.id}
            routine={r}
            highlight={false}
            isToday={isToday}
            onToggleItem={onToggleItem}
            toggling={toggling}
          />
        ))}
      </div>
    </section>
  );
}
