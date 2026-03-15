import { Activity } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import type { View } from '../types';

const LINKS: { label: string; view: View }[] = [
  { label: 'Dashboard', view: 'dashboard' },
  { label: 'Conditions', view: 'conditions' },
  { label: 'Reports', view: 'reports' },
  { label: 'Insights', view: 'insights' },
  { label: 'Patients', view: 'patients' },
];

export default function Footer() {
  const { setView } = useApp();

  return (
    <footer className="border-t border-slate-200 bg-white mt-12">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Brand */}
          <div className="flex items-center gap-2 text-slate-500">
            <Activity size={16} className="text-blue-400" />
            <span className="text-sm font-semibold text-slate-600">SymptomTrack</span>
          </div>

          {/* Nav links */}
          <nav className="flex gap-5">
            {LINKS.map(({ label, view }) => (
              <button
                key={view}
                onClick={() => setView(view)}
                className="text-sm text-slate-400 hover:text-blue-600 transition-colors"
              >
                {label}
              </button>
            ))}
          </nav>
        </div>

        {/* Disclaimer */}
        <div className="mt-6 pt-6 border-t border-slate-100 text-center space-y-1">
          <p className="text-xs text-slate-400">
            Data is stored locally on your device and never sent to any server.
          </p>
          <p className="text-xs text-slate-300">
            SymptomTrack is not a medical device. Always consult a qualified healthcare professional for medical advice.
          </p>
        </div>
      </div>
    </footer>
  );
}
