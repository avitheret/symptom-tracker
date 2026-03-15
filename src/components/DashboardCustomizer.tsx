import { X, LayoutDashboard } from 'lucide-react';
import { WIDGET_DEFS, DEFAULT_WIDGETS } from '../types';
import type { WidgetId } from '../types';

const WIDGET_ORDER: WidgetId[] = ['stats', 'forecast', 'checkin', 'voiceReview', 'aiInsights', 'medSchedule', 'quickActions', 'conditions', 'recentLog'];

interface Props {
  visible: WidgetId[];
  onChange: (widgets: WidgetId[]) => void;
  onClose: () => void;
}

export default function DashboardCustomizer({ visible, onChange, onClose }: Props) {
  function toggleWidget(id: WidgetId) {
    if (visible.includes(id)) {
      // Don't allow hiding everything
      if (visible.length <= 1) return;
      onChange(visible.filter(w => w !== id));
    } else {
      // Preserve original order
      onChange(WIDGET_ORDER.filter(w => visible.includes(w) || w === id));
    }
  }

  function resetDefaults() {
    onChange([...DEFAULT_WIDGETS]);
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-sm"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-50 rounded-lg">
              <LayoutDashboard size={16} className="text-blue-500" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900">Customise Dashboard</h2>
              <p className="text-xs text-slate-500 mt-0.5">Show or hide widgets</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-3">
          {WIDGET_ORDER.map(id => {
            const def = WIDGET_DEFS[id];
            const isOn = visible.includes(id);
            return (
              <div
                key={id}
                className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer"
                onClick={() => toggleWidget(id)}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800">{def.label}</p>
                  <p className="text-xs text-slate-400 mt-0.5 truncate">{def.description}</p>
                </div>
                {/* Toggle */}
                <div
                  className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${
                    isOn ? 'bg-blue-500' : 'bg-slate-200'
                  }`}
                >
                  <div
                    className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                      isOn ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className="px-6 pb-5 flex gap-3">
          <button
            onClick={resetDefaults}
            className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Reset Defaults
          </button>
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
