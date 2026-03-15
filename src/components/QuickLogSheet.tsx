import { useState } from 'react';
import { X, Plus } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import type { Condition } from '../types';
import TrackingModal from './TrackingModal';

interface Props {
  onClose:        () => void;
  referenceNote?: string;   // text snippet shown as a reminder when logging from a note
}

export default function QuickLogSheet({ onClose, referenceNote }: Props) {
  const { state, getPatientConditions, setView } = useApp();
  const [trackingCondition, setTrackingCondition] = useState<Condition | null>(null);

  const conditions = getPatientConditions(state.activePatientId ?? '');

  // If TrackingModal is open, render it instead
  if (trackingCondition) {
    return (
      <TrackingModal
        condition={trackingCondition}
        onClose={() => {
          setTrackingCondition(null);
          onClose();
        }}
      />
    );
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="sm:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-slate-200 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 bg-white">
          <div>
            <h2 className="font-semibold text-slate-900">Log Symptom</h2>
            <p className="text-xs text-slate-500 mt-0.5">Select a condition to log</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-2 rounded-xl hover:bg-slate-100 active:bg-slate-200 transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
          >
            <X size={18} />
          </button>
        </div>

        {/* Reference note banner — shown when logging from a note */}
        {referenceNote && (
          <div className="mx-5 mt-3 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-2.5">
            <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-1">From your note</p>
            <p className="text-xs text-amber-800 line-clamp-2 leading-relaxed">{referenceNote}</p>
          </div>
        )}

        {/* Conditions */}
        <div className="px-5 py-4">
          {conditions.length === 0 ? (
            <div className="text-center py-8 space-y-3">
              <p className="text-sm text-slate-500">No conditions added yet.</p>
              <button
                onClick={() => { setView('conditions'); onClose(); }}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl min-h-[44px]"
              >
                <Plus size={14} />Add a Condition
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2 pb-2">
              {conditions.map(c => {
                const rgba = `${c.color}18`;
                return (
                  <button
                    key={c.id}
                    onClick={() => setTrackingCondition(c)}
                    className="flex items-center gap-3 px-4 py-4 rounded-2xl text-left border border-slate-100 active:scale-[0.98] transition-transform min-h-[64px]"
                    style={{ backgroundColor: rgba }}
                  >
                    <span
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: c.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{c.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {c.symptoms.length} symptom{c.symptoms.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <span className="text-xs text-slate-400">Tap to log →</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
