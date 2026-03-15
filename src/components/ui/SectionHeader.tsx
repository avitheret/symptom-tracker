import { type ReactNode } from 'react';
import { cn } from '../../utils/cn';

interface SectionAction {
  label:   string;
  onClick: () => void;
}

interface SectionHeaderProps {
  title:      string;
  action?:    SectionAction;
  /** Optional trailing content (e.g. icon button) */
  trailing?:  ReactNode;
  className?: string;
}

/**
 * SectionHeader — standardised section title row.
 *
 * Renders a small uppercase label on the left and an optional
 * text-link action on the right.
 *
 * Usage:
 *  <SectionHeader
 *    title="Recent Log"
 *    action={{ label: 'See all →', onClick: () => setView('reports') }}
 *  />
 */
export function SectionHeader({ title, action, trailing, className }: SectionHeaderProps) {
  return (
    <div className={cn('flex items-center justify-between mb-3', className)}>
      <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest leading-none">
        {title}
      </h2>
      {(action || trailing) && (
        <div className="flex items-center gap-1 -mr-1">
          {action && (
            <button
              onClick={action.onClick}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 py-1 px-2 rounded-lg hover:bg-blue-50 active:bg-blue-100 transition-colors min-h-[32px]"
            >
              {action.label}
            </button>
          )}
          {trailing}
        </div>
      )}
    </div>
  );
}
