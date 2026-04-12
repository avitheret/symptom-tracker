import { useEffect, useRef } from 'react';
import { supabase, CLOUD_ENABLED } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';

const DEBOUNCE_MS = 4000;

/**
 * Syncs supplement schedules to Supabase supplement_schedules table.
 * The Edge Function queries this table to send server-side push notifications.
 */
export function useSupplementScheduleSync() {
  const { user } = useAuth();
  const { state } = useApp();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!CLOUD_ENABLED || !supabase || !user) return;

    const schedules = (state.supplementSchedules ?? []).filter(
      s => s.patientId === state.activePatientId
    );

    // Debounce
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      if (!supabase || !user) return;

      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const reminderWindow = state.notificationPrefs.reminderWindowMinutes ?? 2;

      // Upsert active schedules
      for (const s of schedules) {
        await supabase.from('supplement_schedules').upsert(
          {
            id: s.id,
            user_id: user.id,
            patient_id: s.patientId,
            name: s.name,
            quantity: s.quantity ?? null,
            time_window: s.timeWindow ?? null,
            reminder_time: s.reminderTime ?? null,
            status: s.status,
            notifications_enabled: s.notificationsEnabled !== false,
            reminder_window_minutes: reminderWindow,
            timezone: tz,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        ).then(({ error }) => {
          if (error) console.error('[suppSync] upsert error:', error);
        });
      }

      // Delete removed schedules for this user (keep only current ones)
      const currentIds = schedules.map(s => s.id);
      if (currentIds.length > 0) {
        await supabase
          .from('supplement_schedules')
          .delete()
          .eq('user_id', user.id)
          .not('id', 'in', `(${currentIds.join(',')})`)
          .then(({ error }) => {
            if (error) console.error('[suppSync] delete error:', error);
          });
      } else {
        // No schedules — clear all for this user
        await supabase
          .from('supplement_schedules')
          .delete()
          .eq('user_id', user.id)
          .then(({ error }) => {
            if (error) console.error('[suppSync] clear error:', error);
          });
      }
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [
    state.supplementSchedules,
    state.activePatientId,
    state.notificationPrefs.reminderWindowMinutes,
    user,
  ]);
}
