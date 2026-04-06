import { LayoutDashboard, List, UtensilsCrossed, BarChart2, Brain, Notebook, FlaskConical } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import type { View } from '../types';

const TABS: Array<{
  view: View;
  label: string;
  Icon: React.FC<{ size?: number; strokeWidth?: number; className?: string }>;
}> = [
  { view: 'dashboard',  label: 'Home',       Icon: LayoutDashboard },
  { view: 'conditions', label: 'Conditions', Icon: List },
  { view: 'meals',      label: 'Meals',      Icon: UtensilsCrossed },
  { view: 'reports',    label: 'Reports',    Icon: BarChart2 },
  { view: 'insights',   label: 'Insights',   Icon: Brain },
  { view: 'supplements', label: 'Supps',      Icon: FlaskConical },
  { view: 'notes',       label: 'Notes',      Icon: Notebook },
];

export default function BottomNav() {
  const { state, setView } = useApp();

  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/98 backdrop-blur-md border-t border-slate-100"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-stretch h-16 px-0.5">
        {TABS.map(({ view, label, Icon }) => {
          const active = state.view === view;
          return (
            <button
              key={view}
              onClick={() => setView(view)}
              aria-label={label}
              aria-current={active ? 'page' : undefined}
              className="relative flex flex-col items-center justify-center gap-0.5 flex-1 h-full py-2 select-none active:scale-95 transition-transform"
            >
              {/* Pill background for active tab */}
              {active && (
                <span className="absolute inset-x-1 top-1.5 bottom-1.5 bg-blue-50 rounded-2xl" />
              )}
              <span className="relative z-10">
                <Icon
                  size={20}
                  strokeWidth={active ? 2.5 : 1.8}
                  className={active ? 'text-blue-600' : 'text-slate-400'}
                />
              </span>
              <span className={`relative z-10 text-[10px] leading-none tracking-wide ${active ? 'font-semibold text-blue-600' : 'font-medium text-slate-400'}`}>
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
