import { useState, useRef, useEffect } from 'react';
import {
  Activity, LayoutDashboard, List, BarChart2, Brain, Notebook,
  LogIn, ChevronDown, Users, Plus, Shield,
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import type { View } from '../types';

const NAV: { view: View; label: string; Icon: React.FC<{ size?: number; className?: string }> }[] = [
  { view: 'dashboard',  label: 'Dashboard',  Icon: LayoutDashboard },
  { view: 'conditions', label: 'Conditions', Icon: List },
  { view: 'reports',    label: 'Reports',    Icon: BarChart2 },
  { view: 'insights',   label: 'Insights',   Icon: Brain },
  { view: 'notes',      label: 'Notes',      Icon: Notebook },
  { view: 'patients',   label: 'Patients',   Icon: Users },
];

interface Props {
  onOpenAuth: () => void;
  onOpenProfile: () => void;
  onOpenAddPatient: () => void;
}

export default function Header({ onOpenAuth, onOpenProfile, onOpenAddPatient }: Props) {
  const { state, setView, setActivePatient, getActivePatient } = useApp();
  const { user, isAuthenticated } = useAuth();

  const [showPatientMenu, setShowPatientMenu] = useState(false);
  const patientMenuRef = useRef<HTMLDivElement>(null);

  const activePatient = getActivePatient();

  const initials = user
    ? user.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : '';

  // Close patient menu on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (patientMenuRef.current && !patientMenuRef.current.contains(e.target as Node)) {
        setShowPatientMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <header className="bg-white/95 backdrop-blur-md border-b border-slate-100 sticky top-0 z-40 pt-safe">
      <div className="max-w-6xl mx-auto px-4 flex items-center justify-between h-14 gap-3">

        {/* Logo */}
        <div className="flex items-center gap-2 font-bold text-blue-600 text-lg flex-shrink-0">
          <Activity size={22} />
          <span className="hidden sm:inline">SymptomTrack</span>
        </div>

        {/* Desktop nav — hidden on mobile (BottomNav handles mobile) */}
        <nav className="hidden lg:flex gap-1">
          {NAV.map(({ view, label, Icon }) => (
            <button
              key={view}
              onClick={() => setView(view)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                ${state.view === view
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </nav>

        {/* Right side: patient switcher + auth */}
        <div className="flex items-center gap-1.5 sm:gap-2">

          {/* Patient switcher — visible on all screen sizes */}
          {state.patients.length > 0 && (
            <div className="relative" ref={patientMenuRef}>
              <button
                onClick={() => setShowPatientMenu(s => !s)}
                className="flex items-center gap-1 min-h-[40px] px-2.5 py-1.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 active:bg-slate-100 transition-colors"
              >
                <span className="max-w-[60px] sm:max-w-[80px] truncate text-sm">
                  {activePatient?.name ?? 'Select'}
                </span>
                <ChevronDown size={13} className="text-slate-400 flex-shrink-0" />
              </button>

              {showPatientMenu && (
                <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden min-w-[180px] z-50">
                  <div className="py-1">
                    {state.patients.map(p => (
                      <button
                        key={p.id}
                        onClick={() => {
                          setActivePatient(p.id);
                          setShowPatientMenu(false);
                          setView('dashboard');
                        }}
                        className={`w-full flex items-center gap-2 px-4 py-3 text-sm text-left transition-colors min-h-[44px] ${
                          p.id === state.activePatientId
                            ? 'bg-blue-50 text-blue-700 font-semibold'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span className="flex-1 truncate">{p.name}</span>
                        {p.id === state.activePatientId && (
                          <span className="text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full">Active</span>
                        )}
                      </button>
                    ))}
                    <div className="border-t border-slate-100 mt-1 pt-1">
                      <button
                        onClick={() => { onOpenAddPatient(); setShowPatientMenu(false); }}
                        className="w-full flex items-center gap-2 px-4 py-3 text-sm text-blue-600 hover:bg-blue-50 transition-colors min-h-[44px]"
                      >
                        <Plus size={14} /><span>Add Patient</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Admin button — always visible */}
          <button
            onClick={() => setView('admin')}
            className={`flex items-center justify-center min-h-[40px] min-w-[40px] rounded-lg transition-colors ${
              state.view === 'admin'
                ? 'bg-slate-200 text-slate-800'
                : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
            }`}
            title="Admin Panel"
          >
            <Shield size={18} />
          </button>

          {/* Auth button */}
          {isAuthenticated ? (
            <button
              onClick={onOpenProfile}
              className="flex items-center gap-2 min-h-[40px] pl-1.5 pr-2.5 py-1.5 rounded-xl hover:bg-slate-100 active:bg-slate-200 transition-colors"
              title="Account settings"
            >
              <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                {initials}
              </div>
              <span className="hidden sm:inline text-sm font-medium text-slate-700 max-w-[80px] truncate">
                {user?.name}
              </span>
            </button>
          ) : (
            <button
              onClick={onOpenAuth}
              className="flex items-center gap-1.5 min-h-[40px] px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 active:bg-blue-800 transition-colors"
            >
              <LogIn size={15} />
              <span className="hidden sm:inline">Sign In</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
