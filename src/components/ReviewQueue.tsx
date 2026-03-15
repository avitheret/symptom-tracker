import { useState } from 'react';
import { Mic, Check, X, Edit3, CheckCheck } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import TrackingModal from './TrackingModal';
import { Card, SectionHeader, SeverityBadge } from './ui';
import type { Condition, TrackingEntry } from '../types';

interface Props {
  conditions: Condition[];
}

export default function ReviewQueue({ conditions }: Props) {
  const { state, approveEntry, disapproveEntry } = useApp();
  const [editTarget, setEditTarget] = useState<TrackingEntry | null>(null);

  const pending = state.entries.filter(
    e => e.patientId === state.activePatientId && e.reviewStatus === 'to_review',
  );

  if (pending.length === 0) return null;

  const sorted = [...pending].sort((a, b) => b.createdAt - a.createdAt);

  function approveAll() {
    pending.forEach(e => approveEntry(e.id));
  }

  return (
    <section>
      <SectionHeader
        title="Voice Logs to Review"
        trailing={
          pending.length > 1 ? (
            <button
              onClick={approveAll}
              className="flex items-center gap-1 text-xs font-medium text-green-600 hover:text-green-700 transition-colors px-2 py-1 rounded-lg hover:bg-green-50 min-h-[32px]"
            >
              <CheckCheck size={13} />
              Approve All
            </button>
          ) : undefined
        }
      />
      <Card padding={false}>
        {/* Header hint */}
        <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border-b border-amber-100 rounded-t-2xl">
          <Mic size={14} className="text-amber-500 flex-shrink-0" />
          <p className="text-xs text-amber-700 font-medium">
            Review voice-logged entries before they appear in reports.
          </p>
        </div>

        <div className="divide-y divide-slate-50">
          {sorted.map(entry => {
            const cond = conditions.find(c => c.id === entry.conditionId);
            return (
              <div
                key={entry.id}
                className="flex items-center gap-3 px-4 py-3.5 min-h-[60px]"
              >
                {/* Condition dot */}
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: cond?.color ?? '#94a3b8' }}
                />

                {/* Entry info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm font-semibold text-slate-900">
                      {entry.symptomName}
                    </span>
                    <span className="text-xs text-slate-400">&ndash;</span>
                    <span className="text-xs text-slate-500">
                      {entry.conditionName}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {entry.date} &middot; {entry.time}
                    {entry.severity !== 5 && (
                      <span className="ml-1.5">&middot; Severity {entry.severity}/10</span>
                    )}
                  </p>
                </div>

                {/* Severity */}
                <SeverityBadge severity={entry.severity} />

                {/* Action buttons */}
                <div className="flex items-center gap-0.5 flex-shrink-0">
                  <button
                    onClick={() => setEditTarget(entry)}
                    className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
                    title="Edit before approving"
                  >
                    <Edit3 size={15} />
                  </button>
                  <button
                    onClick={() => approveEntry(entry.id)}
                    className="p-2 rounded-lg text-slate-400 hover:text-green-600 hover:bg-green-50 transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
                    title="Approve entry"
                  >
                    <Check size={15} />
                  </button>
                  <button
                    onClick={() => disapproveEntry(entry.id)}
                    className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
                    title="Disapprove entry"
                  >
                    <X size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Edit modal */}
      {editTarget && (() => {
        const editCondition = conditions.find(c => c.id === editTarget.conditionId);
        return editCondition ? (
          <TrackingModal
            condition={editCondition}
            existingEntry={editTarget}
            onClose={() => setEditTarget(null)}
          />
        ) : null;
      })()}
    </section>
  );
}
