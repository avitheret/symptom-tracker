import { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, PenLine, Camera, Loader2, AlignLeft } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { getSpeechRecognition } from '../utils/speech';
import { scanHandwrittenNote, entriesToText, isTrackTable, parseTrackTable, trackTableToPlainText } from '../utils/scanNote';
import type { TrackEntry } from '../utils/scanNote';
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
type ScanState = 'idle' | 'scanning' | 'error';

const SR = getSpeechRecognition();

const MAX_CHARS = 2000;

// Phrases that trigger an immediate hands-free save
const SAVE_PHRASES = ['save note', 'save this note', 'save the note', 'save my note'];

const DICT_DEBUG = typeof window === 'undefined' ? false
  : localStorage.getItem('voice-debug') === '1';
function dlog(...args: unknown[]) {
  if (DICT_DEBUG) console.log('[Dictation]', ...args);
}

// ── Condition guessing ────────────────────────────────────────────────────────

/**
 * For entries with no condition, try to infer one from the user's symptom
 * tracking history. Marks matched entries with conditionGuessed = true.
 */
function guessConditions(
  entries: TrackEntry[],
  state: ReturnType<typeof useApp>['state'],
): TrackEntry[] {
  // Build symptom → condition map from the patient's tracking history
  const map = new Map<string, string>();
  for (const e of state.entries ?? []) {
    if (e.patientId === state.activePatientId && e.symptomName && e.conditionName) {
      map.set(e.symptomName.toLowerCase(), e.conditionName);
    }
  }
  if (map.size === 0) return entries;

  return entries.map(entry => {
    if (entry.condition || !entry.entry) return entry;
    const needle = entry.entry.toLowerCase();
    for (const [symptom, condition] of map) {
      if (needle.includes(symptom) || symptom.includes(needle)) {
        return { ...entry, condition, conditionGuessed: true };
      }
    }
    return entry;
  });
}

