import { useState } from 'react';
import { X, CheckCircle2 } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { PREDEFINED_CONDITIONS } from '../data/medicalData';

interface Props {
  onClose: () => void;
}

export default function AddPatientModal({ onClose }: Props) {
  const { createPatient } = useApp();

  const [name, setName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [notes, setNotes] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [selectedConditionIds, setSelectedConditionIds] = useState<string[]>([]);
  const [nameError, setNameError] = useState('');
  const [conditionError, setConditionError] = useState('');

  function toggleCondition(id: string) {
    setSelectedConditionIds(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
    setConditionError('');
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setNameError('Patient name is required.'); return; }
    if (selectedConditionIds.length === 0) { setConditionError('Select at least one condition.'); return; }
    createPatient(name.trim(), selectedConditionIds, {
      dateOfBirth: dateOfBirth || undefined,
      notes: notes.trim() || undefined,
      diagnosis: diagnosis.trim() || undefined,
    });
    onClose();
  }

  const inputCls = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent';

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl">
          <h2 className="font-semibold text-slate-900">Add Patient</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Name <span className="text-red-400">*</span></label>
            <input
              type="text"
              value={name}
              onChange={e => { setName(e.target.value); setNameError(''); }}
              placeholder="e.g. Sarah, Child, Partner"
              className={inputCls}
              autoFocus
            />
            {nameError && <p className="text-red-500 text-xs mt-1">{nameError}</p>}
          </div>

          {/* Date of Birth */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Date of Birth <span className="text-slate-400 font-normal">(optional)</span></label>
            <input
              type="date"
              value={dateOfBirth}
              onChange={e => setDateOfBirth(e.target.value)}
              max={new Date().toISOString().slice(0, 10)}
              className={inputCls}
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes <span className="text-slate-400 font-normal">(optional)</span></label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Any relevant context..."
              className={`${inputCls} resize-none`}
            />
          </div>

          {/* Medical Background */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Medical Background <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <p className="text-xs text-slate-400 mb-1.5">Used for AI-powered insights about your symptoms.</p>
            <textarea
              value={diagnosis}
              onChange={e => setDiagnosis(e.target.value)}
              rows={2}
              placeholder="e.g. Pancreatic cancer stage 4, on gemcitabine chemo"
              className={`${inputCls} resize-none`}
            />
          </div>

          {/* Conditions */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Conditions to track <span className="text-red-400">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {PREDEFINED_CONDITIONS.map(c => {
                const isSelected = selectedConditionIds.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggleCondition(c.id)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left transition-colors ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50 text-blue-800'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
                    <span className="flex-1 min-w-0 truncate text-xs font-medium">{c.name}</span>
                    {isSelected && <CheckCircle2 size={13} className="text-blue-600 flex-shrink-0" />}
                  </button>
                );
              })}
            </div>
            {conditionError && <p className="text-red-500 text-xs mt-1">{conditionError}</p>}
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
              Add Patient
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
