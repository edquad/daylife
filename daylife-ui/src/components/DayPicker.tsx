import React from 'react';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { useDateStore } from '../lib/dateStore';
import { formatDayHeading, shiftDay, todayISO } from '../lib/format';
import { cn } from '../lib/utils';

interface DayPickerProps {
  compact?: boolean;
  className?: string;
}

export function DayPicker({ compact, className }: DayPickerProps) {
  const { selectedDate, setSelectedDate, goToday } = useDateStore();
  const isTodaySelected = selectedDate === todayISO();

  return (
    <div className={cn('flex items-center gap-1', className)}>
      <button
        type="button"
        onClick={() => setSelectedDate(shiftDay(selectedDate, -1))}
        className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
        title="Previous day"
      >
        <ChevronLeft size={compact ? 18 : 20} />
      </button>

      <div className="flex items-center gap-2 min-w-0">
        {!compact && <Calendar size={16} className="text-brand-600 shrink-0 hidden sm:block" />}
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
          className={cn(
            'border rounded-lg bg-white focus:ring-2 focus:ring-brand-500 outline-none',
            compact ? 'px-2 py-1 text-sm w-[130px]' : 'px-3 py-1.5 text-sm',
          )}
        />
        {!compact && (
          <span className="text-sm font-medium text-gray-700 hidden md:inline truncate">
            {formatDayHeading(selectedDate)}
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={() => setSelectedDate(shiftDay(selectedDate, 1))}
        className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
        title="Next day"
      >
        <ChevronRight size={compact ? 18 : 20} />
      </button>

      {!isTodaySelected && (
        <button
          type="button"
          onClick={goToday}
          className="ml-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-brand-50 text-brand-700 hover:bg-brand-100"
        >
          Today
        </button>
      )}
    </div>
  );
}
