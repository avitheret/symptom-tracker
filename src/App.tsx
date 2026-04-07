import { useState, useEffect, useCallback, useRef } from 'react';
import { AppProvider, useApp } from './contexts/AppContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Header from './components/Header';
import BottomNav from './components/BottomNav';
import Dashboard from './components/Dashboard';
import ConditionsList from './components/ConditionsList';
import Reports from './components/Reports';
import Insights from './components/Insights';
import PatientManager from './components/PatientManager';
import Footer from './components/Footer';
import AuthModal from './components/AuthModal';
import UserProfile from './components/UserProfile';
import AddPatientModal from './components/AddPatientModal';
import CheckInModal from './components/CheckInModal';
import TriggerModal from './components/TriggerModal';
import MedicationModal from './components/MedicationModal';
import FoodLogModal from './components/FoodLogModal';
import MealsView from './components/MealsView';
import TrackingModal from './components/TrackingModal';
import VoiceButton from './components/VoiceButton';
import QuickAddFAB from './components/QuickAddFAB';
import QuickLogSheet from './components/QuickLogSheet';
import VoiceCommandToast from './components/VoiceCommandToast';
import Onboarding, { isOnboardingDone } from './components/Onboarding';
import Notes from './components/Notes';
import NoteComposer from './components/NoteComposer';
import Supplements from './components/Supplements';
import SupplementModal from './components/SupplementModal';
import SupplementScheduleModal from './components/SupplementScheduleModal';
import ExtractionReviewSheet from './components/ExtractionReviewSheet';
import MedScheduleModal from './components/MedScheduleModal';
import AdminPanel from './components/AdminPanel';
import { useVoiceCommands, type VoiceCommand, type SymptomPrefill, type SupplementPrefill, type SupplementTakenPrefill } from './hooks/useVoiceCommands';
import type { MealPrefill } from './types';
import { useNotificationScheduler } from './hooks/useNotificationScheduler';
import { useMedScheduleSync } from './hooks/useMedScheduleSync';
import { extractFromNote } from './utils/noteExtractor';
import type { Condition, FoodLog, Symptom, ExtractionResult, Note, MedicationSchedule, MealType, SupplementSchedule } from './types';

// ─── Fuzzy condition / symptom matching ──────────────────────────────────────
// Priority: exact → starts-with → hint-starts-with-item → any-contains.
function fuzzyMatch<T extends { name: string }>(items: T[], hint: string): T | undefined {
  const h = hint.toLowerCase().trim();
  if (h.length < 2) return undefined;
  return (
    items.find(i => i.name.toLowerCase() === h) ??
    items.find(i => i.name.toLowerCase().startsWith(h)) ??
    items.find(i => h.startsWith(i.name.toLowerCase()) && i.name.length >= 3) ??
    items.find(i => i.name.toLowerCase().includes(h) || h.includes(i.name.toLowerCase()))
  );
}

