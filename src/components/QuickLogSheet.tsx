import { useState } from 'react';
import { X, Plus, Mic, ChevronRight, Zap, Battery, Moon, Smile } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import type { Condition } from '../types';
import TrackingModal from './TrackingModal';

interface Props {
  onClose:          () => void;
  referenceNote?:   string;
  onVoicePress?:    () => void;
  onOpenCheckIn?:   () => void;
}

export default function QuickLogSheet({ onClose, referenceNote, onVoicePress, onOpenCheckIn }: Props) {
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

  function handleConditionCategory() {
    if (conditions.length === 1) {
      setTrackingCondition(conditions[0]);
    } else {
      // Conditions list is always visible below — no extra action needed
    }
  }

  function handleCheckInCategory() {
    onOpenCheckIn?.();
    onClose();
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-xl overflow-y-auto max-h-[90dvh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="sm:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-slate-200 rounded-full" />
        </div>

        {/* Header — sticky */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
          <div>
            <h2 className="font-semibold text-slate-900">Log a Symptom</h2>
            <p className="text-xs text-slate-500 mt-0.5">How are you feeling?</p>
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

        {/* Voice Log banner */}
        {onVoicePress && (
          <button
            onClick={() => onVoicePress()}
            className="bg-blue-50 border border-blue-100 rounded-2xl mx-5 mt-4 px-4 py-3.5 flex items-center gap-3 cursor-pointer active:scale-[0.98] transition-transform w-[calc(100%-2.5rem)]"
          >
            <div className="w-9 h-9 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
              <Mic size={16} className="text-white" />
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm font-semibold text-blue-900">Log by voice</p>
              <p className="text-xs text-blue-600 mt-0.5">Say &ldquo;Hey Tracker, log headache&rdquo;</p>
            </div>
            <ChevronRight size={16} className="text-blue-400 flex-shrink-0" />
          </button>
        )}

        {/* Category grid */}
        <div className="grid grid-cols-2 gap-2.5 px-5 pt-4">
          {/* Pain */}
          <button
            onClick={handleConditionCategory}
            className="flex flex-col items-start gap-2 p-4 rounded-2xl border bg-rose-50 border-rose-100 active:scale-[0.97] transition-transform min-h-[80px]"
          >
            <Zap size={20} className="text-rose-500" />
            <div>
              <p className="text-sm font-semibold text-rose-800">Pain</p>
              <p className="text-xs text-rose-500">Headache, back, joint</p>
            </div>
          </button>

          {/* Fatigue / Energy */}
          <button
            onClick={handleConditionCategory}
            className="flex flex-col items-start gap-2 p-4 rounded-2xl border bg-amber-50 border-amber-100 active:scale-[0.97] transition-transform min-h-[80px]"
          >
            <Battery size={20} className="text-amber-500" />
            <div>
              <p className="text-sm font-semibold text-amber-800">Energy</p>
              <p className="text-xs text-amber-500">Tiredness, exhaustion</p>
            </div>
          </button>

          {/* Sleep */}
          <button
            onClick={handleCheckInCategory}
            className="flex flex-col items-start gap-2 p-4 rounded-2xl border bg-indigo-50 border-indigo-100 active:scale-[0.97] transition-transform min-h-[80px]"
          >
            <Moon size={20} className="text-indigo-500" />
            <div>
              <p className="text-sm font-semibold text-indigo-800">Sleep</p>
              <p className="text-xs text-indigo-500">Quality, insomnia</p>
            </div>
          </button>

          {/* Mood */}
          <button
            onClick={handleCheckInCategory}
            className="flex flex-col items-start gap-2 p-4 rounded-2xl border bg-violet-50 border-violet-100 active:scale-[0.97] transition-transform min-h-[80px]"
          >
            <Smile size={20} className="text-violet-500" />
            <div>
              <p className="text-sm font-semibold text-violet-800">Mood</p>
              <p className="text-xs text-violet-500">Anxiety, low mood</p>
            </div>
          </button>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 px-5 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
          <div className="h-px flex-1 bg-slate-100" />
          <span>or choose a condition</span>
          <div className="h-px flex-1 bg-slate-100" />
        </div>

        {/* Conditions list */}
        <div className="grid grid-cols-1 gap-2 px-5 pb-6">
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
            conditions.map(c => {
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
            })
          )}
        </div>
      </div>
    </div>
  );
}
