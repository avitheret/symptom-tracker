import { LayoutDashboard, List, BarChart2, Brain, Notebook } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { t } from '../utils/contentManager';
import type { View } from '../types';

const TABS: Array<{
  view: View;
  contentKey: string;
  Icon: React.FC<{ size?: number; strokeWidth?: number; className?: string }>;
}> = [
  { view: 'dashboard', contentKey: 'nav.home', Icon: LayoutDashboard },
  { view: 'conditions', contentKey: 'nav.track', Icon: List },
  { view: 'reports', contentKey: 'nav.reports', Icon: BarChart2 },
  { view: 'insights', contentKey: 'nav.insights', Icon: Brain },
  { view: 'notes',    contentKey: 'nav.notes',    Icon: Notebook },
];

export default function BottomNav() {
  const { state, setView } = useApp();

  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/98 backdrop-blur-md border-t border-slate-100"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-stretch h-16 px-1">
        {TABS.map(({ view, contentKey, Icon }) => {
          const active = state.view === view;
          const label = t(contentKey);
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
                <span className="absolute inset-x-1.5 top-1.5 bottom-1.5 bg-blue-50 rounded-2xl" />
              )}
              <span className="relative z-10">
                <Icon
                  size={22}
                  strokeWidth={active ? 2.5 : 1.8}
                  className={active ? 'text-blue-600' : 'text-slate-400'}
                />
              </span>
              <span className={`relative z-10 text-xs leading-none tracking-wide ${active ? 'font-semibold text-blue-600' : 'font-medium text-slate-400'}`}>
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
