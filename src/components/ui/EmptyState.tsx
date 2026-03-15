import { type ReactNode } from 'react';
import { cn } from '../../utils/cn';
import { Button } from './Button';

interface EmptyStateAction {
  label:   string;
  onClick: () => void;
  icon?:   ReactNode;
}

interface EmptyStateProps {
  icon?:        ReactNode;
  title:        string;
  description?: string;
  action?:      EmptyStateAction;
  className?:   string;
  /** Controls vertical padding (default: py-12) */
  compact?:     boolean;
}

/**
 * EmptyState — standardised empty / zero-data placeholder.
 *
 * Usage:
 *  <EmptyState
 *    icon={<Tag size={24} />}
 *    title="No conditions yet"
 *    description="Add a condition to start tracking."
 *    action={{ label: 'Add Condition', onClick: onAdd, icon: <Plus size={14} /> }}
 *  />
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center text-center gap-3',
        compact ? 'py-8 px-4' : 'py-12 px-4',
        className,
      )}
    >
      {icon && (
        <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300">
          {icon}
        </div>
      )}
      <div>
        <p className="text-sm font-semibold text-slate-700">{title}</p>
        {description && (
          <p className="text-xs text-slate-400 mt-1 max-w-[220px] mx-auto leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {action && (
        <Button
          variant="primary"
          size="md"
          onClick={action.onClick}
          iconLeft={action.icon}
          className="mt-1"
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}
