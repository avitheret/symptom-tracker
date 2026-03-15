import { useState } from 'react';
import { Plus, Pencil, Trash2, Pause, Play, Bell, BellOff, Clock, Smartphone } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { usePushSubscription } from '../hooks/usePushSubscription';
import { formatTime12, isNotificationSupported, getNotificationPermission, requestNotificationPermission } from '../utils/notifications';
import type { MedicationSchedule } from '../types';
import { SectionHeader, Card, Badge, EmptyState, Button } from './ui';

interface Props {
  onAdd: () => void;
  onEdit: (schedule: MedicationSchedule) => void;
}

export default function MedScheduleList({ onAdd, onEdit }: Props) {
  const { state, updateMedSchedule, deleteMedSchedule, setNotificationPrefs } = useApp();
  const { isAuthenticated } = useAuth();
  const { isSubscribed, isSupported: pushSupported, loading: pushLoading, subscribe: pushSubscribe, unsubscribe: pushUnsubscribe } = usePushSubscription();
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const schedules = state.medicationSchedules.filter(
    s => s.patientId === state.activePatientId
  );

  // Find next upcoming dose time
  function getNextDose(doseTimes: string[]): string | null {
    const now = new Date();
    const currentMins = now.getHours() * 60 + now.getMinutes();
    for (const t of doseTimes) {
      const [h, m] = t.split(':').map(Number);
      if (h * 60 + m > currentMins) return t;
    }
    return doseTimes[0] ?? null; // Next is tomorrow's first dose
  }

  async function handleToggleNotifications() {
    if (state.notificationPrefs.enabled) {
      setNotificationPrefs({ enabled: false });
      return;
    }

    if (!isNotificationSupported()) {
      setPermissionDenied(true);
      return;
    }

    const permission = getNotificationPermission();
    if (permission === 'granted') {
      setNotificationPrefs({ enabled: true });
      setPermissionDenied(false);
    } else if (permission === 'denied') {
      setPermissionDenied(true);
    } else {
      const result = await requestNotificationPermission();
      if (result === 'granted') {
        setNotificationPrefs({ enabled: true });
        setPermissionDenied(false);
      } else {
        setPermissionDenied(true);
      }
    }
  }

  if (schedules.length === 0) {
    return (
      <div className="mb-6">
        <SectionHeader
          title="Medication Schedule"
          action={{ label: 'Add', onClick: onAdd }}
        />
        <EmptyState
          icon={<Clock size={32} className="text-slate-300" />}
          title="No medications scheduled"
          description="Set up your daily medication schedule with dose times and reminders."
          action={{ label: 'Add Medication', onClick: onAdd }}
        />
      </div>
    );
  }

  return (
    <div className="mb-6 space-y-3">
      <SectionHeader
        title="Medication Schedule"
        action={{ label: 'Add', onClick: onAdd }}
      />

      {schedules.map(schedule => {
        const nextDose = schedule.status === 'active' ? getNextDose(schedule.doseTimes) : null;
        const isDeleting = confirmDeleteId === schedule.id;

        return (
          <Card key={schedule.id} padding>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {/* Status dot */}
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    schedule.status === 'active' ? 'bg-emerald-500' : 'bg-slate-300'
                  }`} />
                  <h4 className="font-semibold text-slate-900 truncate">{schedule.name}</h4>
                  {schedule.dosage && (
                    <span className="text-xs text-slate-500 font-medium">{schedule.dosage}</span>
                  )}
                </div>

                {/* Route & Condition */}
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {schedule.route && (
                    <Badge variant="neutral">{schedule.route}</Badge>
                  )}
                  {schedule.conditionName && (
                    <Badge variant="info">{schedule.conditionName}</Badge>
                  )}
                  {schedule.status === 'paused' && (
                    <Badge variant="warning">Paused</Badge>
                  )}
                </div>

                {/* Dose times */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {schedule.doseTimes.map((t, i) => (
                    <span
                      key={i}
                      className={`px-2 py-0.5 rounded-md text-xs font-medium ${
                        t === nextDose
                          ? 'bg-teal-100 text-teal-800 ring-1 ring-teal-300'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {formatTime12(t)}
                      {t === nextDose && ' ← next'}
                    </span>
                  ))}
                </div>

                {/* Frequency description */}
                <p className="text-xs text-slate-400 mt-1.5">
                  {schedule.frequency}× daily · every {schedule.intervalHours}h
                  {schedule.notificationsEnabled && (
                    <span className="text-teal-500 ml-1">
                      · <Bell size={10} className="inline" /> reminders on
                    </span>
                  )}
                </p>

                {schedule.notes && (
                  <p className="text-xs text-slate-400 mt-1 italic">{schedule.notes}</p>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => onEdit(schedule)}
                  className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                  title="Edit"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => updateMedSchedule(schedule.id, {
                    status: schedule.status === 'active' ? 'paused' : 'active',
                  })}
                  className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                  title={schedule.status === 'active' ? 'Pause' : 'Resume'}
                >
                  {schedule.status === 'active' ? <Pause size={14} /> : <Play size={14} />}
                </button>
                {isDeleting ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => { deleteMedSchedule(schedule.id); setConfirmDeleteId(null); }}
                      className="text-xs px-2 py-1 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                    >
                      Yes
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="text-xs px-2 py-1 border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDeleteId(schedule.id)}
                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          </Card>
        );
      })}

      {/* Notification Preferences */}
      <div className="pt-2">
        <button
          onClick={handleToggleNotifications}
          className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-colors ${
            state.notificationPrefs.enabled
              ? 'bg-teal-50 border-teal-200'
              : 'bg-slate-50 border-slate-200'
          }`}
        >
          {state.notificationPrefs.enabled
            ? <Bell size={16} className="text-teal-500" />
            : <BellOff size={16} className="text-slate-400" />
          }
          <div className="text-left flex-1">
            <p className="text-sm font-medium text-slate-700">
              {state.notificationPrefs.enabled ? 'Notifications On' : 'Notifications Off'}
            </p>
            <p className="text-xs text-slate-400">
              {state.notificationPrefs.enabled
                ? 'You will receive browser alerts for scheduled doses'
                : 'Enable to get dose reminders'
              }
            </p>
          </div>
          <div className={`w-10 h-6 rounded-full flex items-center transition-colors ${
            state.notificationPrefs.enabled ? 'bg-teal-500 justify-end' : 'bg-slate-300 justify-start'
          }`}>
            <div className="w-5 h-5 bg-white rounded-full shadow-sm mx-0.5" />
          </div>
        </button>

        {permissionDenied && (
          <p className="text-xs text-amber-600 mt-2 px-1">
            Notification permission was denied. Please enable notifications in your browser settings.
          </p>
        )}

        {/* Push Notifications toggle — only when authenticated */}
        {pushSupported && isAuthenticated && (
          <button
            onClick={() => isSubscribed ? pushUnsubscribe() : pushSubscribe()}
            disabled={pushLoading}
            className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-colors mt-2 ${
              isSubscribed
                ? 'bg-indigo-50 border-indigo-200'
                : 'bg-slate-50 border-slate-200'
            } ${pushLoading ? 'opacity-60' : ''}`}
          >
            <Smartphone size={16} className={isSubscribed ? 'text-indigo-500' : 'text-slate-400'} />
            <div className="text-left flex-1">
              <p className="text-sm font-medium text-slate-700">
                {pushLoading ? 'Setting up...' : isSubscribed ? 'Push Notifications On' : 'Push Notifications Off'}
              </p>
              <p className="text-xs text-slate-400">
                {isSubscribed
                  ? 'Reminders arrive even when the app is closed'
                  : 'Enable to get reminders when the app is closed'
                }
              </p>
            </div>
            <div className={`w-10 h-6 rounded-full flex items-center transition-colors ${
              isSubscribed ? 'bg-indigo-500 justify-end' : 'bg-slate-300 justify-start'
            }`}>
              <div className="w-5 h-5 bg-white rounded-full shadow-sm mx-0.5" />
            </div>
          </button>
        )}

        {!isAuthenticated && (
          <p className="text-xs text-slate-400 mt-2 px-1">
            Sign in to receive push notifications when the app is closed.
          </p>
        )}
      </div>

      <Button variant="outline" size="sm" className="w-full" onClick={onAdd} iconLeft={<Plus size={14} />}>
        Add Another Medication
      </Button>
    </div>
  );
}
