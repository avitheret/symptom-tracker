/**
 * VoiceConfirmationCard — shows parsed NLP voice results for review before saving.
 *
 * Uses Sheet from ./ui. User can confirm (save all) or dismiss.
 * Low-confidence results show a warning badge.
 */
import { useState } from 'react';
import { Mic, AlertTriangle, Pill, Heart, Leaf, FileText, Trash2, Check } from 'lucide-react';
import { Sheet, Button, Badge, SeverityBadge } from './ui';
import type { NLPParseResult, ParsedSymptom, ParsedMedication, ParsedSupplement } from '../utils/nlpVoiceParser';

interface Props {
  result: NLPParseResult;
  onConfirm: (result: NLPParseResult) => void;
  onDismiss: () => void;
  loading?: boolean;
}

export default function VoiceConfirmationCard({ result, onConfirm, onDismiss, loading }: Props) {
  // Local editable copy so user can remove items before confirming
  const [symptoms, setSymptoms]       = useState<ParsedSymptom[]>(result.symptoms);
  const [medications, setMedications] = useState<ParsedMedication[]>(result.medications);
  const [supplements, setSupplements] = useState<ParsedSupplement[]>(result.supplements);
  const [notes, setNotes]             = useState(result.notes);

  const hasAnything = symptoms.length > 0 || medications.length > 0 || supplements.length > 0 || notes.length > 0;

  function handleConfirm() {
    onConfirm({
      ...result,
      symptoms,
      medications,
      supplements,
      notes,
    });
  }

  return (
    <Sheet
      title="Voice Entry"
      subtitle={`"${result.transcript.length > 60 ? result.transcript.slice(0, 57) + '...' : result.transcript}"`}
      icon={<Mic size={16} className="text-blue-600" />}
      onClose={onDismiss}
    >
      <div className="px-5 py-4 space-y-4">
        {/* Confidence warning */}
        {result.confidence === 'low' && (
          <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-100 rounded-xl p-3">
            <AlertTriangle size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 leading-relaxed">
              Low confidence parse. Please review carefully before saving.
            </p>
          </div>
        )}

        {/* ── Symptoms ────────────────────────────────────────────────────── */}
        {symptoms.length > 0 && (
          <Section icon={<Heart size={14} />} title="Symptoms" color="text-rose-600">
            {symptoms.map((s, i) => (
              <div key={i} className="flex items-center justify-between gap-2 bg-white rounded-xl border border-slate-100 p-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-800 truncate">{s.symptomName}</p>
                  {s.conditionHint && (
                    <p className="text-[10px] text-slate-400 mt-0.5">{s.conditionHint}</p>
                  )}
                  {s.notes && (
                    <p className="text-[10px] text-slate-400 mt-0.5 italic">{s.notes}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <SeverityBadge severity={s.severity} />
                  <RemoveButton onClick={() => setSymptoms(prev => prev.filter((_, j) => j !== i))} />
                </div>
              </div>
            ))}
          </Section>
        )}

        {/* ── Medications ─────────────────────────────────────────────────── */}
        {medications.length > 0 && (
          <Section icon={<Pill size={14} />} title="Medications" color="text-blue-600">
            {medications.map((m, i) => (
              <div key={i} className="flex items-center justify-between gap-2 bg-white rounded-xl border border-slate-100 p-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-800 truncate">{m.name}</p>
                  {m.dosage && (
                    <p className="text-[10px] text-slate-400 mt-0.5">{m.dosage}{m.route ? ` · ${m.route}` : ''}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Badge variant="info">Taken</Badge>
                  <RemoveButton onClick={() => setMedications(prev => prev.filter((_, j) => j !== i))} />
                </div>
              </div>
            ))}
          </Section>
        )}

        {/* ── Supplements ─────────────────────────────────────────────────── */}
        {supplements.length > 0 && (
          <Section icon={<Leaf size={14} />} title="Supplements" color="text-emerald-600">
            {supplements.map((s, i) => (
              <div key={i} className="flex items-center justify-between gap-2 bg-white rounded-xl border border-slate-100 p-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-800 truncate">{s.name}</p>
                  {s.dosage && (
                    <p className="text-[10px] text-slate-400 mt-0.5">{s.dosage}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Badge variant="success">Taken</Badge>
                  <RemoveButton onClick={() => setSupplements(prev => prev.filter((_, j) => j !== i))} />
                </div>
              </div>
            ))}
          </Section>
        )}

        {/* ── Notes ───────────────────────────────────────────────────────── */}
        {notes && (
          <Section icon={<FileText size={14} />} title="Notes" color="text-slate-600">
            <div className="bg-white rounded-xl border border-slate-100 p-3">
              <textarea
                className="w-full text-sm text-slate-700 bg-transparent resize-none outline-none min-h-[40px]"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
              />
            </div>
          </Section>
        )}

        {!hasAnything && (
          <div className="text-center py-6">
            <p className="text-sm text-slate-500">Nothing extracted from this transcript.</p>
            <p className="text-xs text-slate-400 mt-1">Try being more specific with symptom names and medications.</p>
          </div>
        )}
      </div>

      {/* ── Actions ─────────────────────────────────────────────────────── */}
      <div className="px-5 pt-2 pb-5 flex gap-3" style={{ paddingBottom: `max(1.25rem, env(safe-area-inset-bottom))` }}>
        <Button
          variant="secondary"
          fullWidth
          onClick={onDismiss}
        >
          Dismiss
        </Button>
        <Button
          variant="primary"
          fullWidth
          onClick={handleConfirm}
          disabled={!hasAnything}
          loading={loading}
          iconLeft={<Check size={16} />}
        >
          Save All
        </Button>
      </div>
    </Sheet>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function Section({ icon, title, color, children }: {
  icon: React.ReactNode;
  title: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className={`flex items-center gap-1.5 mb-2 ${color}`}>
        {icon}
        <span className="text-xs font-semibold uppercase tracking-wide">{title}</span>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function RemoveButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center active:scale-[0.95]"
      aria-label="Remove"
    >
      <Trash2 size={12} />
    </button>
  );
}
