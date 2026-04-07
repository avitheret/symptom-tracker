import { useState } from 'react';
import {
  ClipboardList, Pill, Zap, HeartPulse, FlaskConical, Clock, AlertCircle,
  Check, X, ChevronDown, ChevronUp,
} from 'lucide-react';
import type { ExtractionResult, ExtractedItem, ExtractedSymptom } from '../types';
import { SUPPLEMENT_TIME_WINDOWS } from '../types';
import { Sheet, Button } from './ui';

interface Props {
  result: ExtractionResult;
  onConfirm: (result: ExtractionResult) => void;
  onSkip: (noteId: string) => void;
  onClose: () => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(time: string): string {
  const [hStr, mStr] = time.split(':');
  const h = parseInt(hStr);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${mStr} ${ampm}`;
}

const TYPE_META: Record<ExtractedItem['type'], { label: string; color: string; bg: string; Icon: typeof ClipboardList }> = {
  symptom:    { label: 'Symptoms',    color: 'text-blue-700',    bg: 'bg-blue-50',    Icon: ClipboardList },
  medication: { label: 'Medications', color: 'text-emerald-700', bg: 'bg-emerald-50', Icon: Pill },
  trigger:    { label: 'Triggers',    color: 'text-amber-700',   bg: 'bg-amber-50',  Icon: Zap },
  checkin:    { label: 'Check-In',    color: 'text-purple-700',  bg: 'bg-purple-50', Icon: HeartPulse },
  supplement: { label: 'Supplements', color: 'text-teal-700',    bg: 'bg-teal-50',   Icon: FlaskConical },
};

// ── Severity editor (inline) ─────────────────────────────────────────────────

function SeverityBadge({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [open, setOpen] = useState(false);
  const color = value <= 3 ? 'bg-green-100 text-green-700'
    : value <= 6 ? 'bg-amber-100 text-amber-700'
    : 'bg-red-100 text-red-700';

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`text-xs font-semibold px-2 py-0.5 rounded-full ${color} flex items-center gap-1`}
      >
        {value}/10
        {open ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg p-2 z-50 flex flex-wrap gap-1 w-[180px]">
          {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
            <button
              key={n}
              type="button"
              onClick={() => { onChange(n); setOpen(false); }}
              className={`w-8 h-8 rounded-lg text-xs font-bold transition-colors ${
                n === value ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function ExtractionReviewSheet({ result, onConfirm, onSkip, onClose }: Props) {
  // Items with checked state — all checked by default
  const [checkedIds, setCheckedIds] = useState<Set<string>>(
    () => new Set(result.items.map(i => i.id))
  );

  // Editable severity for symptom items
  const [severities, setSeverities] = useState<Record<string, number>>(
    () => {
      const m: Record<string, number> = {};
      for (const item of result.items) {
        if (item.type === 'symptom') m[item.id] = item.severity;
      }
      return m;
    }
  );

  const toggle = (id: string) => {
    setCheckedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const checkedCount = checkedIds.size;

  function handleConfirm() {
    // Build a filtered result with only checked items + updated severities
    const filteredItems = result.items
      .filter(i => checkedIds.has(i.id))
      .map(i => {
        if (i.type === 'symptom' && severities[i.id] !== undefined) {
          return { ...i, severity: severities[i.id], inferredSeverity: false } as ExtractedSymptom;
        }
        return i;
      });
    onConfirm({ ...result, items: filteredItems });
  }

  // Group items by type
  const grouped = new Map<ExtractedItem['type'], ExtractedItem[]>();
  for (const item of result.items) {
    const list = grouped.get(item.type) ?? [];
    list.push(item);
    grouped.set(item.type, list);
  }

  // Note preview
  const previewText = result.noteText.length > 150
    ? result.noteText.slice(0, 150) + '…'
    : result.noteText;

  return (
    <Sheet
      title="Review Extracted Data"
      subtitle={`${result.items.length} item${result.items.length !== 1 ? 's' : ''} found`}
      icon={<ClipboardList size={16} className="text-blue-500" />}
      onClose={onClose}
      maxWidth="sm:max-w-lg"
    >
      <div className="px-5 py-4 space-y-4">

        {/* Note preview */}
        <div className="bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5">
          <p className="text-xs text-amber-600 font-semibold mb-1">From your note:</p>
          <p className="text-sm text-slate-700 leading-relaxed italic">"{previewText}"</p>
        </div>

        {/* Timestamp */}
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Clock size={14} />
          <span>
            {result.timestamp.date} at {formatTime(result.timestamp.time)}
            {result.timestamp.inferred && (
              <span className="text-xs text-amber-600 ml-1.5">(estimated)</span>
            )}
          </span>
        </div>

        {/* Grouped items */}
        {(['symptom', 'medication', 'supplement', 'trigger', 'checkin'] as const).map(type => {
          const items = grouped.get(type);
          if (!items || items.length === 0) return null;
          const meta = TYPE_META[type];

          return (
            <div key={type} className="space-y-1.5">
              <div className="flex items-center gap-2">
                <div className={`p-1 rounded-lg ${meta.bg}`}>
                  <meta.Icon size={13} className={meta.color} />
                </div>
                <span className={`text-xs font-semibold ${meta.color} uppercase tracking-wide`}>
                  {meta.label}
                </span>
              </div>

              <div className="space-y-1">
                {items.map(item => (
                  <div
                    key={item.id}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors ${
                      checkedIds.has(item.id)
                        ? 'bg-white border-slate-200'
                        : 'bg-slate-50 border-slate-100 opacity-50'
                    }`}
                  >
                    {/* Checkbox */}
                    <button
                      type="button"
                      onClick={() => toggle(item.id)}
                      className={`flex-shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                        checkedIds.has(item.id)
                          ? 'bg-blue-600 border-blue-600'
                          : 'border-slate-300 bg-white'
                      }`}
                    >
                      {checkedIds.has(item.id) && <Check size={12} className="text-white" />}
                    </button>

                    {/* Item content */}
                    <div className="flex-1 min-w-0">
                      {item.type === 'symptom' && (
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <span className="text-sm font-medium text-slate-800">{item.symptomName}</span>
                            <span className="text-xs text-slate-400 ml-1.5">{item.conditionName}</span>
                          </div>
                          {checkedIds.has(item.id) && (
                            <SeverityBadge
                              value={severities[item.id] ?? item.severity}
                              onChange={v => setSeverities(prev => ({ ...prev, [item.id]: v }))}
                            />
                          )}
                        </div>
                      )}
                      {item.type === 'medication' && (
                        <div>
                          <span className="text-sm font-medium text-slate-800">{item.name}</span>
                          {item.dosage && (
                            <span className="text-xs text-slate-400 ml-1.5">{item.dosage}</span>
                          )}
                        </div>
                      )}
                      {item.type === 'supplement' && (
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-medium text-slate-800">{item.name}</span>
                            {item.timeWindow && (
                              <span className="text-xs text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded-full">
                                {SUPPLEMENT_TIME_WINDOWS[item.timeWindow].label}
                              </span>
                            )}
                            {item.quantity && (
                              <span className="text-xs text-slate-400">{item.quantity}</span>
                            )}
                          </div>
                          {item.description && (
                            <p className="text-xs text-slate-400 italic mt-0.5">{item.description}</p>
                          )}
                        </div>
                      )}
                      {item.type === 'trigger' && (
                        <span className="text-sm font-medium text-slate-800">{item.triggerName}</span>
                      )}
                      {item.type === 'checkin' && (
                        <div className="flex flex-wrap gap-2">
                          {item.matchedFields.map(f => (
                            <span key={f} className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">
                              {f === 'sleep' ? `Sleep: ${item.sleepHours}h` :
                               f === 'stress' ? `Stress: ${item.stress}` :
                               f === 'energy' ? `Energy: ${item.energy}/10` :
                               f === 'mood' ? `Mood: ${item.mood}/10` :
                               f === 'healthScore' ? `Health: ${item.healthScore}/10` : f}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {/* Disclaimer */}
        <div className="flex items-start gap-2 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5">
          <AlertCircle size={14} className="text-slate-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-slate-400 leading-relaxed">
            Review each item before confirming. Uncheck anything that doesn't look right. You can also adjust severity scores.
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-2.5 pb-safe">
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={() => onSkip(result.noteId)}
            className="flex-1"
          >
            <X size={15} className="mr-1.5" />
            Save Note Only
          </Button>
          <Button
            type="button"
            variant="primary"
            size="lg"
            disabled={checkedCount === 0}
            onClick={handleConfirm}
            className="flex-1"
          >
            <Check size={15} className="mr-1.5" />
            Create {checkedCount} Log{checkedCount !== 1 ? 's' : ''}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
