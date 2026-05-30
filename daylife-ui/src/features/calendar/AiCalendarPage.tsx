import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  subMonths,
} from 'date-fns';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  CheckSquare,
  Bell,
  Receipt,
  StickyNote,
  Loader2,
} from 'lucide-react';
import { api, type CalendarEvent, type CalendarEventsResponse } from '../../lib/api';
import { useDateStore } from '../../lib/dateStore';
import { formatMonthHeading, todayISO } from '../../lib/format';
import { aiPlanCalendarWeek, monthBounds } from '../../lib/aiCalendar';
import { executeVoiceActions, voiceQueryKeysToInvalidate } from '../../lib/executeVoiceCommands';
import { useAuth } from '../auth/AuthContext';
import { PageHeader } from '../../components/PageHeader';
import { toast } from '../../components/Toaster';
import { cn } from '../../lib/utils';
import { AREA_COLORS, AREA_LABELS } from '../../lib/utils';

const KIND_META: Record<
  CalendarEvent['kind'],
  { icon: typeof CheckSquare; color: string; label: string }
> = {
  task: { icon: CheckSquare, color: 'text-blue-600 bg-blue-50 border-blue-100', label: 'Task' },
  reminder: { icon: Bell, color: 'text-rose-600 bg-rose-50 border-rose-100', label: 'Date' },
  expense: { icon: Receipt, color: 'text-orange-600 bg-orange-50 border-orange-100', label: 'Money' },
  note: { icon: StickyNote, color: 'text-gray-600 bg-gray-50 border-gray-100', label: 'Note' },
};

