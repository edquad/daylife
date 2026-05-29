import { Link } from 'react-router-dom';
import { Star, Sun, CheckSquare, X, Sparkles } from 'lucide-react';
import { isWelcomeDone, markWelcomeDone } from '../lib/dailyFlow';

interface WelcomeDayCardProps {
  hasVision: boolean;
  hasTasks: boolean;
  hasRoutines?: boolean;
  onAddTask: () => void;
}

export function WelcomeDayCard({ hasVision, hasTasks, hasRoutines, onAddTask }: WelcomeDayCardProps) {
  if (isWelcomeDone()) return null;
  if (hasVision && hasTasks && hasRoutines) {
    markWelcomeDone();
    return null;
  }

  const steps = [
    {
      id: 'dream',
      done: hasVision,
      icon: Star,
      label: 'Add one dream or goal',
      hint: 'Your why — read it every morning',
      action: <Link to="/vision" className="text-xs font-semibold text-violet-700 hover:underline">Open vision board →</Link>,
    },
    {
      id: 'routine',
      done: !!hasRoutines,
      icon: Sun,
      label: 'Pick your morning & evening routine',
      hint: '3 presets ready — edit anytime',
      action: <Link to="/daily?tab=routines" className="text-xs font-semibold text-amber-700 hover:underline">Set routines →</Link>,
    },
    {
      id: 'task',
      done: hasTasks,
      icon: CheckSquare,
      label: 'Add one thing for today',
      hint: 'Just one task to start',
      action: (
        <button type="button" onClick={onAddTask} className="text-xs font-semibold text-brand-700 hover:underline">
          Add task →
        </button>
      ),
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;

  return (
    <section className="rounded-2xl border-2 border-brand-200 bg-gradient-to-br from-brand-50 to-teal-50 p-4 sm:p-5 relative">
      <button
        type="button"
        onClick={() => markWelcomeDone()}
        className="absolute top-3 right-3 p-1.5 text-gray-400 hover:text-gray-600"
        aria-label="Dismiss"
      >
        <X size={18} />
      </button>
      <div className="flex items-center gap-2 mb-2">
        <Sparkles size={18} className="text-brand-600" />
        <p className="font-semibold text-brand-900">Welcome — let&apos;s set up your day</p>
      </div>
      <p className="text-sm text-brand-800/90 mb-3 pr-6">
        3 quick steps so Rozka feels like home. {doneCount}/3 done.
      </p>
      <div className="space-y-2">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <div
              key={step.id}
              className={`flex items-start gap-3 p-3 rounded-xl border ${step.done ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'}`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${step.done ? 'bg-green-100' : 'bg-gray-100'}`}>
                <Icon size={16} className={step.done ? 'text-green-600' : 'text-gray-500'} />
              </div>
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-medium ${step.done ? 'text-green-800 line-through' : 'text-gray-900'}`}>
                  {step.label}
                </p>
                {!step.done && (
                  <>
                    <p className="text-xs text-gray-500 mt-0.5">{step.hint}</p>
                    <div className="mt-1.5">{step.action}</div>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
