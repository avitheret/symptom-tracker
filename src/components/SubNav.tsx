/**
 * SubNav — contextual sub-navigation shown below the Header.
 * Dashboard group: Overview | Conditions | Notes | Supplements | Meds
 * Reports group:   Log | Insights
 */
import { useApp } from '../contexts/AppContext';
import type { View } from '../types';

const DASHBOARD_TABS: { view: View; label: string }[] = [
  { view: 'dashboard',   label: 'Overview'     },
  { view: 'conditions',  label: 'Conditions'   },
  { view: 'notes',       label: 'Notes'        },
  { view: 'supplements', label: 'Supplements'  },
  { view: 'meds',        label: 'Meds'         },
];

const REPORTS_TABS: { view: View; label: string }[] = [
  { view: 'reports',  label: 'Log'      },
  { view: 'insights', label: 'Insights' },
];

const DASHBOARD_GROUP = new Set<View>(['dashboard', 'conditions', 'notes', 'supplements', 'meds']);
const REPORTS_GROUP   = new Set<View>(['reports', 'insights']);

export default function SubNav() {
  const { state, setView } = useApp();

  const tabs =
    DASHBOARD_GROUP.has(state.view) ? DASHBOARD_TABS :
    REPORTS_GROUP.has(state.view)   ? REPORTS_TABS   :
    null;

  if (!tabs) return null;

  return (
    <div className="sticky top-14 z-30 bg-white/98 backdrop-blur-md border-b border-slate-100">
      <div className="max-w-2xl mx-auto flex overflow-x-auto scrollbar-hide px-4 gap-1.5 py-2">
        {tabs.map(({ view, label }) => {
          const active = state.view === view;
          return (
            <button
              key={view}
              onClick={() => setView(view)}
              className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors min-h-[34px] ${
                active
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 bg-slate-100 hover:bg-slate-200 active:bg-slate-300'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
