import { useState } from 'react';
import { Plus, Users, Pencil, Trash2, Check, X } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import type { Patient } from '../types';
import AddPatientModal from './AddPatientModal';

function PatientCard({
  patient,
  entryCount,
  conditionCount,
  lastEntryDate,
  isActive,
  isOnly,
  onActivate,
  onUpdate,
  onDelete,
}: {
  patient: Patient;
  entryCount: number;
  conditionCount: number;
  lastEntryDate?: string;
  isActive: boolean;
  isOnly: boolean;
  onActivate: () => void;
  onUpdate: (patch: Partial<Pick<Patient, 'name' | 'dateOfBirth' | 'notes' | 'diagnosis'>>) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(patient.name);
  const [editDob, setEditDob] = useState(patient.dateOfBirth ?? '');
  const [editNotes, setEditNotes] = useState(patient.notes ?? '');
  const [editDiagnosis, setEditDiagnosis] = useState(patient.diagnosis ?? '');
  const [confirmDelete, setConfirmDelete] = useState(false);

  function saveEdit() {
    if (!editName.trim()) return;
    onUpdate({ name: editName.trim(), dateOfBirth: editDob || undefined, notes: editNotes || undefined, diagnosis: editDiagnosis.trim() || undefined });
    setEditing(false);
  }

  function cancelEdit() {
    setEditName(patient.name);
    setEditDob(patient.dateOfBirth ?? '');
    setEditNotes(patient.notes ?? '');
    setEditDiagnosis(patient.diagnosis ?? '');
    setEditing(false);
  }

  const inputCls = 'w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400';

  return (
    <div
      className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${isActive ? 'border-blue-300 ring-2 ring-blue-100' : 'border-slate-100 hover:border-slate-200'}`}
    >
      <div className={`h-1.5 w-full ${isActive ? 'bg-blue-600' : 'bg-slate-200'}`} />

      <div className="p-4">
        {editing ? (
          <div className="space-y-2">
            <input
              type="text"
              value={editName}
              onChange={e => setEditName(e.target.value)}
              className={inputCls}
              placeholder="Name"
              autoFocus
            />
            <input
              type="date"
              value={editDob}
              onChange={e => setEditDob(e.target.value)}
              className={inputCls}
              placeholder="Date of birth"
            />
            <textarea
              value={editNotes}
              onChange={e => setEditNotes(e.target.value)}
              rows={2}
              className={`${inputCls} resize-none`}
              placeholder="Notes"
            />
            <textarea
              value={editDiagnosis}
              onChange={e => setEditDiagnosis(e.target.value)}
              rows={2}
              className={`${inputCls} resize-none`}
              placeholder="Medical background (e.g. diagnosis, treatments)"
            />
            <div className="flex gap-2 pt-1">
              <button
                onClick={saveEdit}
                className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors"
              >
                <Check size={13} />Save
              </button>
              <button
                onClick={cancelEdit}
                className="flex-1 flex items-center justify-center gap-1 py-1.5 border border-slate-300 text-slate-600 rounded-lg text-xs font-medium hover:bg-slate-50 transition-colors"
              >
                <X size={13} />Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-semibold text-slate-900 truncate">{patient.name}</h3>
                {patient.dateOfBirth && (
                  <p className="text-xs text-slate-400 mt-0.5">DOB: {patient.dateOfBirth}</p>
                )}
              </div>
              {isActive && (
                <span className="flex-shrink-0 text-xs bg-blue-100 text-blue-700 font-semibold px-2 py-0.5 rounded-full">
                  Active
                </span>
              )}
            </div>

            {patient.notes && (
              <p className="text-xs text-slate-400 mt-1 italic line-clamp-2">{patient.notes}</p>
            )}
            {patient.diagnosis && (
              <p className="text-xs text-blue-500 mt-1 line-clamp-2">
                <span className="font-medium">Dx:</span> {patient.diagnosis}
              </p>
            )}

            <div className="flex gap-3 mt-3 text-xs text-slate-500">
              <span>{conditionCount} condition{conditionCount !== 1 ? 's' : ''}</span>
              <span>·</span>
              <span>{entryCount} log{entryCount !== 1 ? 's' : ''}</span>
              {lastEntryDate && <><span>·</span><span>Last: {lastEntryDate}</span></>}
            </div>

            <div className="flex gap-2 mt-3">
              {!isActive && (
                <button
                  onClick={onActivate}
                  className="flex-1 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors"
                >
                  Switch to
                </button>
              )}
              <button
                onClick={() => setEditing(true)}
                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                title="Edit"
              >
                <Pencil size={14} />
              </button>
              {!isOnly && (
                confirmDelete ? (
                  <div className="flex gap-1 items-center">
                    <span className="text-xs text-red-500">Delete?</span>
                    <button
                      onClick={onDelete}
                      className="text-xs px-2 py-1 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                    >
                      Yes
                    </button>
                    <button
                      onClick={() => setConfirmDelete(false)}
                      className="text-xs px-2 py-1 border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete patient"
                  >
                    <Trash2 size={14} />
                  </button>
                )
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function PatientManager() {
  const { state, setActivePatient, updatePatient, deletePatient, getPatientConditions } = useApp();
  const [showAddPatient, setShowAddPatient] = useState(false);

  const isOnly = state.patients.length === 1;

  function handleActivate(patientId: string) {
    setActivePatient(patientId);
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users size={20} className="text-slate-500" />
          <h1 className="text-lg font-bold text-slate-900">Patients</h1>
          <span className="text-sm text-slate-400">({state.patients.length})</span>
        </div>
        <button
          onClick={() => setShowAddPatient(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus size={15} />Add Patient
        </button>
      </div>

      {state.patients.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
          <Users size={40} className="text-slate-200 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">No patients yet.</p>
          <button
            onClick={() => setShowAddPatient(true)}
            className="mt-4 px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors"
          >
            Add First Patient
          </button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {state.patients.map(patient => {
            const conditions = getPatientConditions(patient.id);
            const patientEntries = state.entries.filter(e => e.patientId === patient.id);
            const sortedEntries = [...patientEntries].sort((a, b) => b.createdAt - a.createdAt);
            const lastEntry = sortedEntries[0];

            return (
              <PatientCard
                key={patient.id}
                patient={patient}
                entryCount={patientEntries.length}
                conditionCount={conditions.length}
                lastEntryDate={lastEntry?.date}
                isActive={patient.id === state.activePatientId}
                isOnly={isOnly}
                onActivate={() => handleActivate(patient.id)}
                onUpdate={patch => updatePatient(patient.id, patch)}
                onDelete={() => deletePatient(patient.id)}
              />
            );
          })}
        </div>
      )}

      {showAddPatient && <AddPatientModal onClose={() => setShowAddPatient(false)} />}
    </div>
  );
}
