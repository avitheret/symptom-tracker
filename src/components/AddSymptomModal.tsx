import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import type { Condition } from '../types';
import { Sheet, Button } from './ui';

interface Props {
  condition: Condition;
  onClose:   () => void;
}

export default function AddSymptomModal({ condition, onClose }: Props) {
  const { addSymptom } = useApp();
  const [name,  setName]  = useState('');
  const [error, setError] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) { setError('Symptom name is required.'); return; }
    if (trimmed.length > 80) { setError('Name must be 80 characters or fewer.'); return; }
    if (condition.symptoms.some(s => s.name.toLowerCase() === trimmed.toLowerCase())) {
      setError('This symptom already exists for this condition.'); return;
    }
    addSymptom(condition.id, trimmed);
    onClose();
  }

  return (
    <Sheet
      title="Add Symptom"
      subtitle={`For: ${condition.name}`}
      icon={<Plus size={16} className="text-blue-500" />}
      onClose={onClose}
      maxWidth="sm:max-w-sm"
    >
      <form onSubmit={handleSubmit} className="px-5 py-5 space-y-4">

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Symptom Name
          </label>
          <input
            type="text"
            value={name}
            onChange={e => { setName(e.target.value); setError(''); }}
            placeholder="e.g. Joint pain"
            className="w-full border border-slate-300 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 min-h-[48px] bg-white"
            autoFocus
          />
          {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
        </div>

        <div className="flex gap-3 pb-safe">
          <Button type="button" variant="outline" size="lg" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="lg" className="flex-1">
            Add Symptom
          </Button>
        </div>

      </form>
    </Sheet>
  );
}
