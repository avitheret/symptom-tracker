/**
 * StoolLogModal — fast bowel-movement entry sheet.
 * Target: 10–20 seconds to log. Bristol type is the only required field.
 * All other fields default to the most common healthy values.
 */

import { useState } from 'react';
import { X, Clock, CheckCircle } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import type { BristolType, StoolAmount, StoolSmell, StoolUrgency, StoolPain, StoolUnusualFeature } from '../types';
import { STOOL_UNUSUAL_FEATURES } from '../types';

// ── Bristol shape icons (SVG) ─────────────────────────────────────────────────

function BristolShape({ type, selected }: { type: number; selected: boolean }) {
  const fill = selected ? '#ffffff' : bristolFill(type);
  switch (type) {
    case 1: return (
      <svg width="32" height="22" viewBox="0 0 32 22" aria-hidden>
        <circle cx="8"  cy="14" r="4.5" fill={fill} />
        <circle cx="17" cy="9"  r="4"   fill={fill} />
        <circle cx="25" cy="14" r="4"   fill={fill} />
        <circle cx="14" cy="18" r="3.5" fill={fill} />
      </svg>
    );
    case 2: return (
      <svg width="32" height="22" viewBox="0 0 32 22" aria-hidden>
        <path d="M4,14 Q5,7 10,9 Q12,5 16,7 Q21,5 24,9 Q28,9 26,14 Q24,19 16,18 Q8,19 4,14 Z" fill={fill} />
      </svg>
    );
    case 3: return (
      <svg width="32" height="22" viewBox="0 0 32 22" aria-hidden>
        <rect x="2" y="7" width="28" height="8" rx="4" fill={fill} />
        <line x1="10" y1="7" x2="9"  y2="15" stroke="rgba(0,0,0,0.12)" strokeWidth="1.2" />
        <line x1="18" y1="7" x2="16" y2="15" stroke="rgba(0,0,0,0.12)" strokeWidth="1.2" />
        <line x1="24" y1="7" x2="23" y2="15" stroke="rgba(0,0,0,0.12)" strokeWidth="1.2" />
      </svg>
    );
    case 4: return (
      <svg width="32" height="22" viewBox="0 0 32 22" aria-hidden>
        <rect x="2" y="7" width="28" height="8" rx="4" fill={fill} />
      </svg>
    );
    case 5: return (
      <svg width="32" height="22" viewBox="0 0 32 22" aria-hidden>
        <ellipse cx="7"  cy="13" rx="5.5" ry="4.5" fill={fill} />
        <ellipse cx="17" cy="10" rx="5"   ry="4"   fill={fill} />
        <ellipse cx="26" cy="14" rx="4.5" ry="4"   fill={fill} />
      </svg>
    );
    case 6: return (
      <svg width="32" height="22" viewBox="0 0 32 22" aria-hidden>
        <path d="M3,17 Q2,12 6,10 Q5,6 10,8 Q10,4 16,5 Q22,3 22,8 Q27,7 27,12 Q30,14 27,18 Z" fill={fill} />
      </svg>
    );
    case 7: return (
      <svg width="32" height="22" viewBox="0 0 32 22" aria-hidden>
        <path d="M2,9 Q6,6 10,9 Q14,12 18,9 Q22,6 26,9 Q29,11 30,9" stroke={fill} strokeWidth="2.8" fill="none" strokeLinecap="round"/>
        <path d="M2,15 Q6,12 10,15 Q14,18 18,15 Q22,12 26,15 Q29,17 30,15" stroke={fill} strokeWidth="2.8" fill="none" strokeLinecap="round"/>
      </svg>
    );
    default: return null;
  }
}

function bristolFill(type: number): string {
  if (type <= 2) return '#92400e';
  if (type <= 4) return '#166534';
  if (type <= 6) return '#c2410c';
  return '#b91c1c';
}

