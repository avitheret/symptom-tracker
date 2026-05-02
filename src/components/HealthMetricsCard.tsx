/**
 * HealthMetricsCard — Dashboard widget for Apple Health data (Phase 1).
 *
 * States:
 *  • No cloud / not logged in → CTA to sign in
 *  • Logged in, no API key     → CTA to set up
 *  • Logged in, key, no data   → "Waiting for first sync"
 *  • Data available            → metric grid
 *
 * The setup Sheet lets the user generate/revoke their API key and shows
 * step-by-step iOS Shortcuts instructions.
 */

import { useState, useEffect, useCallback } from 'react';
import { Moon, Heart, Activity, Zap, Droplets, Settings, Copy, Check, RefreshCw, AlertCircle, ChevronDown, ChevronUp, Smartphone } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase, CLOUD_ENABLED } from '../lib/supabase';
import { Sheet } from './ui';
import type { HealthMetric, HealthMetricType } from '../types';

// ── Metric display config ─────────────────────────────────────────────────────

interface MetricConfig {
  label:    string;
  icon:     React.ReactNode;
  format:   (v: number) => string;
  color:    string;
  bg:       string;
}

function metricConfig(type: HealthMetricType): MetricConfig {
  switch (type) {
    case 'sleep_hours':
      return {
        label: 'Sleep',
        icon:  <Moon size={14} />,
        format: v => {
          const h = Math.floor(v);
          const m = Math.round((v - h) * 60);
          return m > 0 ? `${h}h ${m}m` : `${h}h`;
        },
        color: 'text-blue-600',
        bg:    'bg-blue-50',
      };
    case 'resting_hr':
      return {
        label:  'Resting HR',
        icon:   <Heart size={14} />,
        format: v => `${Math.round(v)} bpm`,
        color:  'text-rose-600',
        bg:     'bg-rose-50',
      };
    case 'steps':
      return {
        label:  'Steps',
        icon:   <Activity size={14} />,
        format: v => Math.round(v).toLocaleString(),
        color:  'text-emerald-600',
        bg:     'bg-emerald-50',
      };
    case 'hrv':
      return {
        label:  'HRV',
        icon:   <Zap size={14} />,
        format: v => `${Math.round(v)} ms`,
        color:  'text-violet-600',
        bg:     'bg-violet-50',
      };
    case 'systolic_bp':
    case 'diastolic_bp':
      return {
        label:  'Blood Pressure',
        icon:   <Droplets size={14} />,
        format: v => `${Math.round(v)} mmHg`,
        color:  'text-orange-600',
        bg:     'bg-orange-50',
      };
  }
}

// ── Date helpers ──────────────────────────────────────────────────────────────

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function formatDateLabel(dateStr: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (dateStr === today)     return 'Today';
  if (dateStr === yesterday) return 'Yesterday';
  const [, m, d] = dateStr.split('-');
  return `${MONTHS_SHORT[parseInt(m, 10) - 1]} ${parseInt(d, 10)}`;
}

// ── Setup sheet ───────────────────────────────────────────────────────────────

interface SetupSheetProps {
  apiKey:         string | undefined;
  userId:         string;
  onClose:        () => void;
  onKeyChange:    (key: string | undefined) => void;
}

