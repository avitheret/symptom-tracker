import { useRef } from 'react';
import { Mic, MicOff } from 'lucide-react';
import type { VoiceState } from '../hooks/useVoiceCommands';

interface VoiceButtonProps {
  state: VoiceState;
  onPress: () => void;      // tap: toggle / manual-activate
  onLongPress: () => void;  // long-press: disable entirely
}

export default function VoiceButton({ state, onPress, onLongPress }: VoiceButtonProps) {
  // Never render if the API doesn't exist at all
  if (state === 'unsupported') return null;

  // ── Long-press detection ─────────────────────────────────────────────────
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handlePointerDown = () => {
    pressTimer.current = setTimeout(() => {
      pressTimer.current = null;
      onLongPress();
    }, 600);
  };

  const handlePointerUp = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
      onPress();
    }
  };

  const handlePointerLeave = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  // ── Per-state styles ─────────────────────────────────────────────────────
  const buttonStyles: Partial<Record<VoiceState, string>> = {
    idle:               'bg-blue-50 border-2 border-blue-200 text-blue-400 shadow-md hover:bg-blue-100 hover:border-blue-400 hover:text-blue-600',
    denied:             'bg-red-50 border-2 border-red-300 text-red-400 shadow-md',
    'wake-listening':   'bg-blue-50 border-2 border-blue-400 text-blue-600 shadow-blue-100 shadow-lg',
    'command-listening':'bg-emerald-500 border-2 border-emerald-600 text-white shadow-emerald-200 shadow-xl scale-110',
    confirmed:          'bg-violet-500 border-2 border-violet-600 text-white shadow-violet-200 shadow-xl scale-105',
  };

  const tooltips: Partial<Record<VoiceState, string>> = {
    idle:               'Tap to re-enable voice commands',
    denied:             'Microphone blocked — tap for help',
    'wake-listening':   'Listening for "Hey Tracker" • Tap to speak now • Hold to disable',
    'command-listening':'Listening for command…',
    confirmed:          'Command recognised!',
  };

  return (
    <div className="fixed bottom-[4.75rem] lg:bottom-6 right-3 lg:right-6 z-40 flex flex-col items-end gap-2 select-none">

      {/* ── Labels above button ── */}

      {state === 'denied' && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-2xl text-xs font-medium shadow-md max-w-[200px] text-right leading-snug">
          Mic blocked. Allow microphone in your browser settings, then try again.
        </div>
      )}

      {state === 'wake-listening' && (
        <div className="bg-white/95 backdrop-blur-sm border border-blue-200 text-blue-700 px-3 py-1.5 rounded-2xl text-xs font-medium shadow-md whitespace-nowrap">
          Say <span className="font-bold">"Hey Tracker"</span>
        </div>
      )}

      {state === 'command-listening' && (
        <div className="bg-emerald-500 text-white px-3 py-1.5 rounded-2xl text-xs font-semibold shadow-lg whitespace-nowrap flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full bg-white animate-pulse" />
          Say a command…
        </div>
      )}

      {state === 'confirmed' && (
        <div className="bg-violet-500 text-white px-3 py-1.5 rounded-2xl text-xs font-semibold shadow-lg whitespace-nowrap">
          ✓ Got it!
        </div>
      )}

      {/* ── Main button ─────────────────────────────────────────────────── */}
      <div className="relative">

        {/* Pulse ring — wake-listening */}
        {state === 'wake-listening' && (
          <span className="absolute inset-0 rounded-full bg-blue-400 opacity-25 animate-ping pointer-events-none" />
        )}

        {/* Double ripple — command-listening */}
        {state === 'command-listening' && (
          <>
            <span className="absolute inset-0 rounded-full bg-emerald-400 opacity-40 animate-ping pointer-events-none" />
            <span
              className="absolute -inset-2 rounded-full bg-emerald-400 opacity-20 animate-ping pointer-events-none"
              style={{ animationDelay: '0.25s' }}
            />
          </>
        )}

        {/* Pulse ring — confirmed */}
        {state === 'confirmed' && (
          <span className="absolute inset-0 rounded-full bg-violet-400 opacity-40 animate-ping pointer-events-none" />
        )}

        <button
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerLeave}
          title={tooltips[state] ?? ''}
          aria-label={tooltips[state] ?? 'Voice commands'}
          className={`
            relative z-10 w-12 h-12 rounded-full
            flex items-center justify-center
            transition-all duration-200 touch-manipulation
            ${buttonStyles[state] ?? ''}
          `}
        >
          {state === 'denied'  && <MicOff size={19} />}
          {state !== 'denied'  && <Mic size={20} />}
        </button>
      </div>
    </div>
  );
}
