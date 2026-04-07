import { useEffect, useRef } from 'react';
import { useApp } from '../contexts/AppContext';
import { SUPPLEMENT_TIME_WINDOWS } from '../types';
import {
  isNotificationSupported,
  getNotificationPermission,
  showMedicationNotification,
  showSupplementNotification,
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

      // ── Supplement schedule notifications ────────────────────────────────
      // Three notification types:
      //   1. Pre-window: 15 min before window start
      //   2. Due: at window start
      //   3. Overdue: every 30 min after window start until taken or window ends
      const PRE_WINDOW_MINS = 15;
      const OVERDUE_INTERVAL_MINS = 30;

      const activeSupSchedules = (state.supplementSchedules ?? []).filter(
        s => s.patientId === state.activePatientId && s.status === 'active'
      );

      for (const schedule of activeSupSchedules) {
        const tw = schedule.timeWindow ? SUPPLEMENT_TIME_WINDOWS[schedule.timeWindow] : undefined;
        if (!tw) continue;

        const [sh, sm] = tw.start.split(':').map(Number);
        const [eh, em] = tw.end.split(':').map(Number);
        const [ch, cm] = currentTime.split(':').map(Number);
        const currentMins = ch * 60 + cm;
        const startMins = sh * 60 + sm;
        const endMins = eh * 60 + em;

        // Already logged today? Skip all notifications
        const alreadyLogged = (state.supplementLogs ?? []).some(
          l => l.patientId === state.activePatientId
            && l.date === today
            && l.name.toLowerCase() === schedule.name.toLowerCase()
        );
        if (alreadyLogged) continue;

        // 1. Pre-window reminder (15 min before start)
        const preKey = `pre-${schedule.name}`;
        if (
          currentMins >= startMins - PRE_WINDOW_MINS
          && currentMins < startMins
          && !wasNotificationSent(today, preKey, tw.start)
        ) {
          showSupplementNotification(schedule.name, schedule.quantity, tw.label, 'pre');
          markNotificationSent(today, preKey, tw.start);
        }

        // 2. Due reminder (at window start)
        const dueKey = `due-${schedule.name}`;
        if (
          currentMins >= startMins
          && currentMins < startMins + 5  // within first 5 min of window
          && !wasNotificationSent(today, dueKey, tw.start)
        ) {
          showSupplementNotification(schedule.name, schedule.quantity, tw.label, 'due');
          markNotificationSent(today, dueKey, tw.start);
        }

        // 3. Overdue reminders (every 30 min after start, until window ends)
        if (currentMins > startMins && currentMins <= endMins) {
          const minutesPast = currentMins - startMins;
          // Find which overdue slot we're in (30, 60, 90, ...)
          const overdueSlot = Math.floor(minutesPast / OVERDUE_INTERVAL_MINS);
          if (overdueSlot >= 1) {
            const overdueTime = `${String(Math.floor((startMins + overdueSlot * OVERDUE_INTERVAL_MINS) / 60)).padStart(2, '0')}:${String((startMins + overdueSlot * OVERDUE_INTERVAL_MINS) % 60).padStart(2, '0')}`;
            const overdueKey = `overdue-${schedule.name}`;
            if (!wasNotificationSent(today, overdueKey, overdueTime)) {
              showSupplementNotification(schedule.name, schedule.quantity, tw.label, 'overdue');
              markNotificationSent(today, overdueKey, overdueTime);
            }
          }
        }
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
    state.supplementSchedules,
    state.supplementLogs,
  ]);
}
