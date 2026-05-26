import React from 'react';
import { Link } from 'react-router-dom';
import { LucideIcon } from 'lucide-react';
import { cn } from '../lib/utils';

interface SectionHeaderProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  action?: { label: string; to: string };
  className?: string;
  iconClassName?: string;
  iconColorClassName?: string;
}

export function SectionHeader({
  icon: Icon,
  title,
  subtitle,
  action,
  className,
  iconClassName,
  iconColorClassName,
}: SectionHeaderProps) {
  return (
    <div className={cn('flex items-start justify-between gap-3 mb-3', className)}>
      <div className="flex items-start gap-2.5 min-w-0">
        <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-brand-50', iconClassName)}>
          <Icon size={18} className={cn('text-brand-600', iconColorClassName)} />
        </div>
        <div className="min-w-0">
          <h2 className="font-bold text-gray-900">{title}</h2>
          {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {action && (
        <Link to={action.to} className="text-xs font-medium text-brand-600 hover:underline shrink-0 pt-1">
          {action.label}
        </Link>
      )}
    </div>
  );
}
