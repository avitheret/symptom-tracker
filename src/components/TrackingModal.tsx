import { useState } from 'react';
import { Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import type { Condition, Symptom, TrackingEntry } from '../types';
import { PREDEFINED_TRIGGERS } from '../types';
import { Sheet, Button, Chip } from './ui';

interface Props {
  condition:           Condition;
  preselectedSymptom?: Symptom;
  existingEntry?:      TrackingEntry;   // when provided, modal is in edit mode
  voiceSourceTranscript?: string;       // when set, mark new entry for review
  onClose:             () => void;
}

function todayStr() { return new Date().toISOString().slice(0, 10); }
function nowTime()  {
  const d = new Date();
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

export default function TrackingModal({ condition, preselectedSymptom, existingEntry, voiceSourceTranscript, onClose }: Props) {
  const { addEntry, updateEntry, approveEntry } = useApp();
  const isEdit = !!existingEntry;

  const [symptomId,        setSymptomId]        = useState(existingEntry?.symptomId ?? preselectedSymptom?.id ?? (condition.symptoms[0]?.id ?? ''));
  const [date,             setDate]             = useState(existingEntry?.date ?? todayStr());
  const [time,             setTime]             = useState(existingEntry?.time ?? nowTime());
  const [severity,         setSeverity]         = useState(existingEntry?.severity ?? 5);
  const [notes,            setNotes]            = useState(existingEntry?.notes ?? '');
  const [errors,           setErrors]           = useState<Record<string,string>>({});
  const [selectedTriggers, setSelectedTriggers] = useState<string[]>(existingEntry?.triggers ?? []);
  const [showTriggers,     setShowTriggers]     = useState(isEdit && (existingEntry?.triggers?.length ?? 0) > 0);

  function validate() {
    const e: Record<string,string> = {};
    if (!symptomId) e.symptom = 'Please select a symptom.';
    if (!date)      e.date    = 'Date is required.';
    if (!time || !/^\d{2}:\d{2}$/.test(time)) e.time = 'Enter time as HH:MM.';
    return e;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    const symptom = condition.symptoms.find(s => s.id === symptomId)!;
    const triggers = selectedTriggers.length > 0 ? selectedTriggers : undefined;

    if (isEdit) {
      updateEntry(existingEntry.id, {
        conditionId:   condition.id,
        conditionName: condition.name,
        symptomId,
        symptomName:   symptom.name,
        date,
        time,
        severity,
        notes:         notes.trim(),
        triggers,
      });
      // Auto-approve voice-logged entries when edited
      if (existingEntry.reviewStatus === 'to_review') {
        approveEntry(existingEntry.id);
      }
    } else {
      addEntry({
        conditionId:   condition.id,
        conditionName: condition.name,
        symptomId,
        symptomName:   symptom.name,
        date,
        time,
        severity,
        notes:         notes.trim(),
        triggers,
        // If opened from voice, mark for review
        ...(voiceSourceTranscript ? {
          reviewStatus:     'to_review' as const,
          sourceType:       'voice' as const,
          sourceTranscript: voiceSourceTranscript,
        } : {}),
      });
    }
    onClose();
  }

  const severityColor =
    severity <= 3 ? 'text-green-600' :
    severity <= 6 ? 'text-amber-500' : 'text-red-500';

  const sliderPct = ((severity - 1) / 9) * 100;

  return (
    <Sheet
      title={isEdit ? 'Edit Log Entry' : 'Log Symptom'}
      subtitle={condition.name}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="px-5 py-5 space-y-5">

        {/* ── Symptom chips ──────────────────────────── */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2.5">Symptom</label>
          {condition.symptoms.length === 0 ? (
            <p className="text-sm text-slate-400 italic">
              No symptoms yet. Add symptoms to this condition first.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {condition.symptoms.map(s => (
                <Chip
                  key={s.id}
                  selected={s.id === symptomId}
                  activeColor={condition.color}
                  shape="rect"
                  onClick={() => { setSymptomId(s.id); setErrors(p => ({ ...p, symptom: '' })); }}
                >
                  {s.name}
                </Chip>
              ))}
            </div>
          )}
          {errors.symptom && (
            <p className="text-red-500 text-xs mt-1.5">{errors.symptom}</p>
          )}
        </div>

        {/* ── Date & Time ────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Date</label>
            <input
              type="date"
              value={date}
              max={todayStr()}
              onChange={e => { setDate(e.target.value); setErrors(p => ({ ...p, date: '' })); }}
              className="w-full border border-slate-300 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 min-h-[48px] bg-white"
            />
            {errors.date && <p className="text-red-500 text-xs mt-1">{errors.date}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              <Clock size={13} className="inline mr-1" />Time
            </label>
            <input
              type="time"
              value={time}
              onChange={e => { setTime(e.target.value); setErrors(p => ({ ...p, time: '' })); }}
              className="w-full border border-slate-300 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 min-h-[48px] bg-white"
            />
            {errors.time && <p className="text-red-500 text-xs mt-1">{errors.time}</p>}
          </div>
        </div>

        {/* ── Severity slider ────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium text-slate-700">Severity</label>
            <span className={`text-2xl font-black tabular-nums leading-none ${severityColor}`}>
              {severity}
              <span className="text-sm font-medium text-slate-400">/10</span>
            </span>
          </div>
          <input
            type="range"
            min={1} max={10}
            value={severity}
            onChange={e => setSeverity(Number(e.target.value))}
            className="w-full accent-blue-600 cursor-pointer"
            style={{
              background: `linear-gradient(to right, #4f46e5 0%, #4f46e5 ${sliderPct}%, #e2e8f0 ${sliderPct}%, #e2e8f0 100%)`,
            }}
          />
          <div className="flex justify-between text-xs text-slate-400 mt-2">
            <span>Mild (1–3)</span>
            <span>Moderate (4–6)</span>
            <span>Severe (7–10)</span>
          </div>
        </div>

        {/* ── Triggers (collapsible) ─────────────────── */}
        <div>
          <button
            type="button"
            onClick={() => setShowTriggers(s => !s)}
            className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors w-full text-left py-1 min-h-[40px]"
          >
            {showTriggers ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            Possible Triggers
            {selectedTriggers.length > 0 && (
              <span className="ml-auto text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                {selectedTriggers.length} selected
              </span>
            )}
          </button>

          {showTriggers && (
            <div className="mt-2.5 space-y-2">
              <div className="flex flex-wrap gap-2">
                {PREDEFINED_TRIGGERS.map(t => {
                  const on = selectedTriggers.includes(t);
                  return (
                    <Chip
                      key={t}
                      selected={on}
                      activeColor="#f59e0b"
                      size="sm"
                      onClick={() =>
                        setSelectedTriggers(prev =>
                          on ? prev.filter(x => x !== t) : [...prev, t]
                        )
                      }
                    >
                      {t}
                    </Chip>
                  );
                })}
              </div>
              <p className="text-xs text-slate-400">
                Select factors you think contributed to this symptom.
              </p>
            </div>
          )}
        </div>

        {/* ── Notes ─────────────────────────────────── */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Notes <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            placeholder="Any additional context…"
            className="w-full border border-slate-300 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none bg-white"
          />
        </div>

        {/* ── Action buttons ────────────────────────── */}
        <div className="flex gap-3 pt-1 pb-safe">
          <Button type="button" variant="outline" size="lg" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={condition.symptoms.length === 0}
            className="flex-1"
          >
            {isEdit ? 'Save Changes' : 'Log Entry'}
          </Button>
        </div>

      </form>
    </Sheet>
  );
}