function AppContent() {
  const { state, setView, getPatientConditions, confirmNoteExtraction, updateNoteExtraction, addEntry, addSupplementLog, loadSupplementDatabase } = useApp();
  const { isAuthenticated, needsOnboarding, isLoading } = useAuth();
  const [showAuth, setShowAuth] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showAddPatient, setShowAddPatient] = useState(false);
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [showTrigger, setShowTrigger] = useState(false);
  const [showMedication, setShowMedication] = useState(false);
  const [showFoodLog, setShowFoodLog] = useState(false);
  const [foodLogMealType, setFoodLogMealType] = useState<MealType | undefined>();
  const [foodLogTime, setFoodLogTime] = useState<string | undefined>();
  const foodLogEditTarget = useRef<FoodLog | null>(null);
  const [showQuickLog, setShowQuickLog] = useState(false);
  const [quickLogNoteRef, setQuickLogNoteRef] = useState<string | undefined>();
  const [showNoteComposer, setShowNoteComposer] = useState(false);
  const [noteComposerAutoStart, setNoteComposerAutoStart] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(() => !isOnboardingDone());
  const [extractionPending, setExtractionPending] = useState<ExtractionResult | null>(null);
  const [showMedSchedule, setShowMedSchedule] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<MedicationSchedule | undefined>();
  const [showSupplement, setShowSupplement] = useState(false);
  const [supplementPrefillName, setSupplementPrefillName] = useState<string | undefined>();
  const [supplementPrefillTimeWindow, setSupplementPrefillTimeWindow] = useState<import('./types').SupplementTimeWindow | undefined>();
  const [supplementPrefillQuantity, setSupplementPrefillQuantity] = useState<string | undefined>();
  const [showSupplementSchedule, setShowSupplementSchedule] = useState(false);
  const [editingSupplementSchedule, setEditingSupplementSchedule] = useState<SupplementSchedule | undefined>();
  const [toastVisible, setToastVisible] = useState(false);
  const [toastLabel, setToastLabel] = useState('');
  const [inlineToast, setInlineToast] = useState<string | null>(null);
  const inlineToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // When a full inline voice command matches (e.g. "log dizziness to migraine"),
  // open TrackingModal directly — bypassing the condition picker.
  const [voiceTrackTarget, setVoiceTrackTarget] =
    useState<{ condition: Condition; symptom?: Symptom; transcript?: string } | null>(null);

  // Auto-open auth modal if user needs to complete onboarding (e.g. after page reload)
  useEffect(() => {
    if (isAuthenticated && needsOnboarding) {
      setShowAuth(true);
    }
  }, [isAuthenticated, needsOnboarding]);

  // ── Food log opener ───────────────────────────────────────────────────────
  // iOS only allows one SpeechRecognition at a time — must stop the wake-word
  // listener before starting the food-log dictation (same as NoteComposer).
  function openFoodLog(initialMealType?: MealType, initialTime?: string) {
    disableWakeWord(); // release the mic so FoodLogModal can claim it
    foodLogEditTarget.current = null;
    setFoodLogMealType(initialMealType);
    setFoodLogTime(initialTime);
    setShowFoodLog(true);
  }

  function openFoodLogForEdit(log: FoodLog) {
    disableWakeWord();
    foodLogEditTarget.current = log;
    setFoodLogMealType(undefined);
    setFoodLogTime(undefined);
    setShowFoodLog(true);
  }

  // ── Voice command handler ─────────────────────────────────────────────────
  const handleVoiceCommand = useCallback((
    command: VoiceCommand,
    label: string,
    prefill?: SymptomPrefill,
    mealPrefill?: MealPrefill,
    supplementPrefill?: SupplementPrefill,
    supplementTakenPrefill?: SupplementTakenPrefill,
  ) => {
    setToastLabel(label);
    setToastVisible(false);
    setTimeout(() => setToastVisible(true), 50);

    setShowCheckIn(false);
    setShowTrigger(false);
    setShowMedication(false);
    setShowFoodLog(false);
    setShowSupplement(false);

    switch (command) {
      case 'LOG_SYMPTOM': {
        if (prefill) {
          // Try to resolve spoken names against the user's actual data
          const conditions = getPatientConditions(state.activePatientId ?? '');
          const condition  = fuzzyMatch(conditions, prefill.conditionHint);
          if (condition) {
            const symptom = fuzzyMatch(condition.symptoms, prefill.symptomName);
            if (symptom) {
              // ── AUTO-LOG: both condition and symptom matched ──
              const now = new Date();
              const severity = prefill.severity ?? 5;
              addEntry({
                conditionId:   condition.id,
                conditionName: condition.name,
                symptomId:     symptom.id,
                symptomName:   symptom.name,
                date:          now.toISOString().slice(0, 10),
                time:          `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
                severity,
                notes:            'Voice logged · pending review',
                reviewStatus:     'to_review',
                sourceType:       'voice',
                sourceTranscript: label,
              });
              // Show confirmation toast (reuse existing toast state)
              setToastLabel(`Logged ${symptom.name} \u2192 ${condition.name}. Pending review.`);
              setToastVisible(false);
              setTimeout(() => setToastVisible(true), 50);
              break;
            }
            // Symptom not matched → fall back to TrackingModal with condition pre-selected
            setVoiceTrackTarget({ condition, symptom: undefined, transcript: label });
            break;
          }
        }
        // Fallback: no prefill or condition not found — open QuickLogSheet
        setVoiceTrackTarget(null);
        setShowQuickLog(true);
        break;
      }
      case 'CHECK_IN':
        setShowCheckIn(true);
        break;
      case 'LOG_TRIGGER':
        setShowTrigger(true);
        break;
      case 'LOG_MEDICATION':
        setShowMedication(true);
        break;
      case 'LOG_MEAL':
        openFoodLog(mealPrefill?.mealType, mealPrefill?.time);
        break;
      case 'LOG_SUPPLEMENT': {
        // If a specific name was extracted AND it matches an active schedule → direct log, no modal
        if (supplementPrefill?.name) {
          const activeSchedules = (state.supplementSchedules ?? []).filter(
            s => s.patientId === state.activePatientId && s.status === 'active'
          );
          const spokenName = supplementPrefill.name.toLowerCase();
          const matchedSchedule =
            activeSchedules.find(s => s.name.toLowerCase() === spokenName) ??
            activeSchedules.find(s => s.name.toLowerCase().startsWith(spokenName)) ??
            activeSchedules.find(s => spokenName.startsWith(s.name.toLowerCase()) && s.name.length >= 3) ??
            activeSchedules.find(s => s.name.toLowerCase().includes(spokenName) || spokenName.includes(s.name.toLowerCase()));
          if (matchedSchedule) {
            const now = new Date();
            addSupplementLog({
              name: matchedSchedule.name,
              dosage: matchedSchedule.dosage,
              form: matchedSchedule.form,
              date: now.toISOString().slice(0, 10),
              time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
              notes: 'Voice logged · mark taken',
              sourceTranscript: label,
            });
            setInlineToast(`✓ ${matchedSchedule.name} marked taken`);
            if (inlineToastTimerRef.current) clearTimeout(inlineToastTimerRef.current);
            inlineToastTimerRef.current = setTimeout(() => setInlineToast(null), 3000);
            // Keep wake word active — no disableWakeWord()
            break;
          }
        }
        // No schedule match (or no name) → open modal as usual
        disableWakeWord();
        setSupplementPrefillName(supplementPrefill?.name);
        setSupplementPrefillTimeWindow(supplementPrefill?.timeWindow);
        setSupplementPrefillQuantity(supplementPrefill?.quantity);
        setShowSupplement(true);
        break;
      }
      case 'MARK_SUPPLEMENT_TAKEN': {
        // No modal — just log directly and show inline toast
        if (!supplementTakenPrefill?.name) {
          // No name extracted — show feedback
          setInlineToast('Couldn\'t identify supplement');
          if (inlineToastTimerRef.current) clearTimeout(inlineToastTimerRef.current);
          inlineToastTimerRef.current = setTimeout(() => setInlineToast(null), 3000);
          break;
        }
        // Fuzzy match against supplement schedules
        const schedules = (state.supplementSchedules ?? []).filter(
          s => s.patientId === state.activePatientId && s.status === 'active'
        );
        const spokenName = supplementTakenPrefill.name.toLowerCase();
        const matched = schedules.find(s => s.name.toLowerCase() === spokenName)
          ?? schedules.find(s => s.name.toLowerCase().startsWith(spokenName))
          ?? schedules.find(s => spokenName.startsWith(s.name.toLowerCase()) && s.name.length >= 3)
          ?? schedules.find(s => s.name.toLowerCase().includes(spokenName) || spokenName.includes(s.name.toLowerCase()));
        const finalName = matched?.name ?? supplementTakenPrefill.name;
        const now = new Date();
        addSupplementLog({
          name: finalName,
          date: now.toISOString().slice(0, 10),
          time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
          notes: 'Voice logged · mark taken',
          sourceTranscript: label,
        });
        // Show inline toast
        setInlineToast(`✓ ${finalName} marked taken`);
        if (inlineToastTimerRef.current) clearTimeout(inlineToastTimerRef.current);
        inlineToastTimerRef.current = setTimeout(() => setInlineToast(null), 3000);
        // Do NOT call disableWakeWord() — keep listening
        break;
      }
      case 'OPEN_SUPPLEMENTS':
        setView('supplements');
        break;
      case 'OPEN_REPORTS':
        setView('reports');
        break;
      case 'OPEN_INSIGHTS':
        setView('insights');
        break;
      case 'OPEN_HOME':
        setView('dashboard');
        break;
      case 'OPEN_LOG':
        setView('reports');
        break;
      case 'OPEN_CONDITIONS':
        setView('conditions');
        break;
      case 'OPEN_NOTES':
        setView('notes');
        break;
      case 'ADD_NOTE':
        disableWakeWord();  // Stop wake listener NOW so Chrome releases the mic
        setNoteComposerAutoStart(true);
        setShowNoteComposer(true);
        break;
      case 'CANCEL':
        break;
    }
  }, [setView, getPatientConditions, state.activePatientId, state.supplementSchedules, addEntry, addSupplementLog]);

  const { state: voiceState, manualActivate, disableWakeWord, enableWakeWord } = useVoiceCommands({
    onCommand: handleVoiceCommand,
    supplementDatabase: state.supplementDatabase,
  });

  // ── Medication notification scheduler ─────────────────────────────────────
  useNotificationScheduler();

  // ── Sync medication schedules to Supabase (for push notifications) ──────
  useMedScheduleSync();

  // ── Load supplement database from Supabase on auth + patient change ──────
  useEffect(() => {
    if (isAuthenticated && state.activePatientId) {
      loadSupplementDatabase(state.activePatientId);
    }
  }, [isAuthenticated, state.activePatientId, loadSupplementDatabase]);

  // ── Note extraction handlers ────────────────────────────────────────────────
  const runExtraction = useCallback((noteId: string, noteText: string, date?: Date) => {
    const patientId = state.activePatientId;
    if (!patientId) return;
    const conditions = getPatientConditions(patientId);
    const supplementDb = (state.supplementDatabase ?? []).filter(
      e => e.patientId === patientId
    );
    const result = extractFromNote(noteId, noteText, conditions, date ?? new Date(), supplementDb);
    if (result.hasItems) {
      updateNoteExtraction(noteId, { extractionStatus: 'pending' });
      setExtractionPending(result);
    }
  }, [state.activePatientId, state.supplementDatabase, getPatientConditions, updateNoteExtraction]);

  const handleExtractFromNote = useCallback((note: Note) => {
    runExtraction(note.id, note.text, new Date(note.createdAt));
  }, [runExtraction]);

  const handleConfirmExtraction = useCallback((result: ExtractionResult) => {
    confirmNoteExtraction(result);
    setExtractionPending(null);
  }, [confirmNoteExtraction]);

  const handleSkipExtraction = useCallback((noteId: string) => {
    updateNoteExtraction(noteId, { extractionStatus: 'skipped' });
    setExtractionPending(null);
  }, [updateNoteExtraction]);

  // In cloud mode, wait until session is restored to avoid a flash of
  // unauthenticated UI while Supabase confirms an existing session.
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          <p className="text-sm text-slate-400">Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header
        onOpenAuth={() => setShowAuth(true)}
        onOpenProfile={() => setShowProfile(true)}
        onOpenAddPatient={() => setShowAddPatient(true)}
      />

      {/* Main content — pb-20 on mobile for bottom nav clearance */}
      <main className="flex-1 pb-20 lg:pb-0">
        {state.view === 'dashboard' && (
          <Dashboard
            onOpenCheckIn={() => setShowCheckIn(true)}
            onOpenTrigger={() => setShowTrigger(true)}
            onOpenMedication={() => setShowMedication(true)}
            onOpenFoodLog={openFoodLog}
            onEditMeal={openFoodLogForEdit}
            onOpenMedSchedule={() => { setEditingSchedule(undefined); setShowMedSchedule(true); }}
            onEditMedSchedule={(s) => { setEditingSchedule(s); setShowMedSchedule(true); }}
            onOpenSupplementSchedule={() => { setEditingSupplementSchedule(undefined); setShowSupplementSchedule(true); }}
          />
        )}
        {state.view === 'conditions' && <ConditionsList />}
        {state.view === 'meals' && <MealsView onOpenFoodLog={openFoodLog} onEditMeal={openFoodLogForEdit} />}
        {state.view === 'reports' && (
          <Reports />
        )}
        {state.view === 'insights' && <Insights />}
        {state.view === 'patients' && <PatientManager />}
        {state.view === 'supplements' && (
          <div className="max-w-2xl mx-auto px-4 py-5 space-y-2 pb-24">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Supplements</h1>
                <p className="text-sm text-slate-400 mt-0.5">
                  {(state.supplementLogs ?? []).filter(l => l.patientId === state.activePatientId).length} entries logged
                </p>
              </div>
              <button
                onClick={() => { setSupplementPrefillName(undefined); setSupplementPrefillTimeWindow(undefined); setSupplementPrefillQuantity(undefined); setShowSupplement(true); }}
                className="flex items-center gap-2 bg-teal-500 hover:bg-teal-600 active:bg-teal-700 text-white font-semibold text-sm px-4 py-2.5 rounded-xl transition-colors min-h-[44px]"
              >
                + Log Supplement
              </button>
            </div>
            <Supplements
              onOpenSupplementModal={() => { setSupplementPrefillName(undefined); setSupplementPrefillTimeWindow(undefined); setSupplementPrefillQuantity(undefined); setShowSupplement(true); }}
              onOpenScheduleModal={() => { setEditingSupplementSchedule(undefined); setShowSupplementSchedule(true); }}
              onEditSchedule={(s) => { setEditingSupplementSchedule(s); setShowSupplementSchedule(true); }}
            />
          </div>
        )}
        {state.view === 'notes' && (
          <Notes
            onNewNote={() => { setNoteComposerAutoStart(false); setShowNoteComposer(true); }}
            onLogFromNote={text => { setQuickLogNoteRef(text); setShowQuickLog(true); }}
            onExtractFromNote={handleExtractFromNote}
          />
        )}
        {state.view === 'admin' && <AdminPanel />}
      </main>

      {/* Footer: shown only on desktop (lg+) — mobile has BottomNav */}
      <div className="hidden lg:block">
        <Footer />
      </div>

      {/* Quick Add FAB */}
      <QuickAddFAB
        onCheckIn={() => setShowCheckIn(true)}
        onTrigger={() => setShowTrigger(true)}
        onMedication={() => setShowMedication(true)}
        onLogSymptom={() => setShowQuickLog(true)}
        onNote={() => { setNoteComposerAutoStart(false); setShowNoteComposer(true); }}
      />

      {/* Mobile bottom navigation */}
      <BottomNav />

      {/* ── Voice UI ── */}
      <VoiceButton
        state={voiceState}
        onPress={manualActivate}
        onLongPress={disableWakeWord}
      />
      <VoiceCommandToast label={toastLabel} visible={toastVisible} />

      {/* Inline toast for mark-taken feedback */}
      {inlineToast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-sm px-4 py-2.5 rounded-full shadow-lg z-50 animate-fade-in">
          {inlineToast}
        </div>
      )}

      {/* Global modals */}
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      {showProfile && <UserProfile onClose={() => setShowProfile(false)} />}
      {showAddPatient && <AddPatientModal onClose={() => setShowAddPatient(false)} />}
      {showCheckIn && <CheckInModal onClose={() => setShowCheckIn(false)} />}
      {showTrigger && <TriggerModal onClose={() => setShowTrigger(false)} />}
      {showMedication && <MedicationModal onClose={() => setShowMedication(false)} />}
      {showFoodLog && <FoodLogModal
        editTarget={foodLogEditTarget.current ?? undefined}
        initialMealType={foodLogMealType}
        initialTime={foodLogTime}
        onClose={() => {
          setShowFoodLog(false);
          setFoodLogMealType(undefined);
          setFoodLogTime(undefined);
          foodLogEditTarget.current = null;
          enableWakeWord();
        }}
      />}
      {showQuickLog && (
        <QuickLogSheet
          referenceNote={quickLogNoteRef}
          onClose={() => { setShowQuickLog(false); setQuickLogNoteRef(undefined); }}
        />
      )}
      {showNoteComposer && (
        <NoteComposer
          autoStartDictation={noteComposerAutoStart}
          onDictationStart={disableWakeWord}
          onDictationEnd={enableWakeWord}
          onNoteSaved={runExtraction}
          onClose={() => { setShowNoteComposer(false); setNoteComposerAutoStart(false); enableWakeWord(); }}
        />
      )}
      {/* Direct voice-log: skips condition picker when inline command matched */}
      {voiceTrackTarget && (
        <TrackingModal
          condition={voiceTrackTarget.condition}
          preselectedSymptom={voiceTrackTarget.symptom}
          voiceSourceTranscript={voiceTrackTarget.transcript}
          onClose={() => setVoiceTrackTarget(null)}
        />
      )}

      {/* Extraction review — shown after saving a note with extractable data */}
      {extractionPending && (
        <ExtractionReviewSheet
          result={extractionPending}
          onConfirm={handleConfirmExtraction}
          onSkip={handleSkipExtraction}
          onClose={() => setExtractionPending(null)}
        />
      )}

      {/* Supplement log modal */}
      {showSupplement && (
        <SupplementModal
          initialName={supplementPrefillName}
          initialTimeWindow={supplementPrefillTimeWindow}
          initialQuantity={supplementPrefillQuantity}
          onClose={() => {
            setShowSupplement(false);
            setSupplementPrefillName(undefined);
            setSupplementPrefillTimeWindow(undefined);
            setSupplementPrefillQuantity(undefined);
            enableWakeWord();
          }}
        />
      )}

      {/* Supplement schedule modal */}
      {showSupplementSchedule && (
        <SupplementScheduleModal
          editSchedule={editingSupplementSchedule}
          onClose={() => { setShowSupplementSchedule(false); setEditingSupplementSchedule(undefined); }}
        />
      )}

      {/* Medication schedule modal */}
      {showMedSchedule && (
        <MedScheduleModal
          editSchedule={editingSchedule}
          onClose={() => { setShowMedSchedule(false); setEditingSchedule(undefined); }}
        />
      )}

      {/* Onboarding — first-run only */}
      {showOnboarding && (
        <Onboarding onDone={() => setShowOnboarding(false)} />
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </AuthProvider>
  );
}
