import { useState, useRef } from 'react';
import { X, LayoutDashboard, GripVertical } from 'lucide-react';
import { WIDGET_DEFS, DEFAULT_WIDGETS } from '../types';
import type { WidgetId } from '../types';

const WIDGET_ORDER: WidgetId[] = ['stats', 'forecast', 'explainToday', 'weather', 'checkin', 'voiceReview', 'aiInsights', 'medSchedule', 'quickActions', 'conditions', 'recentLog'];

interface Props {
  visible: WidgetId[];
  onChange: (widgets: WidgetId[]) => void;
  onClose: () => void;
}

export default function DashboardCustomizer({ visible, onChange, onClose }: Props) {
  // `order` is the full ordered list (visible + hidden). Drag reorders this.
  const [order, setOrder] = useState<WidgetId[]>(() => {
    const hidden = WIDGET_ORDER.filter(id => !visible.includes(id));
    return [...visible, ...hidden];
  });

  // Drag state
  const dragIndex = useRef<number | null>(null);
  const dragTarget = useRef<number | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  function commit(newOrder: WidgetId[]) {
    setOrder(newOrder);
    onChange(newOrder.filter(w => visible.includes(w)));
  }

  function toggleWidget(id: WidgetId) {
    if (visible.includes(id)) {
      if (visible.length <= 1) return;
      onChange(order.filter(w => visible.includes(w) && w !== id));
    } else {
      onChange(order.filter(w => visible.includes(w) || w === id));
    }
  }

  function resetDefaults() {
    const newOrder = [...WIDGET_ORDER];
    setOrder(newOrder);
    onChange([...DEFAULT_WIDGETS]);
  }

  // ── Drag handlers ─────────────────────────────────────────────────────────
  function onDragStart(e: React.DragEvent, index: number) {
    dragIndex.current = index;
    setDragging(index);
    e.dataTransfer.effectAllowed = 'move';
    // Transparent drag ghost
    const ghost = document.createElement('div');
    ghost.style.position = 'fixed';
    ghost.style.top = '-999px';
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 0, 0);
    setTimeout(() => document.body.removeChild(ghost), 0);
  }

  function onDragEnter(index: number) {
    if (dragIndex.current === index) return;
    dragTarget.current = index;
    setDragOver(index);
  }

  function onDragEnd() {
    if (dragIndex.current !== null && dragTarget.current !== null && dragIndex.current !== dragTarget.current) {
      const newOrder = [...order];
      const [moved] = newOrder.splice(dragIndex.current, 1);
      newOrder.splice(dragTarget.current, 0, moved);
      commit(newOrder);
    }
    dragIndex.current = null;
    dragTarget.current = null;
    setDragging(null);
    setDragOver(null);
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-sm max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-50 rounded-lg">
              <LayoutDashboard size={16} className="text-blue-500" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900">Customise Dashboard</h2>
              <p className="text-xs text-slate-500 mt-0.5">Show, hide or drag to reorder</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* List */}
        <div className="px-6 py-5 space-y-2 overflow-y-auto flex-1">
          {order.map((id, index) => {
            const def = WIDGET_DEFS[id];
            const isOn = visible.includes(id);
            const isDragging = dragging === index;
            const isTarget = dragOver === index && dragging !== index;

            return (
              <div
                key={id}
                draggable
                onDragStart={e => onDragStart(e, index)}
                onDragEnter={() => onDragEnter(index)}
                onDragOver={onDragOver}
                onDragEnd={onDragEnd}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all
                  ${isDragging
                    ? 'opacity-40 border-blue-300 bg-blue-50 scale-[0.98]'
                    : isTarget
                    ? 'border-blue-400 bg-blue-50 shadow-md'
                    : 'border-slate-100 hover:bg-slate-50'
                  }`}
              >
                {/* Drag handle */}
                <div
                  className="text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing touch-none flex-shrink-0 min-h-[44px] flex items-center"
                  onMouseDown={e => e.stopPropagation()}
                >
                  <GripVertical size={18} />
                </div>

                {/* Label — clicking toggles */}
                <div
                  className="flex-1 min-w-0 cursor-pointer"
                  onClick={() => toggleWidget(id)}
                >
                  <p className={`text-sm font-medium ${isOn ? 'text-slate-800' : 'text-slate-400'}`}>
                    {def.label}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5 truncate">{def.description}</p>
                </div>

                {/* Toggle */}
                <div
                  className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 cursor-pointer ${
                    isOn ? 'bg-blue-500' : 'bg-slate-200'
                  }`}
                  onClick={() => toggleWidget(id)}
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

        {/* Footer */}
        <div className="px-6 pb-5 flex gap-3 flex-shrink-0 border-t border-slate-100 pt-4">
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
