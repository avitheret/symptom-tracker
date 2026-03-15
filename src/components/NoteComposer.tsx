import { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, PenLine } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { getSpeechRecognition } from '../utils/speech';
import type { Note } from '../types';
import { Sheet, Button } from './ui';

interface Props {
  onClose:             () => void;
  initialNote?:        Note;           // set when editing an existing note
  autoStartDictation?: boolean;        // true when opened via ADD_NOTE voice command
  /** Called when dictation goes live — use to pause the wake-word system */
  onDictationStart?:   () => void;
  /** Called when dictation ends — use to resume the wake-word system */
  onDictationEnd?:     () => void;
  /** Called after a NEW note is saved — provides the note ID + text for extraction */
  onNoteSaved?:        (noteId: string, text: string) => void;
}

type DictState = 'idle' | 'listening' | 'error';

const SR = getSpeechRecognition();

const MAX_CHARS = 2000;

// Phrases that trigger an immediate hands-free save
const SAVE_PHRASES = ['save note', 'save this note', 'save the note', 'save my note'];

const DICT_DEBUG = typeof window === 'undefined' ? false
  : localStorage.getItem('voice-debug') === '1';
function dlog(...args: unknown[]) {
  if (DICT_DEBUG) console.log('[Dictation]', ...args);
}