function SetupSheet({ apiKey, userId, onClose, onKeyChange }: SetupSheetProps) {
  const [generating,   setGenerating]   = useState(false);
  const [showKey,      setShowKey]      = useState(false);
  const [copied,       setCopied]       = useState<'key' | 'url' | 'json' | null>(null);
  const [error,        setError]        = useState<string | null>(null);
  const [showSteps,    setShowSteps]    = useState(!apiKey);

  const endpointUrl = `${window.location.origin}/.netlify/functions/log-healthkit`;

  // On mount, register existing key with Supabase (in case it was lost)
  useEffect(() => {
    if (!apiKey || !CLOUD_ENABLED || !supabase) return;
    // Re-upsert silently — ensures token is in DB after device restore
    void supabase
      .from('healthkit_tokens')
      .upsert({ user_id: userId, token: apiKey }, { onConflict: 'user_id' });
  }, [apiKey, userId]);

  const handleGenerate = useCallback(async () => {
    if (!CLOUD_ENABLED || !supabase) return;
    setGenerating(true);
    setError(null);
    try {
      const arr   = new Uint8Array(24);
      crypto.getRandomValues(arr);
      const token = Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
      const { error: dbErr } = await supabase
        .from('healthkit_tokens')
        .upsert({ user_id: userId, token }, { onConflict: 'user_id' });
      if (dbErr) throw new Error(dbErr.message);
      onKeyChange(token);
      setShowKey(true);
      setShowSteps(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate key');
    } finally {
      setGenerating(false);
    }
  }, [userId, onKeyChange]);

  const handleRevoke = useCallback(async () => {
    if (!CLOUD_ENABLED || !supabase) return;
    const { error: dbErr } = await supabase
      .from('healthkit_tokens')
      .delete()
      .eq('user_id', userId);
    if (dbErr) { setError(dbErr.message); return; }
    onKeyChange(undefined);
  }, [userId, onKeyChange]);

  const copyText = useCallback(async (text: string, which: 'key' | 'url' | 'json') => {
    await navigator.clipboard.writeText(text).catch(() => {});
    setCopied(which);
    setTimeout(() => setCopied(null), 2000);
  }, []);

  const jsonTemplate = apiKey
    ? JSON.stringify({
        token:   apiKey,
        date:    '<<Current Date formatted as YYYY-MM-DD>>',
        metrics: [
          { type: 'sleep_hours', value: '<<sleep duration in hours>>',          unit: 'hours'  },
          { type: 'resting_hr',  value: '<<resting heart rate value>>',          unit: 'bpm'    },
          { type: 'steps',       value: '<<step count>>',                        unit: 'count'  },
          { type: 'hrv',         value: '<<HRV SDNN value>>',                    unit: 'ms'     },
          { type: 'systolic_bp', value: '<<blood pressure systolic value>>',     unit: 'mmHg'   },
          { type: 'diastolic_bp',value: '<<blood pressure diastolic value>>',    unit: 'mmHg'   },
        ],
      }, null, 2)
    : '';

  return (
    <Sheet
      title="Apple Health Setup"
      subtitle="Connect iPhone Health via iOS Shortcuts"
      icon={<Smartphone size={16} className="text-slate-500" />}
      onClose={onClose}
    >
      <div className="px-5 py-4 space-y-5">

        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">
            <AlertCircle size={14} className="text-red-500 flex-shrink-0" />
            <p className="text-xs text-red-600">{error}</p>
          </div>
        )}

        {/* API Key section */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Your API Key</p>
          {apiKey ? (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs font-mono text-slate-700 break-all">
                  {showKey ? apiKey : '•'.repeat(Math.min(apiKey.length, 32))}
                </code>
                <button
                  onClick={() => setShowKey(v => !v)}
                  className="text-xs text-slate-400 hover:text-slate-600 flex-shrink-0"
                >
                  {showKey ? 'Hide' : 'Show'}
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => copyText(apiKey, 'key')}
                  className="flex items-center gap-1.5 flex-1 justify-center px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 active:scale-95 transition-all min-h-[36px]"
                >
                  {copied === 'key' ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
                  {copied === 'key' ? 'Copied!' : 'Copy Key'}
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-500 hover:bg-slate-50 active:scale-95 transition-all min-h-[36px]"
                >
                  <RefreshCw size={13} className={generating ? 'animate-spin' : ''} />
                  Regenerate
                </button>
              </div>
              <p className="text-xs text-slate-400">
                If you regenerate, update the Shortcut with the new key.
              </p>
            </div>
          ) : (
            <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-4 text-center space-y-3">
              <p className="text-sm text-slate-500">Generate a key to start receiving data from Shortcuts</p>
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl min-h-[44px] active:scale-95 transition-transform disabled:opacity-60"
              >
                {generating ? <RefreshCw size={15} className="animate-spin" /> : <Smartphone size={15} />}
                Generate API Key
              </button>
            </div>
          )}
        </div>

        {apiKey && (
          <>
            {/* Endpoint URL */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Endpoint URL</p>
              <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 flex items-center gap-2">
                <code className="flex-1 text-xs font-mono text-slate-700 break-all">{endpointUrl}</code>
                <button
                  onClick={() => copyText(endpointUrl, 'url')}
                  className="flex-shrink-0 text-slate-400 hover:text-slate-600 active:scale-90 transition-all"
                >
                  {copied === 'url' ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                </button>
              </div>
            </div>

            {/* Setup instructions */}
            <div className="space-y-2">
              <button
                onClick={() => setShowSteps(v => !v)}
                className="flex items-center justify-between w-full"
              >
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">iOS Shortcuts Setup</p>
                {showSteps ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
              </button>

              {showSteps && (
                <div className="space-y-3 text-sm text-slate-700">
                  <ol className="space-y-3">
                    {[
                      { n: 1, text: 'Open the Shortcuts app on your iPhone and tap + to create a new shortcut. Name it "Log Health to SymTrack".' },
                      { n: 2, text: 'Add a "Find Health Samples" action for each metric you want to track. Tap + → search "Find Health Samples" → choose the type. Use Sort: Date (newest first), Limit: 1.' },
                      { n: 3, text: 'The metric types to choose are: Sleep Analysis, Resting Heart Rate, Step Count, Heart Rate Variability, Blood Pressure Systolic, Blood Pressure Diastolic.' },
                      { n: 4, text: 'After each "Find Health Samples", add a "Get Details of Health Sample" action → choose Value. This extracts the number.' },
                      { n: 5, text: 'Add a Text action. Paste the JSON template below (tap "Copy JSON"), then replace each placeholder with the corresponding Shortcut variable.' },
                      { n: 6, text: 'Add a "Get Contents of URL" action. Set Method: POST, URL: the endpoint above, Headers: Content-Type = application/json, Body: select Text → choose the Text from step 5.' },
                      { n: 7, text: 'Automate: tap the shortcut name → Add to Siri, or go to Automation tab → Create Personal Automation → Time of Day → 7:00 AM daily.' },
                    ].map(({ n, text }) => (
                      <li key={n} className="flex gap-3">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">
                          {n}
                        </span>
                        <p className="text-sm text-slate-600 leading-relaxed flex-1">{text}</p>
                      </li>
                    ))}
                  </ol>

                  {/* JSON Template */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">JSON Template</p>
                      <button
                        onClick={() => copyText(jsonTemplate, 'json')}
                        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
                      >
                        {copied === 'json' ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                        {copied === 'json' ? 'Copied!' : 'Copy JSON'}
                      </button>
                    </div>
                    <pre className="bg-slate-900 text-green-400 text-xs font-mono p-3 rounded-xl overflow-x-auto whitespace-pre-wrap leading-relaxed">
                      {jsonTemplate}
                    </pre>
                    <p className="text-xs text-slate-400">
                      Replace each <code className="bg-slate-100 px-1 rounded">{'<<...>>'}</code> with the Shortcut variable for that metric. All fields are optional — remove any you don't want to track.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Revoke */}
            <button
              onClick={handleRevoke}
              className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl border border-red-100 text-sm font-medium text-red-500 hover:bg-red-50 active:scale-[0.97] transition-all min-h-[44px]"
            >
              Revoke API Key
            </button>
          </>
        )}
      </div>
    </Sheet>
  );
}

// ── Main card ─────────────────────────────────────────────────────────────────

export default function HealthMetricsCard() {
  const { state, setHealthkitApiKey, loadHealthMetrics } = useApp();
  const { user, isCloudEnabled }                        = useAuth();
  const [showSetup, setShowSetup] = useState(false);
  const [loading,   setLoading]   = useState(false);

  const apiKey = state.healthkitApiKey;

  // Load metrics from Supabase whenever this card is visible and user is logged in
  useEffect(() => {
    if (!user || !isCloudEnabled) return;
    setLoading(true);
    loadHealthMetrics().finally(() => setLoading(false));
  }, [user, isCloudEnabled, loadHealthMetrics]);

  // Latest date with any metrics
  const metrics      = state.healthMetrics;
  const latestDate   = metrics.length > 0
    ? metrics.reduce((a, b) => a.date > b.date ? a : b).date
    : null;
  const latestMetrics = latestDate
    ? metrics.filter(m => m.date === latestDate)
    : [];

  // Group BP together
  const systolic  = latestMetrics.find(m => m.type === 'systolic_bp');
  const diastolic = latestMetrics.find(m => m.type === 'diastolic_bp');
  const otherMetrics: HealthMetric[] = latestMetrics.filter(
    m => m.type !== 'systolic_bp' && m.type !== 'diastolic_bp'
  );

  const handleKeyChange = (key: string | undefined) => {
    setHealthkitApiKey(key);
  };

  // ── No cloud ──────────────────────────────────────────────────────────────
  if (!isCloudEnabled) {
    return (
      <section>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center flex-shrink-0">
            <Smartphone size={18} className="text-slate-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-700">Apple Health</p>
            <p className="text-xs text-slate-400 mt-0.5">Sign in to enable HealthKit sync</p>
          </div>
        </div>
      </section>
    );
  }

  // ── Not logged in ─────────────────────────────────────────────────────────
  if (!user) {
    return (
      <section>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center flex-shrink-0">
            <Smartphone size={18} className="text-slate-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-700">Apple Health</p>
            <p className="text-xs text-slate-400 mt-0.5">Create an account to sync HealthKit data</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center">
              <Heart size={15} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">Apple Health</p>
              {latestDate && (
                <p className="text-xs text-slate-400">{formatDateLabel(latestDate)}</p>
              )}
            </div>
          </div>
          <button
            onClick={() => setShowSetup(true)}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-50 active:scale-90 transition-all"
            aria-label="HealthKit setup"
          >
            <Settings size={15} />
          </button>
        </div>

        {/* Content */}
        {!apiKey ? (
          /* No API key — prompt setup */
          <div className="px-4 pb-5 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 flex items-center justify-center mx-auto">
              <Smartphone size={22} className="text-rose-400" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-slate-700">Connect iPhone Health</p>
              <p className="text-xs text-slate-400 leading-relaxed max-w-[220px] mx-auto">
                Auto-import Sleep, Heart Rate, Steps, HRV & Blood Pressure via iOS Shortcuts
              </p>
            </div>
            <button
              onClick={() => setShowSetup(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl min-h-[44px] active:scale-95 transition-transform"
            >
              <Smartphone size={15} />
              Set Up
            </button>
          </div>
        ) : loading && metrics.length === 0 ? (
          /* Loading spinner */
          <div className="px-4 pb-5 text-center py-6">
            <div className="w-5 h-5 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin mx-auto mb-2" />
            <p className="text-xs text-slate-400">Loading metrics…</p>
          </div>
        ) : !latestDate ? (
          /* Has key but no data yet */
          <div className="px-4 pb-5 text-center space-y-2 py-4">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center mx-auto">
              <Smartphone size={18} className="text-amber-400" />
            </div>
            <p className="text-sm font-medium text-slate-600">Waiting for first sync</p>
            <p className="text-xs text-slate-400 leading-relaxed">
              Run your iOS Shortcut to import today's data
            </p>
          </div>
        ) : (
          /* Metrics grid */
          <div className="px-4 pb-4 space-y-2">
            {/* Other metrics */}
            <div className="grid grid-cols-2 gap-2">
              {otherMetrics.map(metric => {
                const cfg = metricConfig(metric.type);
                return (
                  <div key={metric.type} className={`${cfg.bg} rounded-xl px-3 py-2.5 flex items-center gap-2.5`}>
                    <span className={cfg.color}>{cfg.icon}</span>
                    <div className="min-w-0">
                      <p className={`text-sm font-bold ${cfg.color}`}>{cfg.format(metric.value)}</p>
                      <p className="text-xs text-slate-500">{cfg.label}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Blood Pressure (spans full width if present) */}
            {systolic && diastolic && (
              <div className="bg-orange-50 rounded-xl px-3 py-2.5 flex items-center gap-2.5">
                <span className="text-orange-600"><Droplets size={14} /></span>
                <div>
                  <p className="text-sm font-bold text-orange-600">
                    {Math.round(systolic.value)}/{Math.round(diastolic.value)} mmHg
                  </p>
                  <p className="text-xs text-slate-500">Blood Pressure</p>
                </div>
              </div>
            )}
            {systolic && !diastolic && (
              <div className="bg-orange-50 rounded-xl px-3 py-2.5 flex items-center gap-2.5">
                <span className="text-orange-600"><Droplets size={14} /></span>
                <div>
                  <p className="text-sm font-bold text-orange-600">{Math.round(systolic.value)} mmHg</p>
                  <p className="text-xs text-slate-500">Systolic BP</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Setup sheet */}
      {showSetup && user && (
        <SetupSheet
          apiKey={apiKey}
          userId={user.id}
          onClose={() => setShowSetup(false)}
          onKeyChange={handleKeyChange}
        />
      )}
    </section>
  );
}
