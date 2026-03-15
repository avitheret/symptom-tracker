import { type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../utils/cn';

/* ── Card ──────────────────────────────────────────────────────── */

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children:    ReactNode;
  /** Apply standard internal padding (default true) */
  padding?:    boolean;
  /** Render a dashed border (for "add" / empty-slot cards) */
  dashed?:     boolean;
  /** Scale slightly on press — for tappable cards */
  interactive?: boolean;
}

export function Card({
  children,
  padding      = true,
  dashed       = false,
  interactive  = false,
  className,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        'bg-white rounded-2xl border shadow-sm',
        dashed   ? 'border-dashed border-slate-200' : 'border-slate-100',
        padding  ? 'p-4' : '',
        interactive && 'cursor-pointer active:scale-[0.98] transition-transform hover:border-slate-200',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/* ── CardHeader ────────────────────────────────────────────────── */

interface CardHeaderProps {
  title:     string;
  subtitle?: string;
  action?:   ReactNode;
  className?: string;
}

export function CardHeader({ title, subtitle, action, className }: CardHeaderProps) {
  return (
    <div className={cn('flex items-center justify-between mb-3', className)}>
      <div>
        <p className="text-sm font-semibold text-slate-800">{title}</p>
        {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}
