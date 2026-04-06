import { useState } from 'react';
import { Plus, Pencil, Trash2, Pause, Play, Clock } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { SUPPLEMENT_FREQUENCY_LABELS } from '../types';
import type { SupplementSchedule } from '../types';
import { SectionHeader, Card, Badge, EmptyState, Button } from './ui';

interface Props {
  onAdd: () => void;
  onEdit: (schedule: SupplementSchedule) => void;
}

export default function SupplementScheduleList({ onAdd, onEdit }: Props) {
  const { state, updateSupplementSchedule, deleteSupplementSchedule } = useApp();
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const schedules = (state.supplementSchedules ?? []).filter(
    s => s.patientId === state.activePatientId
  );

  if (schedules.length === 0) {
    return (
      <div className="mb-6">
        <SectionHeader
          title="Supplement Schedule"
          action={{ label: 'Add', onClick: onAdd }}
        />
        <EmptyState
          icon={<Clock size={32} className="text-slate-300" />}
          title="No supplements scheduled"
          description="Set up recurring supplements with optional dose reminders."
          action={{ label: 'Add Supplement', onClick: onAdd }}
        />
      </div>
    );
  }

  return (
    <div className="mb-6 space-y-3">
      <SectionHeader
        title="Supplement Schedule"
        action={{ label: 'Add', onClick: onAdd }}
      />

      {schedules.map(schedule => {
        const isDeleting = confirmDeleteId === schedule.id;

        return (
          <Card key={schedule.id} padding>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    schedule.status === 'active' ? 'bg-teal-500' : 'bg-slate-300'
                  }`} />
                  <h4 className="font-semibold text-slate-900 truncate">{schedule.name}</h4>
                  {schedule.dosage && (
                    <span className="text-xs text-slate-500 font-medium">{schedule.dosage}</span>
                  )}
                </div>

                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {schedule.form && <Badge variant="neutral">{schedule.form}</Badge>}
                  {schedule.status === 'paused' && <Badge variant="warning">Paused</Badge>}
                </div>

                <p className="text-xs text-slate-400 mt-1.5">
                  {SUPPLEMENT_FREQUENCY_LABELS[schedule.frequency]}
                  {schedule.reminderTime && ` · ${schedule.reminderTime}`}
                </p>

                {schedule.notes && (
                  <p className="text-xs text-slate-400 mt-1 italic">{schedule.notes}</p>
                )}
              </div>

              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => onEdit(schedule)}
                  className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                  title="Edit"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => updateSupplementSchedule(schedule.id, {
                    status: schedule.status === 'active' ? 'paused' : 'active',
                  })}
                  className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                  title={schedule.status === 'active' ? 'Pause' : 'Resume'}
                >
                  {schedule.status === 'active' ? <Pause size={14} /> : <Play size={14} />}
                </button>
                {isDeleting ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => { deleteSupplementSchedule(schedule.id); setConfirmDeleteId(null); }}
                      className="text-xs px-2 py-1 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                    >
                      Yes
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="text-xs px-2 py-1 border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDeleteId(schedule.id)}
                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          </Card>
        );
      })}

      <Button variant="outline" size="sm" className="w-full" onClick={onAdd} iconLeft={<Plus size={14} />}>
        Add Another Supplement
      </Button>
    </div>
  );
}