export default function NoteComposer({
  onClose, initialNote, autoStartDictation, onDictationStart, onDictationEnd, onNoteSaved,
}: Props) {
  const { addNote, updateNote } = useApp();
  const isEditing = !!initialNote;

  const [text,      setText]      = useState(initialNote?.text ?? '');
  const [dictState, setDictState] = useState<DictState>('idle');

  const recognitionRef = useRef<any>(null);
  const textareaRef    = useRef<HTMLTextAreaElement>(null);
  // Always-current mirror of `text` for use inside recognition event closures
  // (closures capture stale state; refs always have the live value)
  const latestTextRef  = useRef<string>(initialNote?.text ?? '');
  // True while the user has dictation "on" — including across auto-restarts
  const isActiveRef    = useRef<boolean>(false);
  // Guards against state updates after unmount.
  // IMPORTANT: setup must reset to true — React StrictMode runs
  // setup → cleanup → setup, and cleanup sets this to false.
  const mountedRef     = useRef<boolean>(true);

  useEffect(() => {
    mountedRef.current = true;       // ← reset on every setup (fixes StrictMode)
    return () => { mountedRef.current = false; };
  }, []);

  // ── Save helper ────────────────────────────────────────────────────────────
  const commitSave = useCallback((source: 'voice' | 'typed') => {
    const trimmed = latestTextRef.current.trim();
    if (!trimmed) return;
    if (isEditing) {
      updateNote(initialNote!.id, trimmed);
    } else {
      const noteId = addNote(trimmed, source);
      if (noteId && onNoteSaved) onNoteSaved(noteId, trimmed);
    }
    onClose();
  }, [isEditing, initialNote, addNote, updateNote, onClose, onNoteSaved]);

  // ── Dictation ──────────────────────────────────────────────────────────────
  const stopDictation = useCallback(() => {
    dlog('stopDictation called');
    isActiveRef.current = false;
    try { recognitionRef.current?.stop(); } catch (_) {}
    recognitionRef.current = null;
    if (mountedRef.current) setDictState('idle');
    onDictationEnd?.();
  }, [onDictationEnd]);

  const startDictation = useCallback(() => {
    dlog('startDictation called | SR:', !!SR, '| isActive:', isActiveRef.current,
      '| mounted:', mountedRef.current);

    if (!SR) { setDictState('error'); return; }
    if (isActiveRef.current) { stopDictation(); return; } // toggle off

    isActiveRef.current = true;
    onDictationStart?.(); // pause wake-word system once, before any session starts

    // Inner function — restarts itself automatically when iOS/browser ends the session
    // mid-pause. Each restart uses the latest committed text as the base so nothing
    // is lost between segments.
    const launchRec = () => {
      // Chrome only allows ONE SpeechRecognition at a time. After the wake-word
      // listener is stopped (via onDictationStart → disableWakeWord), the browser
      // needs a moment to fully release it before we can start a new session.
      // Safari handles this gracefully, Chrome does not — so we add a short delay.
      dlog('launchRec: scheduling startRec in 300ms | isActive:', isActiveRef.current,
        '| mounted:', mountedRef.current);
      setTimeout(() => {
        dlog('launchRec timeout fired | isActive:', isActiveRef.current,
          '| mounted:', mountedRef.current);
        if (isActiveRef.current && mountedRef.current) {
          startRec();
        } else {
          dlog('⚠️ launchRec bailed out — isActive:', isActiveRef.current,
            '| mounted:', mountedRef.current);
        }
      }, 300);
    };

    const startRec = () => {
      if (!isActiveRef.current || !mountedRef.current) {
        dlog('⚠️ startRec bailed out — isActive:', isActiveRef.current,
          '| mounted:', mountedRef.current);
        return;
      }

      const rec = new SR() as any;
      rec.lang           = 'en-US';
      rec.continuous     = true;  // keep listening across pauses (Chrome/desktop)
      rec.interimResults = true;
      recognitionRef.current = rec;

      // Snapshot the already-committed text at the start of each new segment
      const segmentBase = latestTextRef.current.trimEnd();

      rec.onstart = () => {
        dlog('✅ rec.onstart — dictation is live');
        if (mountedRef.current) setDictState('listening');
      };

      rec.onresult = (event: any) => {
        if (!isActiveRef.current) return;

        const allResults = Array.from(event.results as any[]);

        // ── Check NEW final segments for "save note" voice command ────────────
        // We only inspect segments from resultIndex onward to avoid re-checking
        // previously processed text.
        const newSegs = allResults.slice(event.resultIndex);
        for (const seg of newSegs as any[]) {
          const transcript = seg[0].transcript.toLowerCase().trim();
          const isSaveCmd  = SAVE_PHRASES.some(p => transcript.includes(p));
          if (isSaveCmd) {
            if (seg.isFinal) {
              // Confirmed save command — stop and save WITHOUT appending "save note"
              dlog('save command detected — saving note');
              isActiveRef.current = false;
              try { rec.stop(); } catch (_) {}
              recognitionRef.current = null;
              if (mountedRef.current) setDictState('idle');
              onDictationEnd?.();
              commitSave('voice');
              return;
            } else {
              // Interim that looks like a save command — hold off updating the
              // textarea until we know if it becomes final or changes
              return;
            }
          }
        }

        // ── Normal accumulation ───────────────────────────────────────────────
        // `allResults` covers the entire current recognition session; adding
        // `segmentBase` prepends text from earlier auto-restart segments.
        const sessionText = allResults.map((r: any) => r[0].transcript).join('');
        const candidate   = segmentBase ? `${segmentBase} ${sessionText}` : sessionText;
        const clipped     = candidate.slice(0, MAX_CHARS);
        latestTextRef.current = clipped;
        if (mountedRef.current) setText(clipped);
      };

      rec.onend = () => {
        recognitionRef.current = null;
        if (!mountedRef.current) return;

        if (isActiveRef.current) {
          // Auto-restart to bridge pauses — critical on iOS where continuous:true
          // still stops the session after ~5–8 s or a brief silence.
          // Commit the current text cleanly before the new segment starts.
          dlog('rec.onend — auto-restarting in 200ms');
          const committed = latestTextRef.current.trimEnd();
          latestTextRef.current = committed;
          setText(committed);
          setTimeout(startRec, 200);
        } else {
          // Truly stopped (manual stop or save command already handled above)
          dlog('rec.onend — stopped');
          setDictState('idle');
          const trimmed = latestTextRef.current.trimEnd();
          latestTextRef.current = trimmed;
          setText(trimmed);
          // onDictationEnd was already called by whoever set isActiveRef to false
        }
      };

      rec.onerror = (e: any) => {
        dlog('⚠️ rec.onerror:', e.error);
        // 'no-speech' fires during silence on some browsers/OS combos; onend
        // will handle the restart — ignore it here to avoid disrupting the session.
        if (e.error === 'no-speech') return;
        recognitionRef.current = null;
        isActiveRef.current = false;
        if (mountedRef.current) {
          setDictState('error');
          onDictationEnd?.();
          setTimeout(() => { if (mountedRef.current) setDictState('idle'); }, 3000);
        }
      };

      try {
        dlog('calling rec.start()...');
        rec.start();
        dlog('rec.start() succeeded');
      } catch (err) {
        dlog('❌ rec.start() threw:', err);
        recognitionRef.current = null;
        isActiveRef.current = false;
        if (mountedRef.current) setDictState('error');
      }
    };

    launchRec();
  }, [stopDictation, onDictationStart, onDictationEnd, commitSave]);

  // Auto-start when opened via voice ADD_NOTE command.
  // Short delay gives the NoteComposer sheet time to render and the wake-word
  // SpeechRecognition to fully shut down (startDictation adds its own 300ms
  // Chrome safety delay internally via launchRec).
  useEffect(() => {
    if (autoStartDictation && SR) {
      dlog('auto-start effect: scheduling startDictation in 400ms');
      const t = setTimeout(startDictation, 400);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isActiveRef.current = false;
      try { recognitionRef.current?.stop(); } catch (_) {}
    };
  }, []);

  // ── Manual save (button) ───────────────────────────────────────────────────
  function handleSave() {
    const wasListening = isActiveRef.current;
    stopDictation();
    commitSave(wasListening ? 'voice' : 'typed');
  }

  const charsLeft     = MAX_CHARS - text.length;
  const overLimit     = charsLeft < 0;
  const canSave       = text.trim().length > 0 && !overLimit;
  const dictSupported = !!SR;

  return (
    <Sheet
      title={isEditing ? 'Edit Note' : 'New Note'}
      icon={<PenLine size={16} className="text-slate-500" />}
      onClose={() => { stopDictation(); onClose(); }}
    >
      <div className="px-5 py-4 space-y-4">

        {/* ── Textarea ──────────────────────────────────────────────────────── */}
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={e => {
              const v = e.target.value.slice(0, MAX_CHARS + 50);
              latestTextRef.current = v;
              setText(v);
            }}
            placeholder="Type your note here, or tap the mic to dictate…"
            rows={7}
            autoFocus={!autoStartDictation}
            className="w-full border border-slate-300 rounded-xl px-3.5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none bg-white leading-relaxed"
            style={{ minHeight: 160 }}
          />
          <span className={`absolute bottom-2.5 right-3 text-xs tabular-nums ${
            overLimit ? 'text-red-500 font-semibold' : 'text-slate-300'
          }`}>
            {charsLeft < 200 ? `${charsLeft} left` : ''}
          </span>
        </div>

        {/* ── Dictation status ──────────────────────────────────────────────── */}
        {dictState === 'listening' && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
            <span>Listening… say <strong>"save note"</strong> when done</span>
          </div>
        )}
        {dictState === 'error' && (
          <p className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">
            Microphone unavailable. Please check permissions.
          </p>
        )}

        {/* ── Action buttons ────────────────────────────────────────────────── */}
        <div className="flex gap-2.5 pb-safe">

          {/* Mic toggle */}
          {dictSupported && (
            <button
              type="button"
              onClick={dictState === 'listening' ? stopDictation : startDictation}
              className={`flex items-center justify-center w-12 h-12 rounded-xl border transition-colors flex-shrink-0 ${
                dictState === 'listening'
                  ? 'bg-red-500 border-red-500 text-white'
                  : 'border-slate-300 text-slate-500 hover:border-blue-400 hover:text-blue-600 bg-white'
              }`}
              aria-label={dictState === 'listening' ? 'Stop dictation' : 'Start dictation'}
            >
              {dictState === 'listening' ? <MicOff size={18} /> : <Mic size={18} />}
            </button>
          )}

          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={() => { stopDictation(); onClose(); }}
            className="flex-1"
          >
            Cancel
          </Button>

          <Button
            type="button"
            variant="primary"
            size="lg"
            disabled={!canSave}
            onClick={handleSave}
            className="flex-1"
          >
            Save Note
          </Button>

        </div>
      </div>
    </Sheet>
  );
}