function bristolBg(type: number, selected: boolean): string {
  if (selected) {
    if (type <= 2) return 'bg-amber-700 border-amber-700';
    if (type <= 4) return 'bg-green-700 border-green-700';
    if (type <= 6) return 'bg-orange-600 border-orange-600';
    return 'bg-red-700 border-red-700';
  }
  if (type <= 2) return 'bg-amber-50 border-amber-200';
  if (type <= 4) return 'bg-green-50 border-green-200';
  if (type <= 6) return 'bg-orange-50 border-orange-200';
  return 'bg-red-50 border-red-200';
}

function bristolLabel(type: number): string {
  switch (type) {
    case 1: return 'Hard lumps';
    case 2: return 'Lumpy';
    case 3: return 'Cracked';
    case 4: return 'Smooth ✓';
    case 5: return 'Soft blobs';
    case 6: return 'Mushy';
    case 7: return 'Liquid';
    default: return '';
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function nowTime(): string {
  const n = new Date();
  return `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`;
}
function nowDate(): string {
  return new Date().toISOString().slice(0, 10);
}

// ── Three-option selector ─────────────────────────────────────────────────────

function TriSelect<T extends string>({
  options, value, onChange,
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex rounded-xl border border-slate-200 overflow-hidden">
      {options.map(opt => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`flex-1 py-2.5 text-sm font-medium transition-colors min-h-[44px] ${
            value === opt.value
              ? 'bg-slate-800 text-white'
              : 'bg-white text-slate-600 hover:bg-slate-50'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ── Toggle chip ───────────────────────────────────────────────────────────────

function ToggleChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium transition-all min-h-[44px] active:scale-95 ${
        active
          ? 'bg-blue-600 border-blue-600 text-white'
          : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
      }`}
    >
      {active && <CheckCircle size={13} />}
      {label}
    </button>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────

interface Props {
  onClose: () => void;
}

export default function StoolLogModal({ onClose }: Props) {
  const { addStoolLog } = useApp();

  const [date,                setDate]                = useState(nowDate());
  const [time,                setTime]                = useState(nowTime());
  const [bristolType,         setBristolType]         = useState<BristolType | null>(null);
  const [amount,              setAmount]              = useState<StoolAmount>('medium');
  const [greasy,              setGreasy]              = useState(false);
  const [floats,              setFloats]              = useState(false);
  const [smell,               setSmell]               = useState<StoolSmell>('usual');
  const [urgency,             setUrgency]             = useState<StoolUrgency>('none');
  const [incompleteEmptying,  setIncompleteEmptying]  = useState(false);
  const [pain,                setPain]                = useState<StoolPain>('none');
  const [unusualFeatures,     setUnusualFeatures]     = useState<StoolUnusualFeature[]>([]);
  const [saved,               setSaved]               = useState(false);

  function toggleFeature(feat: StoolUnusualFeature) {
    setUnusualFeatures(prev =>
      prev.includes(feat) ? prev.filter(f => f !== feat) : [...prev, feat]
    );
  }

  function handleSave() {
    if (!bristolType) return;
    addStoolLog({
      date,
      time,
      bristolType,
      amount,
      greasy,
      floats,
      smell,
      urgency,
      incompleteEmptying,
      pain,
      unusualFeatures,
    });
    setSaved(true);
    setTimeout(onClose, 900);
  }

  if (saved) {
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center">
        <div className="fixed inset-0 bg-black/40" />
        <div className="relative z-10 w-full max-w-lg mx-auto bg-white rounded-t-3xl px-6 py-10 flex flex-col items-center gap-3">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle size={32} className="text-green-600" />
          </div>
          <p className="text-lg font-bold text-slate-800">Logged!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />

      <div className="relative z-10 w-full max-w-lg mx-auto bg-white rounded-t-3xl overflow-y-auto max-h-[92dvh]">

        {/* Header */}
        <div className="sticky top-0 bg-white px-5 pt-5 pb-3 border-b border-slate-100 z-10">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">Log Bowel Movement</h2>
            <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 active:scale-90 transition-all">
              <X size={18} />
            </button>
          </div>
          {/* Time strip */}
          <div className="flex items-center gap-2 mt-2">
            <Clock size={13} className="text-slate-400" />
            <input
              type="time"
              value={time}
              onChange={e => setTime(e.target.value)}
              className="text-sm font-medium text-slate-600 bg-transparent border-none outline-none"
            />
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="text-sm text-slate-400 bg-transparent border-none outline-none"
            />
          </div>
        </div>

        <div className="px-5 py-4 space-y-5">

          {/* Bristol type — PRIMARY field */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2.5">
              Bristol Type <span className="text-rose-400">*</span>
              <span className="ml-2 text-[10px] font-normal text-slate-400 normal-case tracking-normal">3–4 is ideal</span>
            </p>
            <div className="grid grid-cols-7 gap-1.5">
              {([1, 2, 3, 4, 5, 6, 7] as BristolType[]).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setBristolType(t)}
                  className={`flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl border-2 transition-all active:scale-95 ${bristolBg(t, bristolType === t)}`}
                >
                  <BristolShape type={t} selected={bristolType === t} />
                  <span className={`text-xs font-bold ${bristolType === t ? 'text-white' : (t <= 2 ? 'text-amber-700' : t <= 4 ? 'text-green-700' : t <= 6 ? 'text-orange-700' : 'text-red-700')}`}>
                    {t}
                  </span>
                  <span className={`text-[9px] leading-tight text-center ${bristolType === t ? 'text-white/80' : 'text-slate-400'}`}>
                    {bristolLabel(t)}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Amount */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Amount</p>
            <TriSelect
              options={[{ value: 'small', label: 'Small' }, { value: 'medium', label: 'Medium' }, { value: 'large', label: 'Large' }]}
              value={amount}
              onChange={setAmount}
            />
          </div>

          {/* Quick flags row */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Flags</p>
            <div className="flex flex-wrap gap-2">
              <ToggleChip label="Greasy / Oily" active={greasy} onClick={() => setGreasy(v => !v)} />
              <ToggleChip label="Floats"        active={floats} onClick={() => setFloats(v => !v)} />
              <ToggleChip label="Incomplete"    active={incompleteEmptying} onClick={() => setIncompleteEmptying(v => !v)} />
            </div>
          </div>

          {/* Smell */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Smell</p>
            <TriSelect
              options={[{ value: 'none', label: 'None' }, { value: 'usual', label: 'Usual' }, { value: 'strong', label: 'Strong' }]}
              value={smell}
              onChange={setSmell}
            />
          </div>

          {/* Urgency */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Urgency</p>
            <TriSelect
              options={[{ value: 'none', label: 'None' }, { value: 'soon', label: 'Had to go soon' }, { value: 'urgent', label: 'Had to run' }]}
              value={urgency}
              onChange={setUrgency}
            />
          </div>

          {/* Pain / straining */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Pain / Straining</p>
            <div className="grid grid-cols-4 gap-1.5">
              {(['none', 'mild', 'moderate', 'severe'] as StoolPain[]).map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPain(p)}
                  className={`py-2.5 rounded-xl border text-sm font-medium transition-all active:scale-95 min-h-[44px] capitalize ${
                    pain === p
                      ? 'bg-slate-800 border-slate-800 text-white'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Unusual features */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Unusual Features</p>
            <div className="flex flex-wrap gap-2">
              {STOOL_UNUSUAL_FEATURES.map(feat => (
                <ToggleChip
                  key={feat}
                  label={feat.charAt(0).toUpperCase() + feat.slice(1)}
                  active={unusualFeatures.includes(feat)}
                  onClick={() => toggleFeature(feat)}
                />
              ))}
            </div>
          </div>

          {/* Save */}
          <button
            onClick={handleSave}
            disabled={!bristolType}
            className={`w-full py-4 rounded-2xl text-base font-bold transition-all active:scale-[0.98] min-h-[56px] mb-safe ${
              bristolType
                ? 'bg-blue-600 text-white shadow-md shadow-blue-200'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            }`}
          >
            {bristolType ? 'Save' : 'Select a Bristol type to save'}
          </button>
        </div>
      </div>
    </div>
  );
}
