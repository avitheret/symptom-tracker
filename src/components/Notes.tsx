import { useState, useMemo } from 'react';
import { Mic, PenLine, Trash2, Edit2, ClipboardList, Notebook, Sparkles, Check, Link2, Camera, Printer } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { isTrackTable, parseTrackTable } from '../utils/scanNote';
import type { Note } from '../types';
import { Sheet } from './ui';
import NoteComposer from './NoteComposer';
import TrackNotesPrintForm from './TrackNotesPrintForm';

interface Props {
  onNewNote:        () => void;
  onLogFromNote:    (noteText: string) => void;
  onExtractFromNote?: (note: Note) => void;
}

// ── Date formatting helpers (no toLocaleDateString with locale args) ──────────
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS_SHORT   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function formatNoteDate(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const todayStr = now.toDateString();
  const dStr     = d.toDateString();

  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'pm' : 'am';
  const h12  = h % 12 || 12;
  const timeStr = `${h12}:${m} ${ampm}`;

  if (dStr === todayStr) return `Today · ${timeStr}`;

  const yest = new Date(now);
  yest.setDate(now.getDate() - 1);
  if (dStr === yest.toDateString()) return `Yesterday · ${timeStr}`;

  return `${DAYS_SHORT[d.getDay()]}, ${MONTHS_SHORT[d.getMonth()]} ${d.getDate()} · ${timeStr}`;
}

