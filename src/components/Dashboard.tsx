import { useState, useEffect, useCallback } from 'react';
import { Plus, Settings, Heart, Zap, Pill, Tag, CheckCircle, ClipboardList, TrendingUp, Activity, ChevronDown, UtensilsCrossed } from 'lucide-react';
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
import MedicationTab from './MedicationTab';
import DashboardCustomizer from './DashboardCustomizer';
import { Button, Card, SectionHeader, StatCard, SeverityBadge, Badge, EmptyState } from './ui';
import type { Condition, WidgetId } from '../types';
import { DEFAULT_WIDGETS } from '../types';

const APP_VERSION = 'v3.0.5';

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
  onOpenCheckIn?:   () => void;
  onOpenTrigger?:   () => void;
  onOpenMedication?: () => void;
  onOpenFoodLog?:   () => void;
  onOpenMedSchedule?: () => void;
  onEditMedSchedule?: (schedule: import('../types').MedicationSchedule) => void;
}

function RecentLogWidget({ entries, conditions, onSeeAll }: {
  entries: import('../types').TrackingEntry[];
  conditions: import('../types').Condition[];
  onSeeAll: () => void;
}) {
  const [visibleCount, setVisibleCount] = useState(5);
  const sorted = [...entries].sort((a, b) => b.createdAt - a.createdAt);
  const visible = sorted.slice(0, visibleCount);
  const hasMore = visibleCount < sorted.length;

  return (
    <section>
      <SectionHeader
        title="Recent Log"
        action={{ label: 'See all →', onClick: onSeeAll }}
      />
      <Card padding={false}>
        {visible.map((entry, idx) => {
          const cond = conditions.find(c => c.id === entry.conditionId);
          return (
            <div
              key={entry.id}
              className={`flex items-center gap-3 px-4 py-3.5 min-h-[60px] ${idx < visible.length - 1 || hasMore ? 'border-b border-slate-50' : ''}`}
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
            </div>
          );
        })}
        {hasMore && (
          <button
            onClick={() => setVisibleCount(c => c + 5)}
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

export default function Dashboard({ onOpenCheckIn, onOpenTrigger, onOpenMedication, onOpenFoodLog, onOpenMedSchedule, onEditMedSchedule }: Props) {
  const { state, setView, selectCondition, loadSampleData, injectTodayDemoEntries, getActivePatient, getPatientConditions, getTodayCheckIn, removeConditionFromPatient } = useApp();
  const { user } = useAuth();
  const [trackingCondition,    setTrackingCondition]    = useState<Condition | null>(null);
  const [showAddCondition,     setShowAddCondition]     = useState(false);
  const [showCustomizer,       setShowCustomizer]       = useState(false);
  const [visibleWidgets,       setVisibleWidgets]       = useState<WidgetId[]>(loadPrefs);
  const [showAllConditions,    setShowAllConditions]    = useState(false);

  const activePatient  = getActivePatient();
  const conditions     = activePatient ? getPatientConditions(activePatient.id) : [];
  const patientEntries = state.entries.filter(e => e.patientId === state.activePatientId);
  const approvedEntries = patientEntries.filter(
    e => e.reviewStatus !== 'to_review' && e.reviewStatus !== 'disapproved',
  );
  const todayCheckIn   = getTodayCheckIn();
  const hasPendingVoiceReviews = patientEntries.some(e => e.reviewStatus === 'to_review');

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

  // Auto-load demo data when there are no entries; top-up today's entries daily
  useEffect(() => {
    if (!state.activePatientId) return;
    const today = new Date().toISOString().slice(0, 10);
    if (totalEntries === 0) {
      loadSampleData();
      // loadSampleData dispatches BULK_ADD_ENTRIES which will re-render;
      // injectTodayDemoEntries runs after so today always has fresh data
      setTimeout(() => injectTodayDemoEntries(), 50);
    } else {
      // Already have data — check if we need today's top-up
      const lastInject = localStorage.getItem('st-demo-last-inject');
      if (lastInject !== today) {
        injectTodayDemoEntries();
      }
    }
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  const show = (id: WidgetId) => visibleWidgets.includes(id);

  const hour        = new Date().getHours();
  const greeting    = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName   = user?.name?.split(' ')[0] ?? activePatient?.name ?? '';
  const displayGreeting = firstName && firstName.toLowerCase() !== 'me'
    ? `${greeting}, ${firstName}!`
    : `${greeting}!`;
  const todayLabel  = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    /* Constrain to phone-friendly width — centred on desktop */
    <div className="max-w-2xl mx-auto px-4 py-5 space-y-6">

      {/* ── Page header ──────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 leading-tight">{displayGreeting}</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {todayLabel}
            <span className="text-slate-300 ml-2">{APP_VERSION}</span>
          </p>
        </div>
        <button
          onClick={() => setShowCustomizer(true)}
          aria-label="Customise dashboard"
          title="Customise dashboard"
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-500 hover:text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-50 active:bg-slate-100 transition-colors min-h-[36px] flex-shrink-0 mt-1"
        >
          <Settings size={13} />
          <span className="hidden sm:inline">Customise</span>
        </button>
      </div>

      {/* ── Quick-action buttons ──────────────────────────── */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'Check In',  Icon: Heart,             bg: 'bg-rose-50',    border: 'border-rose-100',    dot: 'bg-rose-100',    icon: 'text-rose-500',    text: 'text-rose-700',    onClick: onOpenCheckIn },
          { label: 'Triggers',  Icon: Zap,               bg: 'bg-amber-50',   border: 'border-amber-100',   dot: 'bg-amber-100',   icon: 'text-amber-500',   text: 'text-amber-700',   onClick: onOpenTrigger },
          { label: 'Meds',      Icon: Pill,              bg: 'bg-violet-50',  border: 'border-violet-100',  dot: 'bg-violet-100',  icon: 'text-violet-500',  text: 'text-violet-700',  onClick: onOpenMedication },
          { label: 'Meal',      Icon: UtensilsCrossed,   bg: 'bg-emerald-50', border: 'border-emerald-100', dot: 'bg-emerald-100', icon: 'text-emerald-500', text: 'text-emerald-700', onClick: onOpenFoodLog },
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

      {/* ── Stats widget ──────────────────────────────────── */}
      {show('stats') && (
        <div className="grid grid-cols-3 gap-3">
          <StatCard value={totalEntries} label="Total"        accentClass="bg-blue-600" />
          <StatCard value={thisWeek}     label="This Week"    accentClass="bg-emerald-500" />
          <StatCard value={avgSeverity}  label="Avg Severity" accentClass="bg-amber-500" />
        </div>
      )}

      {/* ── Forecast widget ───────────────────────────────── */}
      {show('forecast') && <ForecastCard />}

      {/* ── Daily Explainer widget ────────────────────────── */}
      {show('explainToday') && <DailyExplainerCard />}

      {/* ── Weather widget ────────────────────────────────── */}
      {show('weather') && <WeatherCard />}

      {/* ── Daily Check-In widget ─────────────────────────── */}
      {show('checkin') && (
        <section>
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
      )}

      {/* ── Conditions widget ─────────────────────────────── */}
      {show('conditions') && (
        <section>
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
      )}

      {/* ── Recent Log widget ─────────────────────────────── */}
      {show('recentLog') && patientEntries.length > 0 && (
        <RecentLogWidget
          entries={patientEntries}
          conditions={conditions}
          onSeeAll={() => setView('reports')}
        />
      )}

      {/* ── Voice Review widget ──────────────────────────── */}
      {(show('voiceReview') || hasPendingVoiceReviews) && <ReviewQueue conditions={conditions} />}

      {/* ── AI Insights widget ─────────────────────────────── */}
      {show('aiInsights') && <AIInsightsCard />}

      {/* ── Meds tab ─────────────────────────────────────── */}
      {show('medSchedule') && (
        <MedicationTab
          onOpenMedSchedule={onOpenMedSchedule}
          onEditMedSchedule={onEditMedSchedule}
        />
      )}

      {/* ── Quick Log widget ──────────────────────────────── */}
      {show('quickActions') && (
        <section>
          <SectionHeader title="Quick Log" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {conditions.slice(0, 3).map(c => (
              <button
                key={c.id}
                onClick={() => setTrackingCondition(c)}
                className="flex items-center gap-3 bg-white border border-slate-100 rounded-2xl px-4 py-4 text-left shadow-sm active:scale-95 transition-transform min-h-[64px]"
              >
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: c.color }}
                />
                <span className="text-sm font-semibold text-slate-800 truncate leading-tight">
                  {c.name}
                </span>
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
      )}



      {/* ── Empty-state stat cards (shown when no logs yet) ── */}
      {patientEntries.length === 0 && show('stats') && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: ClipboardList, label: 'Total',        value: '0', accentClass: 'bg-blue-600' },
            { icon: TrendingUp,    label: 'This Week',    value: '0', accentClass: 'bg-emerald-500' },
            { icon: Activity,      label: 'Avg Severity', value: '—', accentClass: 'bg-amber-500' },
          ].map(({ label, value, accentClass }) => (
            <StatCard key={label} value={value} label={label} accentClass={accentClass} />
          ))}
        </div>
      )}

      {/* ── Modals ────────────────────────────────────────── */}
      {trackingCondition && (
        <TrackingModal condition={trackingCondition} onClose={() => setTrackingCondition(null)} />
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
