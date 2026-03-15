import { useEffect, useState } from 'react';
import { CheckCircle2, Mic } from 'lucide-react';

interface VoiceCommandToastProps {
  label: string;      // e.g. "Log Symptom"
  visible: boolean;   // controlled externally
}

/**
 * A slide-up toast that confirms a recognised voice command.
 * Auto-hides after 2.5 s.
 */
export default function VoiceCommandToast({ label, visible }: VoiceCommandToastProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (visible && label) {
      setShow(true);
      const t = setTimeout(() => setShow(false), 2500);
      return () => clearTimeout(t);
    }
  }, [visible, label]);

  if (!show || !label) return null;

  return (
    <div
      className="
        fixed bottom-24 left-1/2 -translate-x-1/2 z-50
        flex items-center gap-2.5
        bg-gray-900/90 backdrop-blur-sm text-white
        px-4 py-2.5 rounded-2xl shadow-xl
        text-sm font-medium
        animate-in slide-in-from-bottom-4 fade-in
        pointer-events-none
      "
    >
      <Mic size={15} className="text-emerald-400 shrink-0" />
      <span className="text-slate-300 text-xs">Voice command:</span>
      <span className="font-semibold">{label}</span>
      <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
    </div>
  );
}
