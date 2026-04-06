/**
 * SupplementDatabase — table view of the Supabase-backed supplement database.
 * Shows all entries for the active patient with delete support.
 */
import { useState, useMemo } from 'react';
import { Database, Trash2, Upload } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { SUPPLEMENT_TIME_WINDOWS } from '../types';
import type { SupplementDatabaseEntry } from '../types';
import { Card, SectionHeader, EmptyState } from './ui';
import SupplementDatabaseUpload from './SupplementDatabaseUpload';

export default function SupplementDatabase() {
  const { state, deleteSupplementDatabaseEntry } = useApp();
  const [showUpload, setShowUpload] = useState(false);

  const entries = useMemo(
    () =>
      (state.supplementDatabase ?? [])
        .filter(e => e.patientId === state.activePatientId)
        .sort((a, b) => {
          const order: Record<string, number> = { morning: 0, breakfast: 1, lunch: 2, dinner: 3, bed: 4 };
          return (order[a.timeWindow] ?? 99) - (order[b.timeWindow] ?? 99);
        }),
    [state.supplementDatabase, state.activePatientId]
  );

  if (entries.length === 0 && !showUpload) {
    return (
      <div className="space-y-4">
        <EmptyState
          icon={<Database size={24} className="text-teal-400" />}
          title="No supplement list uploaded"
          description="Upload an Excel file to set up your daily supplement list with time-window reminders."
          action={{
            label: 'Upload Excel File',
            onClick: () => setShowUpload(true),
            icon: <Upload size={14} />,
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {showUpload && (
        <SupplementDatabaseUpload onDone={() => setShowUpload(false)} />
      )}

      {entries.length > 0 && (
        <>
          <SectionHeader
            title="My Supplement List"
            trailing={
              <button
                onClick={() => setShowUpload(s => !s)}
                className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 px-2.5 py-1.5 rounded-lg transition-colors min-h-[32px]"
              >
                <Upload size={12} />
                Upload new list
              </button>
            }
          />
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="text-left px-4 py-2.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">Name</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">Time Window</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">Quantity</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">Description</th>
                    <th className="w-12" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {entries.map(entry => (
                    <SupplementRow key={entry.id} entry={entry} onDelete={deleteSupplementDatabaseEntry} />
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

function SupplementRow({
  entry,
  onDelete,
}: {
  entry: SupplementDatabaseEntry;
  onDelete: (id: string) => Promise<void>;
}) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    await onDelete(entry.id);
  }

  return (
    <tr className="hover:bg-slate-50 transition-colors group">
      <td className="px-4 py-3 font-medium text-slate-900">{entry.name}</td>
      <td className="px-4 py-3 text-slate-600">
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-teal-50 text-teal-700">
          {SUPPLEMENT_TIME_WINDOWS[entry.timeWindow].label}
        </span>
      </td>
      <td className="px-4 py-3 text-slate-600">{entry.quantity}</td>
      <td className="px-4 py-3 text-slate-500 text-xs max-w-[200px] truncate" title={entry.description}>
        {entry.description}
      </td>
      <td className="px-2 py-3">
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="text-slate-300 hover:text-red-400 sm:opacity-0 sm:group-hover:opacity-100 transition-all p-2 rounded-lg hover:bg-red-50 min-h-[36px] min-w-[36px] flex items-center justify-center disabled:opacity-50"
          title="Delete"
        >
          <Trash2 size={14} />
        </button>
      </td>
    </tr>
  );
}
