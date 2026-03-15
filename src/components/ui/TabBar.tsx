import { type ReactNode } from 'react';
import { cn } from '../../utils/cn';

export interface TabItem<T extends string = string> {
  id:     T;
  label:  string;
  icon?:  ReactNode;
}

interface TabBarProps<T extends string> {
  tabs:     TabItem<T>[];
  active:   T;
  onChange: (id: T) => void;
  className?: string;
  /** Compact = smaller text + tighter padding */
  compact?: boolean;
}

/**
 * TabBar — horizontally scrollable segmented tab bar.
 *
 * Used across Reports and Insights screens.
 *
 * Usage:
 *  <TabBar
 *    tabs={[{ id: 'chart', label: 'Chart', icon: <BarChart2 size={14}/> }, …]}
 *    active={tab}
 *    onChange={setTab}
 *  />
 */
export function TabBar<T extends string>({
  tabs,
  active,
  onChange,
  className,
  compact = false,
}: TabBarProps<T>) {
  return (
    <div
      className={cn(
        'flex gap-1 bg-slate-100 rounded-xl p-1 overflow-x-auto scrollbar-none',
        className,
      )}
      role="tablist"
    >
      {tabs.map(t => {
        const isActive = t.id === active;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(t.id)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg font-medium',
              'transition-colors whitespace-nowrap flex-shrink-0 select-none',
              compact
                ? 'px-3 py-1.5 text-xs min-h-[34px]'
                : 'px-4 py-2   text-sm min-h-[40px]',
              isActive
                ? 'bg-white shadow-sm text-slate-900'
                : 'text-slate-500 hover:text-slate-700 active:bg-white/60',
            )}
          >
            {t.icon}
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
