import { useEffect, useRef } from 'react';
import { useApp } from '../contexts/AppContext';
import { SUPPLEMENT_TIME_WINDOWS } from '../types';
import {
  isNotificationSupported,
  getNotificationPermission,
  showMedicationNotification,
  isWithinWindow,
  wasNotificationSent,
  markNotificationSent,
} from '../utils/notifications';

/**
 * Runs a 60-second interval that fires browser notifications
 * for medication doses that are due AND supplement database entries
 * whose time window is active. Mount once at the app level.
 */
export function useNotificationScheduler() {
  const { state } = useApp();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isNotificationSupported()) return;
    if (!state.notificationPrefs.enabled) return;
    if (getNotificationPermission() !== 'granted') return;

    function check() {
      const now = new Date();
      const today = now.toISOString().slice(0, 10);
      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const windowMins = state.notificationPrefs.reminderWindowMinutes;

      // ── Medication schedule notifications ──────────────────────────────
      const activeSchedules = state.medicationSchedules.filter(
        s => s.patientId === state.activePatientId
          && s.status === 'active'
          && s.notificationsEnabled
      );

      for (const schedule of activeSchedules) {
        for (const doseTime of schedule.doseTimes) {
          if (
            isWithinWindow(currentTime, doseTime, windowMins)
            && !wasNotificationSent(today, schedule.name, doseTime)
          ) {
            showMedicationNotification(schedule.name, schedule.dosage, doseTime);
            markNotificationSent(today, schedule.name, doseTime);
          }
        }
      }

      // ── Supplement database notifications ──────────────────────────────
      const dbEntries = (state.supplementDatabase ?? []).filter(
        e => e.patientId === state.activePatientId
      );

      for (const entry of dbEntries) {
        const tw = SUPPLEMENT_TIME_WINDOWS[entry.timeWindow];
        if (!tw) continue;

        // Check if current time is within the window (start to end)
        const [sh, sm] = tw.start.split(':').map(Number);
        const [eh, em] = tw.end.split(':').map(Number);
        const [ch, cm] = currentTime.split(':').map(Number);
        const currentMins = ch * 60 + cm;
        const startMins = sh * 60 + sm;
        const endMins = eh * 60 + em;

        if (currentMins < startMins || currentMins > endMins) continue;

        // Already sent today for this entry?
        if (wasNotificationSent(today, entry.name, tw.start)) continue;

        // Already logged today?
        const alreadyLogged = (state.supplementLogs ?? []).some(
          l => l.patientId === state.activePatientId
            && l.date === today
            && l.name.toLowerCase() === entry.name.toLowerCase()
        );
        if (alreadyLogged) continue;

        // Fire notification
        showMedicationNotification(entry.name, entry.quantity, tw.start);
        markNotificationSent(today, entry.name, tw.start);
      }
    }

    // Check immediately, then every 60 seconds
    check();
    intervalRef.current = setInterval(check, 60_000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [
    state.notificationPrefs.enabled,
    state.notificationPrefs.reminderWindowMinutes,
    state.medicationSchedules,
    state.activePatientId,
    state.supplementDatabase,
    state.supplementLogs,
  ]);
}
