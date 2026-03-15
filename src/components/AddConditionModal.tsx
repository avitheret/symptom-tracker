import { useState } from 'react';
import { CheckCircle2, Layers } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { PREDEFINED_CONDITIONS } from '../data/medicalData';
import { Sheet, Button, TabBar } from './ui';
import type { TabItem } from './ui';

const COLORS = [
  '#6366f1', '#f59e0b', '#ef4444', '#06b6d4', '#10b981',
  '#8b5cf6', '#ec4899', '#f97316', '#84cc16', '#0ea5e9',
  '#dc2626', '#64748b',
];

type Tab = 'predefined' | 'custom';

const TABS: TabItem<Tab>[] = [
  { id: 'predefined', label: 'Choose Existing' },
  { id: 'custom',    label: 'Create Custom'   },
];

interface Props {
  onClose: () => void;
}

export default function AddConditionModal({ onClose }: Props) {
  const { state, addConditionToPatient, addCustomCondition, getPatientConditions } = useApp();
  const [tab, setTab] = useState<Tab>('predefined');

  // Predefined tab
  const [selectedId, setSelectedId] = useState('');

  // Custom tab
  const [name,  setName]  = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [error, setError] = useState('');

  const activePatientId   = state.activePatientId;
  const patientConditions = activePatientId ? getPatientConditions(activePatientId) : [];
  const patientConditionIds = new Set(patientConditions.map(c => c.id));

  // Predefined conditions not yet added to this patient
  const available = PREDEFINED_CONDITIONS.filter(c => !patientConditionIds.has(c.id));

  function handleAddPredefined() {
    if (!selectedId || !activePatientId) return;
    addConditionToPatient(activePatientId, selectedId);
    onClose();
  }

  function handleAddCustom(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) { setError('Condition name is required.'); return; }
    if (trimmed.length > 80) { setError('Name must be 80 characters or fewer.'); return; }
    if (!activePatientId) return;
    addCustomCondition(activePatientId, trimmed, color);
    onClose();
  }

  return (
    <Sheet
      title="Add Condition"
      icon={<Layers size={16} className="text-blue-500" />}
      onClose={onClose}
    >
      <div className="px-5 py-4 space-y-4">

        {/* ── Tab picker ──────────────────────────────── */}
        <TabBar tabs={TABS} active={tab} onChange={setTab} compact />

        {/* ── Predefined picker ───────────────────────── */}
        {tab === 'predefined' && (
          <div className="space-y-3">
            {available.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">
                All available conditions have been added to this patient.
              </p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
                  {available.map(c => {
                    const isSelected = selectedId === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setSelectedId(c.id)}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left transition-colors ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50 text-blue-800'
                            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: c.color }}
                        />
                        <span className="flex-1 min-w-0 truncate font-medium text-xs">{c.name}</span>
                        {isSelected && <CheckCircle2 size={13} className="text-blue-600 flex-shrink-0" />}
                      </button>
                    );
                  })}
                </div>

                <div className="flex gap-3 pt-1 pb-safe">
                  <Button type="button" variant="outline" size="lg" onClick={onClose} className="flex-1">
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    size="lg"
                    disabled={!selectedId}
                    onClick={handleAddPredefined}
                    className="flex-1"
                  >
                    Add Condition
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Custom form ─────────────────────────────── */}
        {tab === 'custom' && (
          <form onSubmit={handleAddCustom} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Condition Name
              </label>
              <input
                type="text"
                value={name}
                onChange={e => { setName(e.target.value); setError(''); }}
                placeholder="e.g. Chronic Fatigue"
                className="w-full border border-slate-300 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 min-h-[48px] bg-white"
                autoFocus
              />
              {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Color</label>
              <div className="flex gap-2 flex-wrap">
                {COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`w-8 h-8 rounded-full border-2 transition-transform ${
                      color === c ? 'border-slate-800 scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-1 pb-safe">
              <Button type="button" variant="outline" size="lg" onClick={onClose} className="flex-1">
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="lg" className="flex-1">
                Create Condition
              </Button>
            </div>
          </form>
        )}

      </div>
    </Sheet>
  );
}
