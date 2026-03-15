import { type ReactNode } from 'react';
import { cn } from '../../utils/cn';

export type BadgeVariant =
  | 'default'
  | 'primary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'neutral';

const VARIANT_CLASS: Record<BadgeVariant, string> = {
  default: 'bg-slate-100  text-slate-600',
  primary: 'bg-blue-100 text-blue-700',
  success: 'bg-green-100  text-green-700',
  warning: 'bg-amber-100  text-amber-700',
  danger:  'bg-red-100    text-red-600',
  info:    'bg-sky-100    text-sky-700',
  neutral: 'bg-slate-50   text-slate-500',
};

interface BadgeProps {
  variant?:  BadgeVariant;
  children:  ReactNode;
  className?: string;
}

/** Compact status badge / label */
export function Badge({ variant = 'default', children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium leading-none',
        VARIANT_CLASS[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Severity badge — automatically picks colour based on 1–10 score */
export function SeverityBadge({ severity }: { severity: number }) {
  const variant: BadgeVariant =
    severity >= 7 ? 'danger' :
    severity >= 4 ? 'warning' :
    'success';

  return (
    <span
      className={cn(
        'inline-flex items-center tabular-nums px-2.5 py-1 rounded-full text-xs font-bold',
        VARIANT_CLASS[variant],
      )}
    >
      {severity}/10
    </span>
  );
}
