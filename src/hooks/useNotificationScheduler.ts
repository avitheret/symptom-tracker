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
 * for medication doses that are due AND supplement schedules.
 * Mount once at the app level.
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
      const PRE_WINDOW_MINS = 15;
      const OVERDUE_INTERVAL_MINS = 30;

      const activeSupSchedules = (state.supplementSchedules ?? []).filter(
        s => s.patientId === state.activePatientId
          && s.status === 'active'
          && s.notificationsEnabled !== false   // enabled by default (undefined = true)
      );

      const [ch, cm] = currentTime.split(':').map(Number);
      const currentMins = ch * 60 + cm;

      for (const schedule of activeSupSchedules) {
        // Already logged today? Skip all notifications for this supplement
        const alreadyLogged = (state.supplementLogs ?? []).some(
          l => l.patientId === state.activePatientId
            && l.date === today
            && l.name.toLowerCase() === schedule.name.toLowerCase()
        );
        if (alreadyLogged) continue;

        // ── timeWindow-based (morning/breakfast/lunch/dinner/bed) ──────────
        if (schedule.timeWindow) {
          const tw = SUPPLEMENT_TIME_WINDOWS[schedule.timeWindow];
          if (!tw) continue;

          const [sh, sm] = tw.start.split(':').map(Number);
          const [eh, em] = tw.end.split(':').map(Number);
          const startMins = sh * 60 + sm;
          const endMins = eh * 60 + em;

          // 1. Pre-window reminder
          const preKey = `pre-${schedule.name}`;
          if (
            currentMins >= startMins - PRE_WINDOW_MINS
            && currentMins < startMins
            && !wasNotificationSent(today, preKey, tw.start)
          ) {
            showSupplementNotification(schedule.name, schedule.quantity, tw.label, 'pre');
            markNotificationSent(today, preKey, tw.start);
          }

          // 2. Due reminder (at window start, within first 5 min)
          const dueKey = `due-${schedule.name}`;
          if (
            currentMins >= startMins
            && currentMins < startMins + 5
            && !wasNotificationSent(today, dueKey, tw.start)
          ) {
            showSupplementNotification(schedule.name, schedule.quantity, tw.label, 'due');
            markNotificationSent(today, dueKey, tw.start);
          }

          // 3. Overdue reminders (every 30 min after start until window ends)
          if (currentMins > startMins && currentMins <= endMins) {
            const overdueSlot = Math.floor((currentMins - startMins) / OVERDUE_INTERVAL_MINS);
            if (overdueSlot >= 1) {
              const overdueTimeMins = startMins + overdueSlot * OVERDUE_INTERVAL_MINS;
              const overdueTime = `${String(Math.floor(overdueTimeMins / 60)).padStart(2, '0')}:${String(overdueTimeMins % 60).padStart(2, '0')}`;
              const overdueKey = `overdue-${schedule.name}`;
              if (!wasNotificationSent(today, overdueKey, overdueTime)) {
                showSupplementNotification(schedule.name, schedule.quantity, tw.label, 'overdue');
                markNotificationSent(today, overdueKey, overdueTime);
              }
            }
          }
        }
        // ── reminderTime-based (explicit HH:MM) ────────────────────────────
        else if (schedule.reminderTime) {
          const dueKey = `rt-due-${schedule.name}`;
          if (
            isWithinWindow(currentTime, schedule.reminderTime, windowMins)
            && !wasNotificationSent(today, dueKey, schedule.reminderTime)
          ) {
            showSupplementNotification(schedule.name, schedule.quantity, 'Daily', 'due');
            markNotificationSent(today, dueKey, schedule.reminderTime);
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