export default function NoteComposer({
  onClose, initialNote, autoStartDictation, onDictationStart, onDictationEnd, onNoteSaved,
}: Props) {
  const { addNote, updateNote, state } = useApp();
  const isEditing = !!initialNote;

  const initText = initialNote
    ? (isTrackTable(initialNote.text) ? trackTableToPlainText(initialNote.text) : initialNote.text)
    : '';

  const [text,          setText]          = useState(initText);
  const [dictState,     setDictState]     = useState<DictState>('idle');
  const [scanState,     setScanState]     = useState<ScanState>('idle');
  const [scanError,     setScanError]     = useState<string | null>(null);
  // Structured entries from the last camera scan (shown as cards)
  const [scannedEntries, setScannedEntries] = useState<TrackEntry[] | null>(
    initialNote && isTrackTable(initialNote.text) ? parseTrackTable(initialNote.text) : null
  );
  // Whether the user wants to see/edit the raw text instead of the cards
  const [showRawScan,   setShowRawScan]   = useState(false);
  // Tracks whether camera was used so we can save with sourceType 'camera'
  const usedCameraRef = useRef<boolean>(!!initialNote && initialNote.sourceType === 'camera');

  const recognitionRef = useRef<any>(null);
  const textareaRef    = useRef<HTMLTextAreaElement>(null);
  const fileInputRef   = useRef<HTMLInputElement>(null);
  // Always-current mirror of `text` for use inside recognition event closures
  // (closures capture stale state; refs always have the live value)
  const latestTextRef  = useRef<string>(initText);
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
    const effectiveSource: Note['sourceType'] =
      usedCameraRef.current ? 'camera' : source;
    // For the extraction system, save the plain text (strip __TT__ marker).
    // The displayed table is re-derived from the stored pipe lines on render.
    const stored = isTrackTable(trimmed) ? trimmed : trimmed;
    if (isEditing) {
      updateNote(initialNote!.id, stored);
    } else {
      const noteId = addNote(stored, effectiveSource);
      if (noteId && onNoteSaved) onNoteSaved(noteId, stored);
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

  // ── Camera scan ───────────────────────────────────────────────────────────
  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // reset so same file can be re-selected
    if (!file) return;

    setScanState('scanning');
    setScanError(null);

    try {
      const result = await scanHandwrittenNote(file);

      if (result.entries && result.entries.length > 0) {
        // Table detected — guess missing conditions from symptom history
        const enriched = guessConditions(result.entries, state);
        setScannedEntries(enriched);
        setShowRawScan(false);
        // Re-serialise with guessed conditions filled in
        const enrichedText = entriesToText(enriched);
        latestTextRef.current = enrichedText;
        setText(trackTableToPlainText(enrichedText));
      } else {
        // Plain text — append to textarea
        const current = latestTextRef.current.trimEnd();
        const combined = current ? `${current}\n\n${result.text}` : result.text;
        const clipped = combined.slice(0, MAX_CHARS);
        latestTextRef.current = clipped;
        setText(clipped);
        setScannedEntries(null);
      }

      usedCameraRef.current = true;
      setScanState('idle');
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'Scan failed.');
      setScanState('error');
      setTimeout(() => { setScanState('idle'); setScanError(null); }, 4000);
    }
  }

  // ── Manual save (button) ───────────────────────────────────────────────────
  function handleSave() {
    const wasListening = isActiveRef.current;
    stopDictation();
    commitSave(wasListening ? 'voice' : 'typed');
  }

  const charsLeft     = MAX_CHARS - text.length;
  const overLimit     = charsLeft < 0;
  const showCards     = !!scannedEntries && !showRawScan;
  const canSave       = (showCards ? scannedEntries!.length > 0 : text.trim().length > 0) && !overLimit;
  const dictSupported = !!SR;

  return (
    <Sheet
      title={isEditing ? 'Edit Note' : 'New Note'}
      icon={<PenLine size={16} className="text-slate-500" />}
      onClose={() => { stopDictation(); onClose(); }}
    >
      <div className="px-5 py-4 space-y-4">

        {/* ── Scanned entry cards ───────────────────────────────────────────── */}
        {showCards && scannedEntries && (
          <div className="space-y-2">
            {scannedEntries.map((entry, i) => (
              <div key={i} className="flex gap-3 px-3 py-2.5 bg-slate-50 rounded-xl border border-slate-100">
                {/* Time */}
                <span className="text-xs font-bold font-mono text-slate-500 w-14 flex-shrink-0 pt-0.5">
                  {entry.time || '—'}
                </span>
                {/* Body */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap gap-1 mb-0.5">
                    {entry.condition && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        entry.conditionGuessed
                          ? 'bg-violet-50 text-violet-500 italic border border-violet-200'
                          : 'bg-violet-100 text-violet-700'
                      }`}>
                        {entry.conditionGuessed ? `~${entry.condition}` : entry.condition}
                      </span>
                    )}
                    {entry.entry && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                        {entry.entry}
                      </span>
                    )}
                    {!entry.condition && !entry.entry && (
                      <span className="text-xs text-slate-400 italic">no symptom/condition</span>
                    )}
                  </div>
                  {entry.notes && (
                    <p className="text-xs text-slate-500 leading-snug">{entry.notes}</p>
                  )}
                </div>
              </div>
            ))}
            {/* Toggle to raw text */}
            <button
              type="button"
              onClick={() => setShowRawScan(true)}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors px-1"
            >
              <AlignLeft size={11} />
              Edit raw text
            </button>
          </div>
        )}

        {/* ── Textarea (plain text / raw edit mode) ─────────────────────────── */}
        {!showCards && (
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={e => {
                const v = e.target.value.slice(0, MAX_CHARS + 50);
                latestTextRef.current = v;
                setText(v);
                // If user edits raw text, drop the structured card view
                setScannedEntries(null);
              }}
              placeholder="Type your note here, or tap the mic to dictate…"
              rows={7}
              autoFocus={!autoStartDictation && !scannedEntries}
              disabled={scanState === 'scanning'}
              className="w-full border border-slate-300 rounded-xl px-3.5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none bg-white leading-relaxed disabled:opacity-50"
              style={{ minHeight: 160 }}
            />
            <span className={`absolute bottom-2.5 right-3 text-xs tabular-nums ${
              overLimit ? 'text-red-500 font-semibold' : 'text-slate-300'
            }`}>
              {charsLeft < 200 ? `${charsLeft} left` : ''}
            </span>
          </div>
        )}

        {/* ── Status banners ────────────────────────────────────────────────── */}
        {scanState === 'scanning' && (
          <div className="flex items-center gap-2 text-sm text-blue-700 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5">
            <Loader2 size={15} className="animate-spin flex-shrink-0" />
            <span>Reading handwriting…</span>
          </div>
        )}
        {scanState === 'error' && scanError && (
          <p className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">
            {scanError}
          </p>
        )}
        {dictState === 'listening' && scanState === 'idle' && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
            <span>Listening… say <strong>"save note"</strong> when done</span>
          </div>
        )}
        {dictState === 'error' && scanState === 'idle' && (
          <p className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">
            Microphone unavailable. Please check permissions.
          </p>
        )}

        {/* ── Action buttons ────────────────────────────────────────────────── */}
        <div className="flex gap-2.5 pb-safe">

          {/* Hidden file input — triggers camera / photo picker */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileSelected}
          />

          {/* Camera scan button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={scanState === 'scanning' || dictState === 'listening'}
            className="flex items-center justify-center w-12 h-12 rounded-xl border border-slate-300 text-slate-500 hover:border-blue-400 hover:text-blue-600 bg-white transition-colors flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Scan handwritten note"
          >
            {scanState === 'scanning'
              ? <Loader2 size={18} className="animate-spin" />
              : <Camera size={18} />}
          </button>

          {/* Mic toggle */}
          {dictSupported && (
            <button
              type="button"
              onClick={dictState === 'listening' ? stopDictation : startDictation}
              disabled={scanState === 'scanning'}
              className={`flex items-center justify-center w-12 h-12 rounded-xl border transition-colors flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed ${
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
            disabled={!canSave || scanState === 'scanning'}
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
