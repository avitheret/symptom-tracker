import { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Settings, Heart, Zap, Pill, Tag, CheckCircle, TrendingUp, ChevronDown, UtensilsCrossed, FlaskConical, Mic, Zap as ZapIcon } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import TrackingModal from './TrackingModal';
import AddConditionModal from './AddConditionModal';
import ConditionCard from './ConditionCard';
import ForecastCard from './ForecastCard';
import WeatherCard from './WeatherCard';
import DailyExplainerCard from './DailyExplainerCard';
import ReviewQueue from './ReviewQueue';
import AIInsightsCard from './AIInsightsCard';
import MedScheduleWidget from './MedScheduleWidget';
import SupplementScheduleWidget from './SupplementScheduleWidget';
import DashboardCustomizer from './DashboardCustomizer';
import { Button, Card, SectionHeader, StatCard, SeverityBadge, Badge, EmptyState } from './ui';
import type { Condition, WidgetId, FoodLog, SupplementLog } from '../types';
import { DEFAULT_WIDGETS, MEAL_TYPES } from '../types';

const APP_VERSION = 'v3.18.2';

const PREFS_KEY = 'st-dashboard-prefs';

function loadPrefs(): WidgetId[] {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as WidgetId[];
      // Migration: add voiceReview if missing (new widget in v2.0.0)
      if (!saved.includes('voiceReview')) {
        const idx = saved.indexOf('quickActions');
        if (idx >= 0) saved.splice(idx, 0, 'voiceReview');
        else saved.push('voiceReview');
      }
      // Migration: add aiInsights if missing (new widget in v2.1.0)
      if (!saved.includes('aiInsights')) {
        const idx = saved.indexOf('quickActions');
        if (idx >= 0) saved.splice(idx, 0, 'aiInsights');
        else saved.push('aiInsights');
      }
      // Migration: add medSchedule if missing (new widget in v2.2.0)
      if (!saved.includes('medSchedule')) {
        saved.push('medSchedule');
      }
      // Migration: add weather if missing (new widget in v2.7.0)
      if (!saved.includes('weather')) {
        const forecastIdx = saved.indexOf('forecast');
        if (forecastIdx >= 0) saved.splice(forecastIdx + 1, 0, 'weather');
        else saved.unshift('weather');
      }
      // Migration: add explainToday if missing (new widget in v2.8.0)
      if (!saved.includes('explainToday')) {
        const forecastIdx = saved.indexOf('forecast');
        if (forecastIdx >= 0) saved.splice(forecastIdx + 1, 0, 'explainToday');
        else saved.unshift('explainToday');
      }
      // Migration: add recentMeals if missing (new widget in v3.1.0)
      if (!saved.includes('recentMeals')) {
        const recentLogIdx = saved.indexOf('recentLog');
        if (recentLogIdx >= 0) saved.splice(recentLogIdx, 0, 'recentMeals');
        else saved.push('recentMeals');
      }
      // Migration: add supplements if missing (new widget in v3.2.5)
      if (!saved.includes('supplements')) {
        const medIdx = saved.indexOf('medSchedule');
        if (medIdx >= 0) saved.splice(medIdx + 1, 0, 'supplements');
        else saved.push('supplements');
      }
      localStorage.setItem(PREFS_KEY, JSON.stringify(saved));
      return saved;
    }
  } catch { /* ignore */ }
  return [...DEFAULT_WIDGETS];
}

function savePrefs(widgets: WidgetId[]) {
  localStorage.setItem(PREFS_KEY, JSON.stringify(widgets));
}

function possessiveName(name: string): string {
  if (!name || name.toLowerCase() === 'me' || name.toLowerCase() === 'i') return 'My';
  if (name.endsWith('s') || name.endsWith('S')) return `${name}'`;
  return `${name}'s`;
}

