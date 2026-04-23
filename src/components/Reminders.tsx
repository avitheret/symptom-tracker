import { useState, useEffect } from 'react';
import {
  Bell, BellOff, Plus, Pencil, Trash2, CheckCircle,
  Info, Smartphone,
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import {
  isPushSupported,
  isIosDevice,
  isIosStandalone,
  getPushPermission,
  subscribeToPush,
  savePushSubscription,
  VAPID_PUBLIC_KEY,
} from '../utils/pushSubscription';
import { formatTime12 } from '../utils/notifications';
import type { Reminder } from '../types';
import { Card, EmptyState } from './ui';
import ReminderModal from './ReminderModal';

// ── Helpers ───────────────────────────────────────────────────────────────────

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function ordinal(n: number): string {
  if (n >= 11 && n <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}

function repeatSummary(reminder: Reminder): string {
  const t = formatTime12(reminder.time);
  const mm = reminder.time.split(':')[1] ?? '00';

  switch (reminder.repeat) {
    case 'hourly':
      return `Every hour at :${mm}`;
    case 'daily':
      return `Daily at ${t}`;
    case 'weekly': {
      if (!reminder.daysOfWeek || reminder.daysOfWeek.length === 0) return `Weekly at ${t}`;
      const sorted = [...reminder.daysOfWeek].sort((a, b) => a - b);
      const labels = sorted.map(d => DAY_LABELS[d]).join(' · ');
      return `${labels} at ${t}`;
    }
    case 'monthly': {
      if (!reminder.dayOfMonth) return `Monthly at ${t}`;
      return `${ordinal(reminder.dayOfMonth)} of month at ${t}`;
    }
    default:
      return t;
  }
}

// ── Toggle Switch ─────────────────────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
  id,
}: {
  checked: boolean;
  onChange: () => void;
  id: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={checked ? 'Disable reminder' : 'Enable reminder'}
      id={id}
      onClick={onChange}
      className={`relative inline-flex h-7 w-12 flex-shrink-0 rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 min-h-[44px] min-w-[44px] items-center justify-center ${
        checked ? 'bg-violet-600' : 'bg-slate-200'
      }`}
    >
      <span className="sr-only">{checked ? 'Enabled' : 'Disabled'}</span>
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 ${
          checked ? 'translate-x-2.5' : '-translate-x-2.5'
        }`}
      />
    </button>
  );
}

// ── Push Permission Banner ────────────────────────────────────────────────────

interface PushBannerProps {
  permission: NotificationPermission | 'unsupported';
  onSubscribed: () => void;
}

function PushBanner({ permission, onSubscribed }: PushBannerProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const iosDevice   = isIosDevice();
  const iosStandalone = isIosStandalone();
  const supported   = isPushSupported();

  // ── Already granted ──────────────────────────────────────────────────────
  if (permission === 'granted') {
    return (
      <div className="flex items-center gap-3 px-4 py-3 bg-emerald-50 border border-emerald-100 rounded-2xl">
        <CheckCircle size={18} className="text-emerald-500 flex-shrink-0" />
        <div>
          <p className="text-sm font-semibold text-emerald-700">Push notifications are on</p>
          <p className="text-xs text-emerald-600 mt-0.5">You'll receive alerts when reminders are due.</p>
        </div>
      </div>
    );
  }

  // ── Blocked ──────────────────────────────────────────────────────────────
  if (permission === 'denied') {
    return (
      <div className="flex items-start gap-3 px-4 py-3.5 bg-rose-50 border border-rose-100 rounded-2xl">
        <BellOff size={18} className="text-rose-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-rose-700">Notifications are blocked</p>
          <p className="text-xs text-rose-500 mt-1 leading-relaxed">
            Go to <strong>Settings → Safari → Notifications</strong> and allow notifications for this site, then come back and tap Enable.
          </p>
        </div>
      </div>
    );
  }

  // ── iOS: not installed to Home Screen yet ────────────────────────────────
  if (iosDevice && !iosStandalone) {
    return (
      <div className="flex items-start gap-3 px-4 py-3.5 bg-amber-50 border border-amber-200 rounded-2xl">
        <Smartphone size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-amber-800">Step 1 — Add to Home Screen</p>
          <p className="text-xs text-amber-700 mt-1 leading-relaxed">
            Tap the <strong>Share ↑</strong> button in Safari then choose{' '}
            <strong>Add to Home Screen</strong>. Open the app from your home screen, then come back here to enable push.
          </p>
        </div>
      </div>
    );
  }

  // ── Device doesn't support push at all (old iOS, non-standard browser) ───
  if (!supported) {
    return (
      <div className="flex items-start gap-3 px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
        <Info size={18} className="text-slate-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-slate-600">Push not available on this device</p>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            iOS 16.4+ required. You can still use reminders — they'll show as in-app alerts when the app is open.
          </p>
        </div>
      </div>
    );
  }

  // ── Default: show the Enable button ─────────────────────────────────────
  async function handleEnable() {
    setLoading(true);
    setError(null);
    try {
      const sub = await subscribeToPush(VAPID_PUBLIC_KEY);
      if (sub && user) {
        const utcOffsetMinutes = new Date().getTimezoneOffset() * -1;
        let jwt = '';
        try {
          const { supabase: sb, CLOUD_ENABLED } = await import('../lib/supabase');
          if (CLOUD_ENABLED && sb) {
            const { data } = await sb.auth.getSession();
            jwt = data.session?.access_token ?? '';
          }
        } catch { /* local mode */ }
        if (jwt) {
          await savePushSubscription(sub, jwt, utcOffsetMinutes);
        }
        onSubscribed();
      } else if (!sub) {
        setError('Permission was denied. Go to Settings → Safari → Notifications to allow it.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to enable notifications.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-violet-600 rounded-2xl p-4">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
          <Bell size={18} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white">Enable push notifications</p>
          <p className="text-xs text-white/70 mt-0.5 leading-relaxed">
            Get alerts on your phone even when the app is closed.
          </p>
          {error && (
            <p className="text-xs text-rose-200 mt-2 leading-relaxed">{error}</p>
          )}
        </div>
      </div>
      <button
        onClick={handleEnable}
        disabled={loading}
        className="mt-3 w-full py-2.5 bg-white text-violet-700 font-semibold text-sm rounded-xl active:scale-[0.98] transition-all disabled:opacity-60 min-h-[44px]"
      >
        {loading ? 'Enabling…' : 'Enable Notifications →'}
      </button>
    </div>
  );
}

// ── Reminder Row ──────────────────────────────────────────────────────────────

interface ReminderRowProps {
  reminder: Reminder;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}

function ReminderRow({ reminder, onEdit, onToggle, onDelete }: ReminderRowProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  function handleDeleteClick() {
    if (confirmDelete) {
      onDelete();
    } else {
      setConfirmDelete(true);
    }
  }

  return (
    <div className="flex items-center gap-3 py-3 px-4 border-b border-slate-50 last:border-0">
      {/* Toggle */}
      <Toggle
        checked={reminder.enabled}
        onChange={onToggle}
        id={`toggle-${reminder.id}`}
      />

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold leading-snug ${reminder.enabled ? 'text-slate-900' : 'text-slate-400'}`}>
          {reminder.title}
        </p>
        <p className="text-xs text-slate-400 mt-0.5">{repeatSummary(reminder)}</p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {confirmDelete ? (
          <>
            <span className="text-xs text-slate-500 mr-1">Delete?</span>
            <button
              onClick={handleDeleteClick}
              className="px-3 py-1.5 text-xs font-semibold bg-rose-500 text-white rounded-lg min-h-[36px] hover:bg-rose-600 active:scale-95 transition-all"
            >
              Yes
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="px-3 py-1.5 text-xs font-medium border border-slate-300 text-slate-600 rounded-lg min-h-[36px] hover:bg-slate-50 active:scale-95 transition-all"
            >
              No
            </button>
          </>
        ) : (
          <>
            <button
              onClick={onEdit}
              aria-label="Edit reminder"
              className="p-2.5 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-xl min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors active:scale-95"
            >
              <Pencil size={15} />
            </button>
            <button
              onClick={handleDeleteClick}
              aria-label="Delete reminder"
              className="p-2.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors active:scale-95"
            >
              <Trash2 size={15} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function Reminders() {
  const { state, toggleReminder, deleteReminder } = useApp();
  const [editingReminder, setEditingReminder] = useState<Reminder | null | 'new'>( null);
  const [pushPermission, setPushPermission] = useState<NotificationPermission | 'unsupported'>(
    () => getPushPermission()
  );

  // Re-check permission on mount (handles cases where user changed it externally)
  useEffect(() => {
    setPushPermission(getPushPermission());
  }, []);

  const reminders = (state.reminders ?? []).filter(
    r => r.patientId === state.activePatientId
  );

  function handleSubscribed() {
    setPushPermission('granted');
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-5 pt-6 pb-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Reminders</h1>
            <p className="text-sm text-slate-400 mt-0.5">Get notified when it matters</p>
          </div>
          <button
            onClick={() => setEditingReminder('new')}
            aria-label="Add reminder"
            className="flex items-center gap-1.5 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 active:scale-95 text-white text-sm font-semibold rounded-xl min-h-[44px] transition-all shadow-sm"
          >
            <Plus size={16} />
            Add
          </button>
        </div>
      </div>

      <div className="px-4 pt-5 space-y-4">
        {/* Push permission banner */}
        <PushBanner permission={pushPermission} onSubscribed={handleSubscribed} />

        {/* Reminder list */}
        {reminders.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Bell size={26} />}
              title="No reminders yet"
              description="Add your first reminder to get notified when it matters."
              action={{
                label: 'Add your first reminder',
                onClick: () => setEditingReminder('new'),
                icon: <Plus size={14} />,
              }}
            />
          </Card>
        ) : (
          <Card padding={false}>
            {reminders.map(r => (
              <ReminderRow
                key={r.id}
                reminder={r}
                onEdit={() => setEditingReminder(r)}
                onToggle={() => toggleReminder(r.id)}
                onDelete={() => deleteReminder(r.id)}
              />
            ))}
          </Card>
        )}
      </div>

      {/* Add / Edit Modal */}
      {editingReminder !== null && (
        <ReminderModal
          reminder={editingReminder === 'new' ? undefined : editingReminder}
          onClose={() => setEditingReminder(null)}
        />
      )}
    </div>
  );
}
