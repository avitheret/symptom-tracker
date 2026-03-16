import { useState, useEffect } from 'react';
import { Search, Plus, ChevronRight, Tag, ArrowLeft, Stethoscope, X } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import type { Condition } from '../types';
import AddConditionModal from './AddConditionModal';
import AddSymptomModal from './AddSymptomModal';
import TrackingModal from './TrackingModal';
import SymptomsList from './SymptomsList';

export default function ConditionsList() {
  const { state, selectCondition, getPatientConditions, removeConditionFromPatient } = useApp();
  const [query, setQuery] = useState('');
  const [showAddCondition, setShowAddCondition] = useState(false);
  const [addSymptomFor, setAddSymptomFor] = useState<Condition | null>(null);
  const [trackingCondition, setTrackingCondition] = useState<Condition | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

  const conditions = getPatientConditions(state.activePatientId ?? '');

  // If selected condition no longer exists in this patient's conditions, clear it
  useEffect(() => {
    if (state.selectedConditionId && !conditions.some(c => c.id === state.selectedConditionId)) {
      selectCondition(null);
    }
  }, [state.activePatientId, conditions, state.selectedConditionId, selectCondition]);

  const selected = state.selectedConditionId
    ? conditions.find(c => c.id === state.selectedConditionId) ?? null
    : null;

  const filtered = conditions.filter(c =>
    c.name.toLowerCase().includes(query.toLowerCase())
  );

  // Entries for the active patient (for symptom log counts)
  const patientEntries = state.entries.filter(e => e.patientId === state.activePatientId);

  // Shared condition list panel
  const conditionListPanel = (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden h-full flex flex-col">
      {/* Search */}
      <div className="p-3 border-b border-slate-100">
        <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2.5 min-h-[44px]">
          <Search size={15} className="text-slate-400 flex-shrink-0" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search conditions..."
            className="bg-transparent text-sm flex-1 outline-none text-slate-700 placeholder-slate-400"
          />
        </div>
      </div>

      {/* List */}
      <div className="divide-y divide-slate-50 flex-1 overflow-y-auto">
        {filtered.length === 0 && (
          <div className="py-10 px-4 text-center space-y-3">
            <Tag size={28} className="text-slate-300 mx-auto" />
            <p className="text-sm text-slate-400">
              {conditions.length === 0 ? 'No conditions added yet.' : 'No conditions match your search.'}
            </p>
            {conditions.length === 0 && (
              <button
                onClick={() => setShowAddCondition(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors min-h-[44px]"
              >
                <Plus size={14} />Add Your First Condition
              </button>
            )}
          </div>
        )}
        {filtered.map(c => {
          const entryCount = patientEntries.filter(e => e.conditionId === c.id).length;
          const isConfirming = confirmRemoveId === c.id;
          return (
            <div key={c.id} className={`transition-colors ${selected?.id === c.id ? 'bg-blue-50' : ''}`}>
              {isConfirming ? (
                <div className="px-4 py-3 bg-red-50 border-l-2 border-red-300">
                  <p className="text-xs font-semibold text-slate-700 mb-1">Remove {c.name}?</p>
                  <p className="text-[10px] text-slate-400 mb-2 leading-relaxed">Logs are kept. You can re-add anytime.</p>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => setConfirmRemoveId(null)}
                      className="flex-1 py-1.5 text-xs font-medium text-slate-600 bg-white rounded-lg border border-slate-200 hover:bg-slate-50"
                    >Cancel</button>
                    <button
                      onClick={() => {
                        setConfirmRemoveId(null);
                        if (selected?.id === c.id) selectCondition(null);
                        removeConditionFromPatient(state.activePatientId!, c.id);
                      }}
                      className="flex-1 py-1.5 text-xs font-semibold text-white bg-red-500 rounded-lg hover:bg-red-600"
                    >Remove</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center hover:bg-slate-50 active:bg-slate-100 min-h-[60px]">
                  <button
                    onClick={() => selectCondition(c.id)}
                    className="flex-1 flex items-center gap-3 px-4 py-4 text-left min-h-[60px]"
                  >
                    <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm truncate ${selected?.id === c.id ? 'font-semibold text-blue-700' : 'font-medium text-slate-700'}`}>
                        {c.name}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {c.symptoms.length} symptom{c.symptoms.length !== 1 ? 's' : ''} · {entryCount} log{entryCount !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <ChevronRight size={15} className={`flex-shrink-0 ${selected?.id === c.id ? 'text-blue-400' : 'text-slate-300'}`} />
                  </button>
                  <button
                    onClick={() => setConfirmRemoveId(c.id)}
                    className="px-3 py-4 text-slate-300 hover:text-red-400 transition-colors min-h-[60px] flex items-center"
                    title="Remove condition"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add condition */}
      <div className="p-3 border-t border-slate-100">
        <button
          onClick={() => setShowAddCondition(true)}
          className="w-full flex items-center gap-2 justify-center text-sm font-medium text-blue-600 hover:text-blue-800 py-2.5 rounded-xl hover:bg-blue-50 active:bg-blue-100 transition-colors min-h-[44px]"
        >
          <Plus size={15} />Add Condition
        </button>
      </div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">

      {/* Page header — desktop only (mobile uses back-nav) */}
      <div className="hidden sm:block mb-2">
        <h1 className="text-2xl font-bold text-slate-900">Conditions</h1>
        <p className="text-sm text-slate-400 mt-0.5">Manage your conditions and their symptoms.</p>
      </div>

      {/* ── Mobile: single-panel with back-nav ── */}
      <div className="sm:hidden">
        {!selected ? (
          conditionListPanel
        ) : (
          <div>
            {/* Back button */}
            <button
              onClick={() => selectCondition(null)}
              className="flex items-center gap-2 text-sm font-medium text-blue-600 mb-4 py-2 px-1 -ml-1 min-h-[44px] active:opacity-60 transition-opacity"
            >
              <ArrowLeft size={16} />
              <span>Back to conditions</span>
            </button>
            <SymptomsList
              condition={selected}
              entries={patientEntries}
              onAddSymptom={() => setAddSymptomFor(selected)}
              onLog={() => setTrackingCondition(selected)}
            />
          </div>
        )}
      </div>

      {/* ── Desktop: sidebar + detail ── */}
      <div className="hidden sm:flex gap-4">
        {/* Sidebar */}
        <aside className="w-64 flex-shrink-0">
          {conditionListPanel}
        </aside>

        {/* Detail */}
        <main className="flex-1 min-w-0">
          {!selected ? (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-10 text-center h-full min-h-[320px] flex flex-col items-center justify-center gap-4">
              <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center">
                <Stethoscope size={28} className="text-blue-400" />
              </div>
              <div className="space-y-1">
                <p className="text-base font-semibold text-slate-700">
                  {conditions.length === 0 ? 'No conditions yet' : 'Select a condition'}
                </p>
                <p className="text-sm text-slate-400 max-w-[220px] mx-auto leading-relaxed">
                  {conditions.length === 0
                    ? 'Add your first condition to start tracking and logging symptoms.'
                    : 'Choose a condition from the list to view and manage its symptoms.'}
                </p>
              </div>
              {conditions.length === 0 && (
                <button
                  onClick={() => setShowAddCondition(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors min-h-[44px]"
                >
                  <Plus size={14} />Add First Condition
                </button>
              )}
            </div>
          ) : (
            <SymptomsList
              condition={selected}
              entries={patientEntries}
              onAddSymptom={() => setAddSymptomFor(selected)}
              onLog={() => setTrackingCondition(selected)}
            />
          )}
        </main>
      </div>

      {/* Modals */}
      {showAddCondition && <AddConditionModal onClose={() => setShowAddCondition(false)} />}
      {addSymptomFor && <AddSymptomModal condition={addSymptomFor} onClose={() => setAddSymptomFor(null)} />}
      {trackingCondition && (
        <TrackingModal condition={trackingCondition} onClose={() => setTrackingCondition(null)} />
      )}
    </div>
  );
}
