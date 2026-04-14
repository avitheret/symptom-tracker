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
  const [order, setOrder] = useState<WidgetId[]>(() => {
    const hidden = WIDGET_ORDER.filter(id => !visible.includes(id));
    return [...visible, ...hidden];
  });

  const [dragging, setDragging] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  const dragIndex = useRef<number | null>(null);
  const dragTarget = useRef<number | null>(null);
  const orderRef = useRef(order);
  const visibleRef = useRef(visible);
  const listRef = useRef<HTMLDivElement>(null);
  orderRef.current = order;
  visibleRef.current = visible;

  function commit(newOrder: WidgetId[]) {
    setOrder(newOrder);
    onChange(newOrder.filter(w => visibleRef.current.includes(w)));
  }

  function toggleWidget(id: WidgetId) {
    const cur = visibleRef.current;
    if (cur.includes(id)) {
      if (cur.length <= 1) return;
      onChange(orderRef.current.filter(w => cur.includes(w) && w !== id));
    } else {
      onChange(orderRef.current.filter(w => cur.includes(w) || w === id));
    }
  }

  function resetDefaults() {
    setOrder([...WIDGET_ORDER]);
    onChange([...DEFAULT_WIDGETS]);
  }

  function getIndexFromY(clientY: number): number {
    const items = listRef.current?.querySelectorAll<HTMLElement>('[data-drag-index]');
    if (!items || items.length === 0) return 0;
    for (const el of items) {
      const rect = el.getBoundingClientRect();
      if (clientY >= rect.top && clientY <= rect.bottom) return Number(el.dataset.dragIndex);
    }
    const first = items[0].getBoundingClientRect();
    return clientY < first.top ? 0 : orderRef.current.length - 1;
  }

  // ── Pointer events (mouse + touch, no draggable conflicts) ────────────────
  function onGripPointerDown(e: React.PointerEvent, index: number) {
    e.preventDefault();
    // Capture pointer on the list so pointermove/up fire there regardless of position
    listRef.current?.setPointerCapture(e.pointerId);
    dragIndex.current = index;
    dragTarget.current = null;
    setDragging(index);
    setDragOver(null);
  }

  function onListPointerMove(e: React.PointerEvent) {
    if (dragIndex.current === null) return;
    const idx = getIndexFromY(e.clientY);
    if (idx !== dragIndex.current) {
      dragTarget.current = idx;
      setDragOver(idx);
    }
  }

  function onListPointerUp(e: React.PointerEvent) {
    if (dragIndex.current === null) return;
    listRef.current?.releasePointerCapture(e.pointerId);
    const from = dragIndex.current;
    const to = dragTarget.current;
    dragIndex.current = null;
    dragTarget.current = null;
    setDragging(null);
    setDragOver(null);
    if (from !== null && to !== null && from !== to) {
      const newOrder = [...orderRef.current];
      const [moved] = newOrder.splice(from, 1);
      newOrder.splice(to, 0, moved);
      commit(newOrder);
    }
  }

  function onListPointerCancel() {
    dragIndex.current = null;
    dragTarget.current = null;
    setDragging(null);
    setDragOver(null);
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
        <div
          ref={listRef}
          className="px-6 py-5 space-y-2 overflow-y-auto flex-1"
          onPointerMove={onListPointerMove}
          onPointerUp={onListPointerUp}
          onPointerCancel={onListPointerCancel}
        >
          {order.map((id, index) => {
            const def = WIDGET_DEFS[id];
            const isOn = visibleRef.current.includes(id);
            const isDragging = dragging === index;
            const isTarget = dragOver === index && dragging !== index;

            return (
              <div
                key={id}
                data-drag-index={index}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all select-none
                  ${isDragging
                    ? 'opacity-40 border-blue-300 bg-blue-50 scale-[0.98]'
                    : isTarget
                    ? 'border-blue-400 bg-blue-50 shadow-md'
                    : 'border-slate-100 hover:bg-slate-50'
                  }`}
              >
                {/* Grip handle — pointer down here starts drag */}
                <div
                  className="text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing touch-none flex-shrink-0 min-h-[44px] flex items-center"
                  onPointerDown={e => onGripPointerDown(e, index)}
                >
                  <GripVertical size={18} />
                </div>

                {/* Label — tap toggles */}
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
