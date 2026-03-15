import { cn } from '../../utils/cn';

interface StatCardProps {
  value:       string | number;
  label:       string;
  /** Tailwind bg colour class for the decorative circle (e.g. "bg-blue-600") */
  accentClass?: string;
  className?:  string;
}

/**
 * StatCard — large-number stat widget used on Dashboard and Reports.
 *
 * Usage:
 *  <StatCard value={63} label="Total" accentClass="bg-blue-600" />
 */
export function StatCard({ value, label, accentClass = 'bg-blue-600', className }: StatCardProps) {
  return (
    <div
      className={cn(
        'bg-white rounded-2xl border border-slate-100 shadow-sm',
        'px-3 py-3 sm:px-4 sm:py-4 overflow-hidden relative',
        className,
      )}
    >
      {/* Decorative circle */}
      <div
        className={cn(
          'absolute -right-3 -top-3 w-14 h-14 rounded-full opacity-[0.08]',
          accentClass,
        )}
      />
      <p className="text-2xl sm:text-3xl font-black text-slate-900 leading-none tabular-nums">
        {value}
      </p>
      <p className="text-xs font-medium text-slate-400 mt-1.5 leading-tight uppercase tracking-wide">
        {label}
      </p>
    </div>
  );
}