function formatRelativeDate(dateStr: string): string {
  const today     = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (dateStr === today)     return 'Today';
  if (dateStr === yesterday) return 'Yesterday';
  const [, month, day] = dateStr.split('-');
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${MONTHS[parseInt(month) - 1]} ${parseInt(day)}`;
}

interface Props {
  onOpenCheckIn?:    () => void;
  onOpenTrigger?:    () => void;
  onOpenMedication?: () => void;
  onOpenFoodLog?:    () => void;
  onEditMeal?:       (log: FoodLog) => void;
  onOpenMedSchedule?: () => void;
  onEditMedSchedule?: (schedule: import('../types').MedicationSchedule) => void;
  onOpenSupplementSchedule?: () => void;
  onVoicePress?: () => void;
}

function RecentMealsWidget({ logs, onSeeAll, onEditMeal }: {
  logs: FoodLog[];
  onSeeAll: () => void;
  onEditMeal?: (log: FoodLog) => void;
}) {
  const recent = [...logs].sort((a, b) => b.createdAt - a.createdAt).slice(0, 4);
  if (recent.length === 0) return null;

  return (
    <section>
      <SectionHeader
        title="Recent Meals"
        action={{ label: 'See all →', onClick: onSeeAll }}
      />
      <Card padding={false}>
        {recent.map((log, idx) => {
          const meal = MEAL_TYPES.find(m => m.id === log.mealType)!;
          return (
            <button
              key={log.id}
              type="button"
              onClick={() => onEditMeal?.(log)}
              className={`w-full text-left flex items-center gap-3 px-4 py-3.5 min-h-[56px] hover:bg-slate-50 transition-colors ${idx < recent.length - 1 ? 'border-b border-slate-50' : ''}`}
            >
              <span className="text-lg flex-shrink-0">{meal.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">
                  {log.foods.join(', ')}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {meal.label} · {formatRelativeDate(log.date)} · {log.time}
                </p>
              </div>
            </button>
          );
        })}
      </Card>
    </section>
  );
}

function RecentLogWidget({ entries, conditions, foodLogs, supplementLogs, onSeeAll, onClickMeal, onClickEntry }: {
  entries: import('../types').TrackingEntry[];
  conditions: import('../types').Condition[];
  foodLogs: FoodLog[];
  supplementLogs: SupplementLog[];
  onSeeAll: () => void;
  onClickMeal?: (log: FoodLog) => void;
  onClickEntry?: (entry: import('../types').TrackingEntry) => void;
}) {
  const [visibleCount, setVisibleCount] = useState(6);

  // Combine symptom entries + meal logs + supplement logs into one chronological feed
  type CombinedItem =
    | { kind: 'symptom';    data: import('../types').TrackingEntry; ts: number }
    | { kind: 'meal';       data: FoodLog;                          ts: number }
    | { kind: 'supplement'; data: SupplementLog;                    ts: number };

  const combined: CombinedItem[] = [
    ...entries.map(e  => ({ kind: 'symptom'    as const, data: e,  ts: e.createdAt  })),
    ...foodLogs.map(l => ({ kind: 'meal'       as const, data: l,  ts: l.createdAt  })),
    ...supplementLogs.map(l => ({ kind: 'supplement' as const, data: l, ts: l.createdAt })),
  ].sort((a, b) => b.ts - a.ts);

  const visible = combined.slice(0, visibleCount);
  const hasMore = visibleCount < combined.length;

  return (
    <section>
      <SectionHeader
        title="Recent Log"
        action={{ label: 'See all →', onClick: onSeeAll }}
      />
      <Card padding={false}>
        {visible.map((item, idx) => {
          const isLast = idx === visible.length - 1 && !hasMore;
          if (item.kind === 'meal') {
            const meal = MEAL_TYPES.find(m => m.id === item.data.mealType)!;
            return (
              <button
                key={item.data.id}
                onClick={() => onClickMeal?.(item.data)}
                className={`w-full text-left flex items-center gap-3 px-4 py-3.5 min-h-[60px] hover:bg-slate-50 active:bg-slate-100 transition-colors ${!isLast ? 'border-b border-slate-50' : ''}`}
              >
                <span className="text-base flex-shrink-0">{meal.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">
                    {item.data.foods.join(', ')}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {meal.label} · {formatRelativeDate(item.data.date)} · {item.data.time}
                  </p>
                </div>
                <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Meal</span>
              </button>
            );
          }
          if (item.kind === 'supplement') {
            return (
              <div
                key={item.data.id}
                className={`flex items-center gap-3 px-4 py-3.5 min-h-[60px] ${!isLast ? 'border-b border-slate-50' : ''}`}
              >
                <FlaskConical size={16} className="flex-shrink-0" style={{ color: '#8b5cf6' }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">
                    {item.data.name}
                    {item.data.dosage && <span className="text-slate-400 font-normal"> {item.data.dosage}</span>}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Supplement · {formatRelativeDate(item.data.date)} · {item.data.time}
                  </p>
                </div>
                <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ color: '#8b5cf6', backgroundColor: '#f5f3ff' }}>Supplement</span>
              </div>
            );
          }
          const entry = item.data;
          const cond  = conditions.find(c => c.id === entry.conditionId);
          return (
            <button
              key={entry.id}
              onClick={() => onClickEntry?.(entry)}
              className={`w-full text-left flex items-center gap-3 px-4 py-3.5 min-h-[60px] hover:bg-slate-50 active:bg-slate-100 transition-colors ${!isLast ? 'border-b border-slate-50' : ''}`}
            >
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: cond?.color ?? '#94a3b8' }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">
                  {entry.symptomName}
                  {entry.reviewStatus === 'to_review' && (
                    <Badge variant="warning" className="ml-1.5 align-middle">Review</Badge>
                  )}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {entry.conditionName} · {formatRelativeDate(entry.date)}
                </p>
              </div>
              <SeverityBadge severity={entry.severity} />
            </button>
          );
        })}
        {hasMore && (
          <button
            onClick={() => setVisibleCount(c => c + 6)}
            className="w-full flex items-center justify-center gap-1.5 px-4 py-3 text-sm font-medium text-blue-600 hover:bg-blue-50 transition-colors"
          >
            <ChevronDown size={14} />
            Show more
          </button>
        )}
      </Card>
    </section>
  );
}

export default function Dashboard({ onOpenCheckIn, onOpenTrigger, onOpenMedication, onOpenFoodLog, onEditMeal, onOpenMedSchedule, onOpenSupplementSchedule, onVoicePress }: Props) {
  const { state, setView, selectCondition, getActivePatient, getPatientConditions, getTodayCheckIn, removeConditionFromPatient, loadSmallDemoData, removeDemoData } = useApp();
  useAuth();
  const [trackingCondition,    setTrackingCondition]    = useState<Condition | null>(null);
  const [editingEntry,         setEditingEntry]         = useState<import('../types').TrackingEntry | null>(null);
  const [showAddCondition,     setShowAddCondition]     = useState(false);
  const [showCustomizer,       setShowCustomizer]       = useState(false);
  const [visibleWidgets,       setVisibleWidgets]       = useState<WidgetId[]>(loadPrefs);
  const [showAllConditions,    setShowAllConditions]    = useState(false);
  const [selectedDate,         setSelectedDate]         = useState<string>(() => new Date().toISOString().slice(0, 10));

  const activePatient  = getActivePatient();
  const conditions     = activePatient ? getPatientConditions(activePatient.id) : [];
  const patientEntries = state.entries.filter(e => e.patientId === state.activePatientId);
  const patientMeals   = useMemo(
    () => state.foodLogs.filter(l => l.patientId === state.activePatientId),
    [state.foodLogs, state.activePatientId],
  );
  const patientSupplements = useMemo(
    () => (state.supplementLogs ?? []).filter(l => l.patientId === state.activePatientId),
    [state.supplementLogs, state.activePatientId],
  );
  const approvedEntries = patientEntries.filter(
    e => e.reviewStatus !== 'to_review' && e.reviewStatus !== 'disapproved',
  );
  const todayCheckIn   = getTodayCheckIn();
  const hasDemoData = useMemo(() => (
    state.entries.some(e => e.id.startsWith('demo-')) ||
    state.checkIns.some(e => e.id.startsWith('demo-')) ||
    state.medicationLogs.some(e => e.id.startsWith('demo-')) ||
    (state.supplementLogs ?? []).some(e => e.id.startsWith('demo-'))
  ), [state.entries, state.checkIns, state.medicationLogs, state.supplementLogs]);

  const totalEntries = approvedEntries.length;
  const thisWeek = (() => {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return approvedEntries.filter(e => e.createdAt >= weekAgo).length;
  })();
  const avgSeverity = totalEntries
    ? (approvedEntries.reduce((s, e) => s + e.severity, 0) / totalEntries).toFixed(1)
    : '—';

  const handlePrefsChange = useCallback((widgets: WidgetId[]) => {
    setVisibleWidgets(widgets);
    savePrefs(widgets);
  }, []);

  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === PREFS_KEY) setVisibleWidgets(loadPrefs());
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Demo auto-load disabled — users start with a blank slate.

  const hour        = new Date().getHours();
  const todayLabel  = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    /* Constrain to phone-friendly width — centred on desktop */
    <div className="bg-[#1a1f3c] min-h-screen max-w-2xl mx-auto px-4 pb-24 space-y-5 pt-3">

      {/* Date header */}
      <div className="flex items-start justify-between gap-4 pt-2">
        <div>
          <h1 className="text-3xl font-bold text-white leading-tight">
            {hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'},
          </h1>
          <p className="text-white/60 text-sm mt-0.5">
            {todayLabel}
            <span className="text-white/30 ml-2">{APP_VERSION}</span>
          </p>
        </div>
        <button
          onClick={() => setShowCustomizer(true)}
          aria-label="Customise dashboard"
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white/50 hover:text-white/80 border border-white/20 rounded-xl hover:bg-white/10 transition-colors min-h-[36px] flex-shrink-0 mt-1"
        >
          <Settings size={13} />
          <span className="hidden sm:inline">Customise</span>
        </button>
      </div>

      {/* 7-day calendar strip */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide py-1">
        {Array.from({ length: 7 }, (_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - 3 + i);
          const dateStr = d.toISOString().slice(0, 10);
          const today = new Date().toISOString().slice(0, 10);
          const isFuture = dateStr > today;
          const isSelected = dateStr === selectedDate;
          const dayLabel = d.toLocaleDateString('en-GB', { weekday: 'short' });
          const dayNum = d.getDate();
          return (
            <button
              key={i}
              onClick={() => !isFuture && setSelectedDate(dateStr)}
              disabled={isFuture}
              className={`flex flex-col items-center gap-1 flex-shrink-0 w-11 py-2 rounded-2xl transition-all ${
                isFuture
                  ? 'text-white/20 cursor-not-allowed'
                  : isSelected
                    ? 'bg-violet-500 text-white active:scale-95'
                    : 'text-white/40 hover:bg-white/10 active:scale-95'
              }`}
            >
              <span className="text-[11px] font-medium">{dayLabel}</span>
              <span className={`text-sm font-bold ${isSelected ? 'text-white' : isFuture ? 'text-white/20' : 'text-white/60'}`}>{dayNum}</span>
            </button>
          );
        })}
      </div>

      {/* "Viewing past date" banner */}
      {selectedDate !== new Date().toISOString().slice(0, 10) && (
        <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl px-4 py-2.5">
          <p className="text-white/70 text-xs font-medium">
            Viewing {new Date(selectedDate + 'T12:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          <button
            onClick={() => setSelectedDate(new Date().toISOString().slice(0, 10))}
            className="text-violet-400 text-xs font-semibold hover:text-violet-300"
          >
            Back to today
          </button>
        </div>
      )}

      {/* Today's summary cards */}
      <div className="space-y-2.5">
        {/* Mood card */}
        {(() => {
          const selectedCheckIn = state.checkIns.find(
            c => c.patientId === state.activePatientId && c.date === selectedDate
          ) ?? null;
          if (!selectedCheckIn) return null;
          return (
            <button
              onClick={onOpenCheckIn}
              className="w-full bg-[#252b50] rounded-2xl px-4 py-3.5 flex items-center gap-3.5 hover:bg-[#2e3560] active:scale-[0.98] transition-all text-left"
            >
              <div className="w-12 h-12 rounded-xl bg-amber-400/20 flex items-center justify-center flex-shrink-0">
                <span className="text-2xl">{
                  selectedCheckIn.mood >= 8 ? '😊' :
                  selectedCheckIn.mood >= 6 ? '🙂' :
                  selectedCheckIn.mood >= 4 ? '😐' :
                  '😞'
                }</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold text-sm">Mood</p>
                <p className="text-white/50 text-xs mt-0.5 truncate">
                  {selectedCheckIn.notes || `Energy ${selectedCheckIn.energy}/10 · Sleep ${selectedCheckIn.sleepHours}h`}
                </p>
              </div>
              <span className={`text-lg font-bold flex-shrink-0 ${
                selectedCheckIn.mood >= 7 ? 'text-emerald-400' :
                selectedCheckIn.mood >= 5 ? 'text-amber-400' : 'text-rose-400'
              }`}>
                {selectedCheckIn.mood}
              </span>
            </button>
          );
        })()}

        {/* Symptoms card */}
        {(() => {
          const todayEntries = patientEntries.filter(e => e.date === selectedDate);
          if (todayEntries.length === 0) return null;
          const topSymptoms = todayEntries
            .sort((a, b) => b.severity - a.severity)
            .slice(0, 3)
            .map(e => e.symptomName)
            .join(', ');
          const maxSev = Math.max(...todayEntries.map(e => e.severity));
          return (
            <button
              onClick={() => setView('reports')}
              className="w-full bg-[#252b50] rounded-2xl px-4 py-3.5 flex items-center gap-3.5 hover:bg-[#2e3560] active:scale-[0.98] transition-all text-left"
            >
              <div className="w-12 h-12 rounded-xl bg-rose-400/20 flex items-center justify-center flex-shrink-0">
                <ZapIcon size={22} className="text-rose-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold text-sm">Symptoms</p>
                <p className="text-white/50 text-xs mt-0.5 truncate">{topSymptoms}</p>
              </div>
              <span className={`text-lg font-bold flex-shrink-0 ${
                maxSev >= 7 ? 'text-rose-400' :
                maxSev >= 5 ? 'text-amber-400' : 'text-emerald-400'
              }`}>
                {maxSev}
              </span>
            </button>
          );
        })()}

        {/* Triggers / Factors card */}
        {(() => {
          const todayTriggers = state.triggerLogs.filter(
            t => t.patientId === state.activePatientId && t.date === selectedDate
          );
          if (todayTriggers.length === 0) return null;
          const allTriggerNames = todayTriggers.flatMap(t => t.triggers).slice(0, 5);
          return (
            <button
              onClick={onOpenTrigger}
              className="w-full bg-[#252b50] rounded-2xl px-4 py-3.5 flex items-center gap-3.5 hover:bg-[#2e3560] active:scale-[0.98] transition-all text-left"
            >
              <div className="w-12 h-12 rounded-xl bg-violet-400/20 flex items-center justify-center flex-shrink-0">
                <TrendingUp size={22} className="text-violet-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold text-sm">Factors</p>
                <p className="text-white/50 text-xs mt-0.5 truncate">{allTriggerNames.join(', ')}</p>
              </div>
              <span className="text-sm font-semibold text-white/40 flex-shrink-0">
                {allTriggerNames.length} items
              </span>
            </button>
          );
        })()}
      </div>

      {/* Voice CTA */}
      <div className="flex flex-col items-center gap-3 py-4">
        <div className="relative">
          {/* Outer ring */}
          <div className="absolute inset-[-16px] rounded-full border border-white/10" />
          {/* Middle ring */}
          <div className="absolute inset-[-8px] rounded-full border border-white/15" />
          {/* Button */}
          <button
            onClick={onVoicePress}
            className="relative w-20 h-20 rounded-full bg-[#3d4a9e] border-2 border-white/20 flex items-center justify-center shadow-2xl active:scale-95 transition-transform"
          >
            <Mic size={32} className="text-white" />
          </button>
        </div>
        <p className="text-white/40 text-xs font-medium mt-2">Say "Hey Tracker" to log hands-free</p>
      </div>

      {/* ── Quick-action buttons ──────────────────────────── */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'Check In',  Icon: Heart,           bg: 'bg-rose-500/20',    border: 'border-rose-500/30',    dot: 'bg-rose-500/20',    icon: 'text-rose-300',    text: 'text-rose-300',    onClick: onOpenCheckIn },
          { label: 'Triggers',  Icon: Zap,             bg: 'bg-amber-500/20',   border: 'border-amber-500/30',   dot: 'bg-amber-500/20',   icon: 'text-amber-300',   text: 'text-amber-300',   onClick: onOpenTrigger },
          { label: 'Meds',      Icon: Pill,            bg: 'bg-violet-500/20',  border: 'border-violet-500/30',  dot: 'bg-violet-500/20',  icon: 'text-violet-300',  text: 'text-violet-300',  onClick: onOpenMedication },
          { label: 'Meal',      Icon: UtensilsCrossed, bg: 'bg-emerald-500/20', border: 'border-emerald-500/30', dot: 'bg-emerald-500/20', icon: 'text-emerald-300', text: 'text-emerald-300', onClick: onOpenFoodLog },
        ].map(({ label, Icon, bg, border, dot, icon, text, onClick }) => (
          <button
            key={label}
            onClick={onClick}
            className={`flex flex-col items-center gap-2 py-4 px-2 rounded-2xl ${bg} border ${border} active:scale-95 transition-transform`}
          >
            <div className={`p-2.5 ${dot} rounded-xl`}>
              <Icon size={18} className={icon} />
            </div>
            <span className={`text-xs font-semibold ${text}`}>{label}</span>
          </button>
        ))}
      </div>

      {/* ── Vitals bento row ─────────────────────────────── */}
      {todayCheckIn && (
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Health', value: todayCheckIn.healthScore, color: 'text-rose-300', bg: 'bg-rose-500/15' },
            { label: 'Energy', value: todayCheckIn.energy, color: 'text-amber-300', bg: 'bg-amber-500/15' },
            { label: 'Mood', value: todayCheckIn.mood, color: 'text-violet-300', bg: 'bg-violet-500/15' },
            { label: 'Sleep', value: `${todayCheckIn.sleepHours}h`, color: 'text-blue-300', bg: 'bg-blue-500/15' },
          ].map(({ label, value, color, bg }) => (
            <div key={label} className={`${bg} rounded-2xl py-3 px-2 text-center`}>
              <p className={`text-lg font-bold ${color}`}>{value}</p>
              <p className="text-xs text-white/40 mt-0.5 font-medium">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── First-run welcome — shown until the user adds a condition ── */}
      {conditions.length === 0 && patientEntries.length === 0 && (
        <div className="bg-white/10 border border-white/15 rounded-2xl p-5 flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-violet-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Heart size={18} className="text-violet-300" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-sm">Welcome to SymptomTrack</p>
            <p className="text-white/50 text-xs mt-1 leading-relaxed">
              Start by adding a condition — then log symptoms, medications, and check-ins to build your health picture.
            </p>
            <button
              onClick={() => setShowAddCondition(true)}
              className="mt-3 inline-flex items-center gap-1.5 bg-violet-500 hover:bg-violet-600 active:scale-[0.97] text-white text-xs font-semibold px-4 py-2 rounded-xl transition-all min-h-[36px]"
            >
              <Plus size={13} />
              Add Your First Condition
            </button>
          </div>
        </div>
      )}

      {/* ── Customisable widgets rendered in user-defined order ─── */}
      {visibleWidgets.map(id => {
        switch (id) {
          case 'stats':
            return (
              <div key="stats" className="grid grid-cols-3 gap-3">
                {patientEntries.length > 0 ? (
                  <>
                    <StatCard value={totalEntries} label="Total"        accentClass="bg-blue-600" />
                    <StatCard value={thisWeek}     label="This Week"    accentClass="bg-emerald-500" />
                    <StatCard value={avgSeverity}  label="Avg Severity" accentClass="bg-amber-500" />
                  </>
                ) : (
                  <>
                    <StatCard value="0" label="Total"        accentClass="bg-blue-600" />
                    <StatCard value="0" label="This Week"    accentClass="bg-emerald-500" />
                    <StatCard value="—" label="Avg Severity" accentClass="bg-amber-500" />
                  </>
                )}
              </div>
            );

          case 'forecast':
            return <ForecastCard key="forecast" />;

          case 'explainToday':
            return <DailyExplainerCard key="explainToday" />;

          case 'weather':
            return <WeatherCard key="weather" />;

          case 'checkin':
            return (
              <section key="checkin">
                <SectionHeader title="Daily Check-In" />
                {todayCheckIn ? (
                  <Card padding={false}>
                    <div className="flex items-center gap-3 p-4 border-b border-slate-50">
                      <div className="p-2 bg-rose-50 rounded-xl">
                        <CheckCircle size={18} className="text-rose-500" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Today's check-in complete</p>
                        <p className="text-xs text-slate-400 mt-0.5">{todayCheckIn.time}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3">
                      {[
                        { label: 'Health', value: `${todayCheckIn.healthScore}/10` },
                        { label: 'Energy', value: `${todayCheckIn.energy}/10` },
                        { label: 'Mood',   value: `${todayCheckIn.mood}/10` },
                        { label: 'Sleep',  value: `${todayCheckIn.sleepHours}h` },
                      ].map(({ label, value }) => (
                        <div key={label} className="bg-slate-50 rounded-xl py-3 text-center">
                          <p className="text-sm font-bold text-slate-800">{value}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{label}</p>
                        </div>
                      ))}
                    </div>
                    <div className="px-4 pb-4 flex items-center gap-2">
                      <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                        todayCheckIn.stress === 'high'   ? 'bg-red-100 text-red-600' :
                        todayCheckIn.stress === 'medium' ? 'bg-amber-100 text-amber-600' :
                        'bg-green-100 text-green-600'
                      }`}>
                        {todayCheckIn.stress.charAt(0).toUpperCase() + todayCheckIn.stress.slice(1)} stress
                      </span>
                      {todayCheckIn.notes && (
                        <p className="text-xs text-slate-500 italic truncate">{todayCheckIn.notes}</p>
                      )}
                    </div>
                  </Card>
                ) : (
                  <Card dashed>
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-rose-50 rounded-xl">
                          <Heart size={18} className="text-rose-400" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-700">No check-in yet today</p>
                          <p className="text-xs text-slate-400 mt-0.5">Takes less than 30 seconds.</p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={onOpenCheckIn}
                        className="text-rose-600 border-rose-200 hover:bg-rose-50 flex-shrink-0"
                      >
                        Check In
                      </Button>
                    </div>
                  </Card>
                )}
              </section>
            );

          case 'conditions':
            return (
              <section key="conditions">
                <SectionHeader
                  title={activePatient ? `${possessiveName(activePatient.name)} Conditions` : 'Conditions'}
                  action={{ label: 'View all →', onClick: () => setView('conditions') }}
                />
                {conditions.length === 0 ? (
                  <Card dashed>
                    <EmptyState
                      icon={<Tag size={22} />}
                      title="No conditions yet"
                      description="Add a condition to start tracking your symptoms."
                      action={{ label: 'Add Your First Condition', onClick: () => setShowAddCondition(true), icon: <Plus size={14} /> }}
                      compact
                    />
                  </Card>
                ) : (
                  <>
                    <div className="grid sm:grid-cols-2 gap-3">
                      {(showAllConditions ? conditions : conditions.slice(0, 2)).map(c => {
                        const conditionEntries = patientEntries.filter(e => e.conditionId === c.id);
                        const lastEntry = [...conditionEntries].sort((a, b) => b.createdAt - a.createdAt)[0];
                        return (
                          <ConditionCard
                            key={c.id}
                            condition={c}
                            entryCount={conditionEntries.length}
                            lastEntryDate={lastEntry?.date}
                            onLog={() => setTrackingCondition(c)}
                            onClick={() => { selectCondition(c.id); setView('conditions'); }}
                            onRemove={() => removeConditionFromPatient(activePatient!.id, c.id)}
                          />
                        );
                      })}
                    </div>
                    {conditions.length > 2 && (
                      <button
                        onClick={() => setShowAllConditions(v => !v)}
                        className="w-full mt-3 py-2.5 text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center justify-center gap-1.5 rounded-xl hover:bg-blue-50 transition-colors"
                      >
                        <ChevronDown size={14} className={`transition-transform ${showAllConditions ? 'rotate-180' : ''}`} />
                        {showAllConditions ? 'Show less' : `Show ${conditions.length - 2} more condition${conditions.length - 2 !== 1 ? 's' : ''}`}
                      </button>
                    )}
                  </>
                )}
              </section>
            );

          case 'recentMeals':
            return patientMeals.length > 0 ? (
              <RecentMealsWidget
                key="recentMeals"
                logs={patientMeals}
                onSeeAll={() => setView('meals')}
                onEditMeal={onEditMeal}
              />
            ) : null;

          case 'recentLog':
            return (patientEntries.length > 0 || patientMeals.length > 0 || patientSupplements.length > 0) ? (
              <RecentLogWidget
                key="recentLog"
                entries={patientEntries}
                conditions={conditions}
                foodLogs={patientMeals}
                supplementLogs={patientSupplements}
                onSeeAll={() => setView('reports')}
                onClickMeal={onEditMeal}
                onClickEntry={(entry) => {
                  const cond = conditions.find(c => c.id === entry.conditionId);
                  if (cond) { setTrackingCondition(cond); setEditingEntry(entry); }
                }}
              />
            ) : null;

          case 'voiceReview':
            return <ReviewQueue key="voiceReview" conditions={conditions} />;

          case 'aiInsights':
            return <AIInsightsCard key="aiInsights" />;

          case 'medSchedule':
            return (
              <MedScheduleWidget
                key="medSchedule"
                onAddSchedule={onOpenMedSchedule ?? (() => {})}
              />
            );

          case 'supplements':
            return (
              <SupplementScheduleWidget
                key="supplements"
                onAddSchedule={onOpenSupplementSchedule ?? (() => {})}
              />
            );

          case 'quickActions':
            return (
              <section key="quickActions">
                <SectionHeader title="Quick Log" />
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {conditions.slice(0, 3).map(c => (
                    <button
                      key={c.id}
                      onClick={() => setTrackingCondition(c)}
                      className="flex items-center gap-3 bg-white border border-slate-100 rounded-2xl px-4 py-4 text-left shadow-sm active:scale-95 transition-transform min-h-[64px]"
                    >
                      <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
                      <span className="text-sm font-semibold text-slate-800 truncate leading-tight">{c.name}</span>
                    </button>
                  ))}
                  <button
                    onClick={() => setShowAddCondition(true)}
                    className="flex items-center gap-3 bg-slate-50 border border-dashed border-slate-200 rounded-2xl px-4 py-4 text-left active:bg-slate-100 transition-colors min-h-[64px]"
                  >
                    <span className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                      <Plus size={13} className="text-slate-500" />
                    </span>
                    <span className="text-sm font-medium text-slate-400">Add Condition</span>
                  </button>
                </div>
              </section>
            );

          default:
            return null;
        }
      })}

      {/* ── Demo data ────────────────────────────────────── */}
      <div className="flex items-center justify-center gap-3 pt-2 pb-1">
        {!hasDemoData && (
          <button onClick={loadSmallDemoData} className="text-xs font-medium text-white/30 hover:text-white/60 underline underline-offset-2 transition-colors">
            Load demo data
          </button>
        )}
        {hasDemoData && (
          <button onClick={removeDemoData} className="text-xs font-medium text-white/30 hover:text-rose-400 underline underline-offset-2 transition-colors">
            Remove demo data
          </button>
        )}
      </div>

      {/* ── Modals ────────────────────────────────────────── */}
      {trackingCondition && (
        <TrackingModal
          condition={trackingCondition}
          existingEntry={editingEntry ?? undefined}
          onClose={() => { setTrackingCondition(null); setEditingEntry(null); }}
        />
      )}
      {showAddCondition && <AddConditionModal onClose={() => setShowAddCondition(false)} />}
      {showCustomizer && (
        <DashboardCustomizer
          visible={visibleWidgets}
          onChange={handlePrefsChange}
          onClose={() => setShowCustomizer(false)}
        />
      )}
    </div>
  );
}
