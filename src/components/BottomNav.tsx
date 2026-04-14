import { LayoutDashboard, UtensilsCrossed, BarChart2 } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import type { View } from '../types';

const TABS: Array<{
  id: string;
  label: string;
  defaultView: View;
  group: Set<View>;
  Icon: React.FC<{ size?: number; strokeWidth?: number; className?: string }>;
}> = [
  {
    id: 'home',
    label: 'Home',
    defaultView: 'dashboard',
    group: new Set<View>(['dashboard', 'conditions', 'notes', 'supplements', 'meds']),
    Icon: LayoutDashboard,
  },
  {
    id: 'meals',
    label: 'Meals',
    defaultView: 'meals',
    group: new Set<View>(['meals']),
    Icon: UtensilsCrossed,
  },
  {
    id: 'reports',
    label: 'Reports',
    defaultView: 'reports',
    group: new Set<View>(['reports', 'insights']),
    Icon: BarChart2,
  },
];

export default function BottomNav() {
  const { state, setView } = useApp();

  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/98 backdrop-blur-md border-t border-slate-100"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-stretch h-16 px-4">
        {TABS.map(({ id, label, defaultView, group, Icon }) => {
          const active = group.has(state.view);
          return (
            <button
              key={id}
              onClick={() => setView(defaultView)}
              aria-label={label}
              aria-current={active ? 'page' : undefined}
              className="relative flex flex-col items-center justify-center gap-0.5 flex-1 h-full py-2 min-h-[44px] select-none active:scale-95 transition-transform"
            >
              {active && (
                <span className="absolute inset-x-2 top-1.5 bottom-1.5 bg-blue-50 rounded-2xl" />
              )}
              <span className="relative z-10">
                <Icon
                  size={22}
                  strokeWidth={active ? 2.5 : 1.8}
                  className={active ? 'text-blue-600' : 'text-slate-400'}
                />
              </span>
              <span className={`relative z-10 text-[11px] leading-none tracking-wide ${active ? 'font-semibold text-blue-600' : 'font-medium text-slate-400'}`}>
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
