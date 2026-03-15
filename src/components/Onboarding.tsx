import { useState } from 'react';
import { Activity, CheckCircle, BarChart2, Zap, ChevronRight, X } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { PREDEFINED_CONDITIONS } from '../data/medicalData';

const ONBOARDING_KEY = 'st-onboarding-v1';

export function isOnboardingDone(): boolean {
  return !!localStorage.getItem(ONBOARDING_KEY);
}

export function markOnboardingDone() {
  localStorage.setItem(ONBOARDING_KEY, '1');
}

export function resetOnboarding() {
  localStorage.removeItem(ONBOARDING_KEY);
}

interface Props {
  onDone: () => void;
}

const STEPS = ['welcome', 'conditions', 'how', 'done'] as const;
type Step = typeof STEPS[number];

export default function Onboarding({ onDone }: Props) {
  const { state, addConditionToPatient } = useApp();
  const [step, setStep] = useState<Step>('welcome');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const stepIndex = STEPS.indexOf(step);
  const total = STEPS.length;

  function toggleCondition(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function handleNext() {
    if (step === 'conditions') {
      // Add selected conditions to active patient
      const patientId = state.activePatientId;
      if (patientId) {
        const existing = new Set(
          state.patients
            .find(p => p.id === patientId)
            ?.conditions.map(c => c.conditionId) ?? []
        );
        for (const id of selected) {
          if (!existing.has(id)) addConditionToPatient(patientId, id);
        }
      }
    }
    const next = STEPS[stepIndex + 1];
    if (next) setStep(next);
  }

  function handleSkip() {
    markOnboardingDone();
    onDone();
  }

  function handleFinish() {
    markOnboardingDone();
    onDone();
  }

  return (
    <div className="fixed inset-0 bg-slate-900/80 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="bg-white w-full sm:max-w-md max-h-[92vh] sm:max-h-[88vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col">

        {/* Drag handle */}
        <div className="sm:hidden flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 bg-slate-200 rounded-full" />
        </div>

        {/* Progress bar */}
        <div className="px-5 pt-3 pb-0 flex-shrink-0">
          <div className="flex gap-1.5">
            {STEPS.map((s, i) => (
              <div
                key={s}
                className={`h-1 flex-1 rounded-full transition-all ${
                  i <= stepIndex ? 'bg-blue-500' : 'bg-slate-100'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Skip button */}
        {step !== 'done' && (
          <div className="flex justify-end px-5 pt-3 flex-shrink-0">
            <button
              onClick={handleSkip}
              className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 py-1 px-2 rounded-lg"
            >
              <X size={13} />Skip
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 px-6 py-4 overflow-y-auto">

          {/* Step: Welcome */}
          {step === 'welcome' && (
            <div className="text-center py-4">
              <div className="w-20 h-20 bg-blue-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg">
                <Activity size={36} className="text-white" />
              </div>
              <h1 className="text-2xl font-black text-slate-900 mb-3">Welcome to SymptomTrack</h1>
              <p className="text-slate-500 text-base leading-relaxed mb-6">
                Your personal health companion for tracking symptoms, medications, and wellness patterns.
              </p>
              <div className="space-y-3 text-left">
                {[
                  { icon: CheckCircle, color: 'text-emerald-500', title: 'Log in seconds', desc: 'Quick-tap logging for symptoms, triggers & medications' },
                  { icon: BarChart2, color: 'text-blue-500', title: 'Spot patterns', desc: 'Charts and insights help you understand your health' },
                  { icon: Zap, color: 'text-amber-500', title: 'Share with doctors', desc: 'Generate clinical summaries for appointments' },
                ].map(({ icon: Icon, color, title, desc }) => (
                  <div key={title} className="flex items-start gap-3 p-3 bg-slate-50 rounded-2xl">
                    <Icon size={20} className={`${color} flex-shrink-0 mt-0.5`} />
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{title}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step: Conditions */}
          {step === 'conditions' && (
            <div>
              <h2 className="text-xl font-black text-slate-900 mb-1">What do you track?</h2>
              <p className="text-sm text-slate-500 mb-4">Pick the conditions you want to monitor. You can add more later.</p>
              <div className="grid grid-cols-2 gap-2">
                {PREDEFINED_CONDITIONS.map(c => {
                  const on = selected.has(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleCondition(c.id)}
                      className={`relative flex items-center gap-2.5 p-3.5 rounded-2xl text-left border-2 transition-all active:scale-95 ${
                        on
                          ? 'border-transparent shadow-sm'
                          : 'bg-white border-slate-100'
                      }`}
                      style={on ? { backgroundColor: `${c.color}18`, borderColor: c.color } : {}}
                    >
                      <span
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: c.color }}
                      />
                      <span className="text-xs font-semibold text-slate-800 leading-tight">{c.name}</span>
                      {on && (
                        <CheckCircle
                          size={14}
                          className="absolute top-2 right-2 flex-shrink-0"
                          style={{ color: c.color }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
              {selected.size === 0 && (
                <p className="text-xs text-slate-400 text-center mt-3">You can skip this and add conditions later.</p>
              )}
            </div>
          )}

          {/* Step: How to log */}
          {step === 'how' && (
            <div className="py-2">
              <h2 className="text-xl font-black text-slate-900 mb-1">Logging is fast</h2>
              <p className="text-sm text-slate-500 mb-5">Here's how to get the most from SymptomTrack.</p>
              <div className="space-y-4">
                {[
                  {
                    step: '1',
                    color: 'bg-blue-100 text-blue-700',
                    title: 'Tap the + button',
                    desc: 'The floating + button gives you instant access to log symptoms, triggers, medications, or a daily check-in.',
                  },
                  {
                    step: '2',
                    color: 'bg-rose-100 text-rose-700',
                    title: 'Daily Check-In',
                    desc: 'Log your overall health, sleep, stress and mood each day. Takes 30 seconds.',
                  },
                  {
                    step: '3',
                    color: 'bg-emerald-100 text-emerald-700',
                    title: 'View Reports & Insights',
                    desc: 'Check the Reports and Insights tabs to see charts, patterns, and trends over time.',
                  },
                  {
                    step: '4',
                    color: 'bg-amber-100 text-amber-700',
                    title: 'Say "Hey Tracker"',
                    desc: 'Use the microphone button for hands-free voice commands to log symptoms.',
                  },
                ].map(({ step: n, color, title, desc }) => (
                  <div key={n} className="flex gap-4 items-start">
                    <div className={`w-8 h-8 rounded-full ${color} flex items-center justify-center flex-shrink-0 font-black text-sm`}>
                      {n}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{title}</p>
                      <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step: Done */}
          {step === 'done' && (
            <div className="text-center py-8">
              <div className="w-20 h-20 bg-emerald-500 rounded-3xl flex items-center justify-center mx-auto mb-5 shadow-lg">
                <CheckCircle size={40} className="text-white" />
              </div>
              <h2 className="text-2xl font-black text-slate-900 mb-2">You're all set!</h2>
              <p className="text-slate-500 text-base leading-relaxed mb-6">
                {selected.size > 0
                  ? `${selected.size} condition${selected.size > 1 ? 's' : ''} added. Start logging to discover patterns in your health.`
                  : 'Start by adding conditions and logging your first symptom.'}
              </p>
              <div className="bg-blue-50 rounded-2xl p-4 text-left">
                <p className="text-xs font-semibold text-blue-700 mb-1">Quick tip</p>
                <p className="text-xs text-blue-600">Tap the blue <strong>+</strong> button at the bottom of the screen anytime to quickly log a symptom.</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer buttons */}
        <div className="px-6 pb-8 pt-4 flex-shrink-0">
          {step === 'done' ? (
            <button
              onClick={handleFinish}
              className="w-full py-4 bg-blue-600 text-white rounded-2xl text-base font-bold hover:bg-blue-700 active:bg-blue-800 transition-colors min-h-[56px]"
            >
              Start Tracking
            </button>
          ) : (
            <button
              onClick={handleNext}
              className="w-full py-4 bg-blue-600 text-white rounded-2xl text-base font-bold hover:bg-blue-700 active:bg-blue-800 transition-colors min-h-[56px] flex items-center justify-center gap-2"
            >
              {step === 'conditions' && selected.size === 0 ? 'Skip for now' : 'Continue'}
              <ChevronRight size={20} />
            </button>
          )}
          <p className="text-center text-xs text-slate-400 mt-3">
            Step {stepIndex + 1} of {total}
          </p>
        </div>
      </div>
    </div>
  );
}
