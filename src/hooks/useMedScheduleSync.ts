import { useEffect, useRef } from 'react';
import { supabase, CLOUD_ENABLED } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import type { MedicationSchedule } from '../types';

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Map a client-side MedicationSchedule to the snake_case columns used in Supabase. */
function toSupabaseRow(
  schedule: MedicationSchedule,
  userId: string,
  timezone: string,
  reminderWindowMinutes: number,
) {
  return {
    id: schedule.id,
    user_id: userId,
    patient_id: schedule.patientId,
    name: schedule.name,
    dosage: schedule.dosage,
    frequency: schedule.frequency,
    interval_hours: schedule.intervalHours,
    first_dose_time: schedule.firstDoseTime,
    dose_times: schedule.doseTimes,
    status: schedule.status,
    notifications_enabled: schedule.notificationsEnabled,
    timezone,
    reminder_window_minutes: reminderWindowMinutes,
  };
}

// ── Hook ────────────────────────────────────────────────────────────────────

/**
 * Syncs local medication schedules to the Supabase `medication_schedules` table.
 *
 * Runs as a side-effect only — nothing is returned. The hook watches
 * `state.medicationSchedules` from AppContext, diffs against the previous
 * snapshot, and pushes inserts / updates / deletes to Supabase.
 */
export function useMedScheduleSync() {
  const { state } = useApp();
  const { user, isAuthenticated } = useAuth();

  const prevRef = useRef<MedicationSchedule[] | null>(null);

  useEffect(() => {
    // Guard: only sync when cloud is active and the user is signed in
    if (!CLOUD_ENABLED || !isAuthenticated || !supabase || !user) {
      return;
    }

    const current = state.medicationSchedules;
    const previous = prevRef.current;

    // On first render, store the snapshot and skip diffing — the server is
    // assumed to already be in sync (or will be populated by an initial sync
    // elsewhere).
    if (previous === null) {
      prevRef.current = current;
      return;
    }

    // Build lookup maps
    const prevMap = new Map(previous.map((s) => [s.id, s]));
    const currMap = new Map(current.map((s) => [s.id, s]));

    // Compute diff
    const toUpsert: MedicationSchedule[] = [];
    const toDelete: string[] = [];

    // New or updated schedules
    for (const schedule of current) {
      const prev = prevMap.get(schedule.id);
      if (!prev || prev.updatedAt !== schedule.updatedAt) {
        toUpsert.push(schedule);
      }
    }

    // Deleted schedules (in previous but not in current)
    for (const prev of previous) {
      if (!currMap.has(prev.id)) {
        toDelete.push(prev.id);
      }
    }

    // Nothing changed
    if (toUpsert.length === 0 && toDelete.length === 0) {
      prevRef.current = current;
      return;
    }

    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const reminderWindowMinutes = state.notificationPrefs?.reminderWindowMinutes ?? 2;

    // Fire-and-forget async operations
    (async () => {
      try {
        if (toUpsert.length > 0) {
          const rows = toUpsert.map((s) =>
            toSupabaseRow(s, user.id, timezone, reminderWindowMinutes),
          );
          const { error } = await supabase.from('medication_schedules').upsert(rows);
          if (error) {
            console.error('[useMedScheduleSync] upsert error:', error);
          }
        }

        if (toDelete.length > 0) {
          const { error } = await supabase
            .from('medication_schedules')
            .delete()
            .eq('user_id', user.id)
            .in('id', toDelete);
          if (error) {
            console.error('[useMedScheduleSync] delete error:', error);
          }
        }
      } catch (err) {
        console.error('[useMedScheduleSync] sync error:', err);
      }
    })();

    // Update the ref to the latest snapshot
    prevRef.current = current;
  }, [state.medicationSchedules, state.notificationPrefs, isAuthenticated, user]);
}
