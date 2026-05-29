import { Link } from 'react-router-dom';
import { Sun, ShoppingCart, Moon, Bell } from 'lucide-react';
import { getDayPhase, phaseLabel } from '../lib/dailyFlow';
import { cn } from '../lib/utils';

type Tab = 'shopping' | 'routines' | 'reminders';

interface DailyFlowStripProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  routineDone?: number;
  routineTotal?: number;
  shoppingPending?: number;
}

export function DailyFlowStrip({
  activeTab,
  onTabChange,
  routineDone = 0,
  routineTotal = 0,
  shoppingPending = 0,
}: DailyFlowStripProps) {
  const phase = getDayPhase();

  const chips: Array<{ id: Tab; label: string; icon: typeof Sun; badge?: string }> = [
    {
      id: 'routines',
      label: phase === 'evening' ? 'Evening' : 'Morning',
      icon: phase === 'evening' ? Moon : Sun,
      badge: routineTotal > 0 ? `${routineDone}/${routineTotal}` : undefined,
    },
    { id: 'shopping', label: 'Shopping', icon: ShoppingCart, badge: shoppingPending > 0 ? String(shoppingPending) : undefined },
    { id: 'reminders', label: 'Dates', icon: Bell },
  ];

  return (
    <div className="rounded-2xl border border-emerald-100 bg-white p-3 sm:p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-emerald-800">
          {phaseLabel(phase)} flow — pick what you need
        </p>
        <Link to="/" className="text-xs text-brand-600 font-medium hover:underline shrink-0">
          Back to Today
        </Link>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {chips.map(({ id, label, icon: Icon, badge }) => (
          <button
            key={id}
            type="button"
            onClick={() => onTabChange(id)}
            className={cn(
              'relative flex flex-col items-center gap-1 py-3 px-2 rounded-xl border text-center touch-manipulation transition-colors',
              activeTab === id
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-emerald-50 hover:border-emerald-200',
            )}
          >
            <Icon size={20} />
            <span className="text-xs font-semibold">{label}</span>
            {badge && (
              <span
                className={cn(
                  'absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center',
                  activeTab === id ? 'bg-white text-emerald-700' : 'bg-emerald-600 text-white',
                )}
              >
                {badge}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
