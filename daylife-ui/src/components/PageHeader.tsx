import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../lib/utils';

export type PageTheme = 'today' | 'tasks' | 'life' | 'vision' | 'money' | 'share' | 'neutral';

const THEME_STYLES: Record<
  PageTheme,
  { gradient: string; iconBg: string; iconColor: string; accent: string }
> = {
  today: {
    gradient: 'from-brand-600 via-teal-600 to-emerald-600',
    iconBg: 'bg-white/20',
    iconColor: 'text-white',
    accent: 'text-teal-100',
  },
  tasks: {
    gradient: 'from-blue-600 via-indigo-600 to-violet-600',
    iconBg: 'bg-white/20',
    iconColor: 'text-white',
    accent: 'text-blue-100',
  },
  life: {
    gradient: 'from-emerald-600 via-green-600 to-teal-600',
    iconBg: 'bg-white/20',
    iconColor: 'text-white',
    accent: 'text-emerald-100',
  },
  vision: {
    gradient: 'from-violet-600 via-purple-600 to-fuchsia-600',
    iconBg: 'bg-white/20',
    iconColor: 'text-white',
    accent: 'text-violet-100',
  },
  money: {
    gradient: 'from-amber-600 via-orange-600 to-rose-600',
    iconBg: 'bg-white/20',
    iconColor: 'text-white',
    accent: 'text-amber-100',
  },
  share: {
    gradient: 'from-violet-500 via-purple-500 to-indigo-600',
    iconBg: 'bg-white/20',
    iconColor: 'text-white',
    accent: 'text-violet-100',
  },
  neutral: {
    gradient: 'from-gray-700 to-gray-900',
    iconBg: 'bg-white/20',
    iconColor: 'text-white',
    accent: 'text-gray-200',
  },
};

interface Props {
  theme: PageTheme;
  icon: LucideIcon;
  title: string;
  subtitle: string;
  hint?: string;
  action?: React.ReactNode;
  className?: string;
}

export function PageHeader({ theme, icon: Icon, title, subtitle, hint, action, className }: Props) {
  const styles = THEME_STYLES[theme];
  return (
    <div
      className={cn(
        'rounded-2xl bg-gradient-to-br p-5 text-white shadow-sm',
        styles.gradient,
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center shrink-0', styles.iconBg)}>
            <Icon size={22} className={styles.iconColor} />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold leading-tight">{title}</h1>
            <p className={cn('text-sm mt-0.5', styles.accent)}>{subtitle}</p>
            {hint && <p className="text-xs mt-2 text-white/80">{hint}</p>}
          </div>
        </div>
        {action}
      </div>
    </div>
  );
}

interface DaySectionProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  accent?: 'blue' | 'green' | 'amber' | 'rose' | 'violet' | 'orange';
  children: React.ReactNode;
  className?: string;
}

const ACCENT_BORDER: Record<NonNullable<DaySectionProps['accent']>, string> = {
  blue: 'border-l-blue-500 bg-blue-50/40',
  green: 'border-l-emerald-500 bg-emerald-50/40',
  amber: 'border-l-amber-500 bg-amber-50/40',
  rose: 'border-l-rose-500 bg-rose-50/40',
  violet: 'border-l-violet-500 bg-violet-50/40',
  orange: 'border-l-orange-500 bg-orange-50/40',
};

const ACCENT_ICON: Record<NonNullable<DaySectionProps['accent']>, string> = {
  blue: 'text-blue-600',
  green: 'text-emerald-600',
  amber: 'text-amber-600',
  rose: 'text-rose-600',
  violet: 'text-violet-600',
  orange: 'text-orange-600',
};

export function DaySection({
  icon: Icon,
  title,
  subtitle,
  action,
  accent = 'blue',
  children,
  className,
}: DaySectionProps) {
  return (
    <section
      className={cn(
        'rounded-2xl border border-gray-200 border-l-4 overflow-hidden',
        ACCENT_BORDER[accent],
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2 px-4 py-3 bg-white/80 border-b border-gray-100">
        <div className="flex items-center gap-2 min-w-0">
          <Icon size={18} className={cn('shrink-0', ACCENT_ICON[accent])} />
          <div className="min-w-0">
            <h2 className="font-semibold text-gray-900 text-sm">{title}</h2>
            {subtitle && <p className="text-xs text-gray-500 truncate">{subtitle}</p>}
          </div>
        </div>
        {action}
      </div>
      <div className="p-4 bg-white">{children}</div>
    </section>
  );
}