function formatDetailDate(ts: number): string {
  const d   = new Date(ts);
  const h   = d.getHours();
  const m   = String(d.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'pm' : 'am';
  const h12  = h % 12 || 12;
  return `${DAYS_SHORT[d.getDay()]}, ${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} at ${h12}:${m} ${ampm}`;
}

// ── Note preview (first line, truncated) ─────────────────────────────────────
function notePreview(text: string, maxLen = 120): string {
  const first = text.split('\n')[0];
  return first.length > maxLen ? `${first.slice(0, maxLen)}…` : first;
}

// ── Detail Sheet ─────────────────────────────────────────────────────────────
interface DetailProps {
  note:              Note;
  onClose:           () => void;
  onEdit:            (note: Note) => void;
  onDelete:          (id: string) => void;
  onLogFromNote:     (text: string) => void;
  onExtractFromNote?: (note: Note) => void;
}

function NoteDetailSheet({ note, onClose, onEdit, onDelete, onLogFromNote, onExtractFromNote }: DetailProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <Sheet
      title="Note"
      subtitle={formatDetailDate(note.createdAt)}
      icon={<PenLine size={16} className="text-slate-500" />}
      onClose={onClose}
    >
      <div className="px-5 py-4 space-y-4">

        {/* Note body */}
        <div className="bg-amber-50 border border-amber-100 rounded-2xl px-4 py-4 min-h-[120px]">
          {/* Source badge */}
          {note.sourceType === 'voice' && (
            <div className="flex items-center gap-1.5 mb-3">
              <Mic size={12} className="text-amber-600" />
              <span className="text-xs font-semibold text-amber-600 uppercase tracking-wide">Voice note</span>
            </div>
          )}
          {note.sourceType === 'camera' && (
            <div className="flex items-center gap-1.5 mb-3">
              <Camera size={12} className="text-amber-600" />
              <span className="text-xs font-semibold text-amber-600 uppercase tracking-wide">Scanned note</span>
            </div>
          )}

          {/* Table note → entry cards */}
          {isTrackTable(note.text) ? (
            <div className="space-y-2">
              {parseTrackTable(note.text).map((entry, i) => (
                <div key={i} className="flex gap-3 bg-white rounded-xl px-3 py-2 border border-amber-100">
                  <span className="text-xs font-bold font-mono text-slate-500 w-14 flex-shrink-0 pt-0.5">
                    {entry.time || '—'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap gap-1 mb-0.5">
                      {entry.condition && (
                        <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-medium">
                          {entry.condition}
                        </span>
                      )}
                      {entry.entry && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                          {entry.entry}
                        </span>
                      )}
                    </div>
                    {entry.notes && (
                      <p className="text-xs text-slate-500 leading-snug">{entry.notes}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Plain text note */
            <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">{note.text}</p>
          )}

          {note.updatedAt && (
            <p className="text-xs text-slate-400 mt-3">Edited {formatDetailDate(note.updatedAt)}</p>
          )}
        </div>

        {/* Extraction status banner */}
        {note.extractionStatus === 'confirmed' && note.linkedLogIds && note.linkedLogIds.length > 0 && (
          <div className="flex items-center gap-2 bg-green-50 border border-green-100 rounded-xl px-3 py-2.5">
            <Link2 size={13} className="text-green-600 flex-shrink-0" />
            <span className="text-xs text-green-700 font-medium">
              {note.linkedLogIds.length} log{note.linkedLogIds.length !== 1 ? 's' : ''} created from this note
            </span>
          </div>
        )}

        {/* Actions */}
        <div className="grid grid-cols-2 gap-2.5">
          <button
            onClick={() => { onEdit(note); onClose(); }}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 active:scale-[0.97] transition-all min-h-[48px]"
          >
            <Edit2 size={15} />
            Edit
          </button>

          {note.extractionStatus === 'confirmed' ? (
            <button
              onClick={() => {
                onLogFromNote(note.text);
                onClose();
              }}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-600 hover:bg-slate-50 active:scale-[0.97] transition-all min-h-[48px]"
            >
              <ClipboardList size={15} />
              Log More
            </button>
          ) : onExtractFromNote ? (
            <button
              onClick={() => { onExtractFromNote(note); onClose(); }}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-blue-200 bg-blue-50 text-sm font-medium text-blue-700 hover:bg-blue-100 active:scale-[0.97] transition-all min-h-[48px]"
            >
              <Sparkles size={15} />
              Extract Logs
            </button>
          ) : (
            <button
              onClick={() => {
                onLogFromNote(note.text);
                onClose();
              }}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-blue-200 bg-blue-50 text-sm font-medium text-blue-700 hover:bg-blue-100 active:scale-[0.97] transition-all min-h-[48px]"
            >
              <ClipboardList size={15} />
              Log Symptoms
            </button>
          )}
        </div>

        {/* Delete zone */}
        {confirmDelete ? (
          <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 space-y-2.5">
            <p className="text-sm text-red-700 font-medium">Delete this note?</p>
            <p className="text-xs text-red-500">This cannot be undone.</p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDelete(false)}
                className="flex-1 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-600 min-h-[40px]"
              >
                Keep
              </button>
              <button
                onClick={() => { onDelete(note.id); onClose(); }}
                className="flex-1 px-3 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold min-h-[40px]"
              >
                Delete
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl border border-red-100 text-sm font-medium text-red-500 hover:bg-red-50 active:scale-[0.97] transition-all min-h-[48px] pb-safe"
          >
            <Trash2 size={15} />
            Delete Note
          </button>
        )}

      </div>
    </Sheet>
  );
}

// ── Main Notes view ──────────────────────────────────────────────────────────
export default function Notes({ onNewNote, onLogFromNote, onExtractFromNote }: Props) {
  const { state, deleteNote } = useApp();
  const [selectedNote,  setSelectedNote]  = useState<Note | null>(null);
  const [editingNote,   setEditingNote]   = useState<Note | null>(null);
  const [showPrintForm, setShowPrintForm] = useState(false);

  const notes = useMemo(() => {
    return [...state.notes]
      .filter(n => n.patientId === state.activePatientId)
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [state.notes, state.activePatientId]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">

      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Notes</h1>
          {notes.length > 0 && (
            <p className="text-xs text-slate-400 mt-0.5">{notes.length} note{notes.length !== 1 ? 's' : ''}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPrintForm(true)}
            aria-label="Print tracking form"
            className="flex items-center justify-center w-10 h-10 rounded-xl border border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-600 bg-white active:scale-95 transition-all"
          >
            <Printer size={16} />
          </button>
          <button
            onClick={onNewNote}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl min-h-[44px] active:scale-95 transition-transform shadow-sm"
          >
            <PenLine size={15} />
            New Note
          </button>
        </div>
      </div>

      {/* Empty state */}
      {notes.length === 0 && (
        <div className="text-center py-16 space-y-4">
          <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto">
            <Notebook size={28} className="text-amber-400" />
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-slate-700">No notes yet</p>
            <p className="text-sm text-slate-400 max-w-xs mx-auto">
              Capture quick thoughts, observations, or anything useful to share with your doctor.
            </p>
          </div>
          <button
            onClick={onNewNote}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl min-h-[44px] active:scale-95 transition-transform"
          >
            <PenLine size={15} />
            Add your first note
          </button>
        </div>
      )}

      {/* Note cards */}
      {notes.length > 0 && (
        <div className="space-y-2">
          {notes.map(note => (
            <button
              key={note.id}
              onClick={() => setSelectedNote(note)}
              className="w-full text-left bg-white rounded-2xl border border-slate-100 px-4 py-4 active:scale-[0.98] transition-transform hover:border-slate-200 shadow-sm"
            >
              <div className="flex items-start gap-3">
                {/* Icon */}
                <div className="flex-shrink-0 w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center mt-0.5">
                  {note.sourceType === 'voice'
                    ? <Mic size={14} className="text-amber-500" />
                    : note.sourceType === 'camera'
                      ? <Camera size={14} className="text-amber-500" />
                      : <PenLine size={14} className="text-amber-500" />
                  }
                </div>
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 leading-snug line-clamp-2">
                    {notePreview(note.text)}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-xs text-slate-400">{formatNoteDate(note.createdAt)}</span>
                    {note.updatedAt && (
                      <span className="text-xs text-slate-300">· edited</span>
                    )}
                    {note.sourceType === 'voice' && (
                      <span className="text-xs bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-full font-medium">
                        Voice
                      </span>
                    )}
                    {note.sourceType === 'camera' && (
                      <span className="text-xs bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-full font-medium flex items-center gap-0.5">
                        <Camera size={9} />
                        Scanned
                      </span>
                    )}
                    {note.extractionStatus === 'confirmed' && (
                      <span className="text-xs bg-green-100 text-green-600 px-1.5 py-0.5 rounded-full font-medium flex items-center gap-0.5">
                        <Check size={8} />
                        Extracted
                      </span>
                    )}
                    {note.extractionStatus === 'pending' && (
                      <span className="text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full font-medium flex items-center gap-0.5">
                        <Sparkles size={8} />
                        Review
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Detail sheet */}
      {selectedNote && (
        <NoteDetailSheet
          note={selectedNote}
          onClose={() => setSelectedNote(null)}
          onEdit={note => setEditingNote(note)}
          onDelete={id => { deleteNote(id); setSelectedNote(null); }}
          onLogFromNote={text => { onLogFromNote(text); setSelectedNote(null); }}
          onExtractFromNote={onExtractFromNote ? (note) => { onExtractFromNote(note); setSelectedNote(null); } : undefined}
        />
      )}

      {/* Edit composer */}
      {editingNote && (
        <NoteComposer
          initialNote={editingNote}
          onClose={() => setEditingNote(null)}
        />
      )}

      {/* Print form overlay */}
      {showPrintForm && (
        <TrackNotesPrintForm onClose={() => setShowPrintForm(false)} />
      )}

    </div>
  );
}