function buildMonthGrid(monthKey: string): (Date | null)[] {
  const [y, m] = monthKey.split('-').map(Number);
  const start = startOfMonth(new Date(y, m - 1, 1));
  const end = endOfMonth(start);
  const pad = (start.getDay() + 6) % 7;
  const cells: (Date | null)[] = Array(pad).fill(null);
  eachDayOfInterval({ start, end }).forEach((d) => cells.push(d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function AiCalendarPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const selectedDate = useDateStore((s) => s.selectedDate);
  const setSelectedDate = useDateStore((s) => s.setSelectedDate);
  const [viewMonth, setViewMonth] = React.useState(() => selectedDate.slice(0, 7));
  const [planSummary, setPlanSummary] = React.useState('');

  const { from, to } = monthBounds(viewMonth);

  const { data, isLoading } = useQuery<CalendarEventsResponse>({
    queryKey: ['calendar', from, to],
    queryFn: () => api.get(`/calendar/events?from=${from}&to=${to}`),
  });

  const dayEvents =
    data?.events.filter((e) => e.date === selectedDate) ?? [];
  const counts = data?.countsByDate ?? {};
  const grid = buildMonthGrid(viewMonth);

  const aiPlan = useMutation({
    mutationFn: () => aiPlanCalendarWeek(selectedDate),
    onSuccess: async (plan) => {
      setPlanSummary(plan.summary);
      if (!user?.id || plan.actions.length === 0) return;
      const result = await executeVoiceActions(plan.actions, user.id);
      voiceQueryKeysToInvalidate().forEach((key) => {
        queryClient.invalidateQueries({ queryKey: key });
      });
      queryClient.invalidateQueries({ queryKey: ['calendar'] });
      if (result.ok.length > 0) {
        toast.success(`AI calendar: added ${result.ok.length} item${result.ok.length > 1 ? 's' : ''}`);
      }
    },
    onError: () => toast.error('Could not plan week'),
  });

  const pickDay = (d: Date) => {
    const iso = format(d, 'yyyy-MM-dd');
    setSelectedDate(iso);
    if (!isSameMonth(d, parseISO(`${viewMonth}-01`))) {
      setViewMonth(iso.slice(0, 7));
    }
  };

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto space-y-5">
      <PageHeader
        theme="life"
        icon={Calendar}
        title="AI Calendar"
        subtitle="Tasks, dates, money & notes — AI plans your week"
        hint="Tap a day · hold voice on Today for WhatsApp-style add"
        action={
          <Link
            to="/"
            className="text-xs font-semibold text-white/90 bg-white/20 px-3 py-1.5 rounded-lg hover:bg-white/30 shrink-0"
          >
            Today →
          </Link>
        }
      />

      <section className="rounded-2xl border bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b bg-gradient-to-r from-violet-50 to-indigo-50">
          <button
            type="button"
            onClick={() => setViewMonth(format(subMonths(parseISO(`${viewMonth}-01`), 1), 'yyyy-MM'))}
            className="p-2 rounded-lg hover:bg-white/80 touch-manipulation"
            aria-label="Previous month"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="text-center">
            <h2 className="font-bold text-gray-900">{formatMonthHeading(viewMonth)}</h2>
            <button
              type="button"
              onClick={() => {
                setViewMonth(todayISO().slice(0, 7));
                setSelectedDate(todayISO());
              }}
              className="text-xs text-violet-600 font-medium mt-0.5 touch-manipulation"
            >
              Jump to today
            </button>
          </div>
          <button
            type="button"
            onClick={() => setViewMonth(format(addMonths(parseISO(`${viewMonth}-01`), 1), 'yyyy-MM'))}
            className="p-2 rounded-lg hover:bg-white/80 touch-manipulation"
            aria-label="Next month"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-px bg-gray-100 p-px">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
            <div key={d} className="bg-gray-50 text-[10px] font-semibold text-gray-500 text-center py-2">
              {d}
            </div>
          ))}
          {grid.map((day, i) => {
            if (!day) return <div key={`empty-${i}`} className="bg-white min-h-[3.25rem]" />;
            const iso = format(day, 'yyyy-MM-dd');
            const count = counts[iso] ?? 0;
            const selected = iso === selectedDate;
            const today = isToday(day);
            return (
              <button
                key={iso}
                type="button"
                onClick={() => pickDay(day)}
                className={cn(
                  'bg-white min-h-[3.25rem] p-1 flex flex-col items-center touch-manipulation',
                  selected && 'ring-2 ring-inset ring-violet-500 bg-violet-50',
                  !selected && 'hover:bg-gray-50',
                )}
              >
                <span
                  className={cn(
                    'text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full',
                    today && 'bg-violet-600 text-white',
                    !today && selected && 'text-violet-700',
                    !today && !selected && 'text-gray-800',
                  )}
                >
                  {format(day, 'd')}
                </span>
                {count > 0 && (
                  <span className="mt-0.5 flex gap-0.5">
                    {count <= 3 ? (
                      Array.from({ length: Math.min(count, 3) }).map((_, j) => (
                        <span key={j} className="w-1.5 h-1.5 rounded-full bg-violet-500" />
                      ))
                    ) : (
                      <span className="text-[9px] font-bold text-violet-600">{count}</span>
                    )}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-white p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-600 text-white flex items-center justify-center shrink-0">
            <Sparkles size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-gray-900">AI plan this week</h3>
            <p className="text-sm text-gray-600 mt-0.5">
              Rozka AI reads your calendar and spreads tasks across the week automatically.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => aiPlan.mutate()}
          disabled={aiPlan.isPending}
          className="w-full py-3 rounded-xl bg-violet-600 text-white font-semibold flex items-center justify-center gap-2 hover:bg-violet-700 disabled:opacity-60 touch-manipulation"
        >
          {aiPlan.isPending ? (
            <>
              <Loader2 size={18} className="animate-spin" /> AI planning…
            </>
          ) : (
            <>
              <Sparkles size={18} /> AI fill my week
            </>
          )}
        </button>
        {planSummary && (
          <p className="text-sm text-violet-800 bg-violet-100/80 rounded-xl px-3 py-2">{planSummary}</p>
        )}
      </section>

      <section className="rounded-2xl border bg-white shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">
            {isSameDay(parseISO(selectedDate), new Date()) ? 'Today' : format(parseISO(selectedDate), 'EEE, MMM d')}
          </h3>
          <span className="text-xs text-gray-500">{dayEvents.length} items</span>
        </div>
        {isLoading ? (
          <div className="p-8 flex justify-center">
            <Loader2 className="animate-spin text-violet-600" size={24} />
          </div>
        ) : dayEvents.length === 0 ? (
          <p className="p-6 text-sm text-gray-500 text-center">
            Nothing on this day — use voice on Today or AI plan week above.
          </p>
        ) : (
          <ul className="divide-y">
            {dayEvents.map((ev) => {
              const meta = KIND_META[ev.kind];
              const Icon = meta.icon;
              return (
                <li key={ev.id} className="flex items-start gap-3 px-4 py-3">
                  <div className={cn('p-2 rounded-lg border shrink-0', meta.color)}>
                    <Icon size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={cn('font-medium text-sm truncate', ev.done && 'line-through text-gray-400')}>
                      {ev.title}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5 flex flex-wrap items-center gap-1">
                      <span>{meta.label}</span>
                      {ev.kind === 'task' && ev.subtitle && (
                        <span className={cn('px-1.5 py-0.5 rounded-full text-[10px]', AREA_COLORS[ev.subtitle as keyof typeof AREA_COLORS] || 'bg-gray-100')}>
                          {AREA_LABELS[ev.subtitle as keyof typeof AREA_LABELS] || ev.subtitle}
                        </span>
                      )}
                      {ev.kind !== 'task' && ev.subtitle && <span>· {ev.subtitle}</span>}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <div className="px-4 py-3 border-t bg-gray-50 flex flex-wrap gap-2">
          <Link to="/tasks" className="text-xs font-medium text-blue-600 hover:underline">
            All tasks →
          </Link>
          <Link to="/daily?tab=reminders" className="text-xs font-medium text-rose-600 hover:underline">
            Dates →
          </Link>
          <Link to="/expenses" className="text-xs font-medium text-orange-600 hover:underline">
            Money →
          </Link>
        </div>
      </section>
    </div>
  );
}
