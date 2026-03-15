import { useEffect, useRef } from 'react';
import { useApp } from '../contexts/AppContext';
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
 * for medication doses that are due. Mount once at the app level.
 *
 * Only fires when:
 * - Notifications are supported + granted + enabled
 * - Schedule is active + has notificationsEnabled
 * - Current time is within the reminder window of a dose time
 * - Notification hasn't already been sent today for this dose
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
  ]);
}
