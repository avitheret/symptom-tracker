import { useState, useEffect, useRef } from 'react';
import { Plus, X, Heart, Zap, Pill, ClipboardList, PenLine } from 'lucide-react';

interface Props {
  onCheckIn:    () => void;
  onTrigger:    () => void;
  onMedication: () => void;
  onLogSymptom: () => void;
  onNote:       () => void;
}

const ACTIONS = [
  { label: 'Check In',    icon: Heart,         color: 'bg-rose-500',   onClick: (p: Props) => p.onCheckIn },
  { label: 'Triggers',    icon: Zap,           color: 'bg-amber-500',  onClick: (p: Props) => p.onTrigger },
  { label: 'Medication',  icon: Pill,          color: 'bg-violet-500', onClick: (p: Props) => p.onMedication },
  { label: 'Log Symptom', icon: ClipboardList, color: 'bg-blue-500', onClick: (p: Props) => p.onLogSymptom },
  { label: 'Add Note',    icon: PenLine,       color: 'bg-amber-600',  onClick: (p: Props) => p.onNote },
];

export default function QuickAddFAB(props: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  return (
    /* Position: bottom-center, above bottom nav (bottom-20 = 80px = nav height + safe area) */
    <div
      ref={ref}
      className="lg:hidden fixed bottom-20 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2"
      style={{ bottom: 'calc(env(safe-area-inset-bottom) + 72px)' }}
    >
      {/* Action buttons — slide up when open */}
      {open && (
        <div className="flex flex-col items-center gap-2 mb-1">
          {ACTIONS.map(({ label, icon: Icon, color, onClick }) => (
            <div key={label} className="flex items-center gap-3">
              <span className="text-xs font-semibold text-slate-600 bg-white rounded-lg px-2.5 py-1.5 shadow-sm border border-slate-100 whitespace-nowrap">
                {label}
              </span>
              <button
                onClick={() => { setOpen(false); onClick(props)(); }}
                className={`w-12 h-12 ${color} text-white rounded-full shadow-lg flex items-center justify-center active:scale-90 transition-transform`}
              >
                <Icon size={20} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Main FAB */}
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-all active:scale-90 ${
          open ? 'bg-slate-700 rotate-45' : 'bg-blue-600'
        }`}
        aria-label={open ? 'Close menu' : 'Quick add'}
      >
        {open ? <X size={22} className="text-white" /> : <Plus size={24} className="text-white" />}
      </button>
    </div>
  );
}
