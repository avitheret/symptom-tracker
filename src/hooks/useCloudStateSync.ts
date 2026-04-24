/**
 * useCloudStateSync — bidirectional cross-device sync via Supabase.
 *
 * Strategy (last-writer-wins per device):
 *   • On user login → pull cloud state; if cloud is newer, replace local.
 *   • On any state change → debounced push to cloud (1 s).
 *   • On tab/window re-focus → pull again (picks up changes from other devices).
 *   • Supabase Realtime channel → instant pull when another device pushes,
 *     even while this device has the app open in the foreground.
 *
 * Requires the following table in Supabase (see sync-schema.sql):
 *   create table user_app_state (
 *     user_id   uuid primary key references auth.users(id) on delete cascade,
 *     state_json jsonb not null default '{}',
 *     updated_at timestamptz not null default now()
 *   );
 *   -- Realtime (migration 004):
 *   ALTER PUBLICATION supabase_realtime ADD TABLE user_app_state;
 */

import { useEffect, useRef } from 'react';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase, CLOUD_ENABLED } from '../lib/supabase';

const TABLE = 'user_app_state';
const DEBOUNCE_MS = 1000;

/** localStorage key that stores the Supabase updated_at of the last sync. */
const SYNCED_AT_KEY = 'st-cloud-synced-at';

export function useCloudStateSync() {
  const { state, restoreFromCloud } = useApp();
  const { user } = useAuth();

  const debounceRef      = useRef<ReturnType<typeof setTimeout> | null>(null);
  const justPulledRef    = useRef(false);  // prevents push immediately after pull
  const justPushedRef    = useRef(false);  // prevents re-pull of our own push via Realtime
  const pullingRef       = useRef(false);  // prevents concurrent pulls
  const initialPullDone  = useRef(false);  // blocks push until first pull completes

  // ── Build the payload to push (data only — no UI/transient fields) ─────────
  const buildPayload = () => ({
    patients:             state.patients,
    activePatientId:      state.activePatientId,
    entries:              state.entries,
    triggerLogs:          state.triggerLogs,
    checkIns:             state.checkIns,
    medicationLogs:       state.medicationLogs,
    foodLogs:             state.foodLogs,
    notes:                state.notes,
    aiInsights:           state.aiInsights,
    medicationSchedules:  state.medicationSchedules,
    supplementLogs:       state.supplementLogs,
    supplementSchedules:  state.supplementSchedules,
    notificationPrefs:    state.notificationPrefs,
    reminders:            state.reminders,
  });

  // ── Pull ────────────────────────────────────────────────────────────────────
  /**
   * @param forceReplace - true on login (always apply cloud data);
   *                       false on visibilitychange (only if cloud is newer).
   */
  async function pullFromCloud(userId: string, forceReplace = false) {
    if (!CLOUD_ENABLED || !supabase || pullingRef.current) return;
    pullingRef.current = true;
    try {
      console.log('[sync] pulling for user', userId.slice(0, 8) + '…', 'force:', forceReplace);
      const { data, error } = await supabase
        .from(TABLE)
        .select('state_json, updated_at')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) { console.error('[sync] pull failed:', error.code, error.message); return; }
      if (!data)  { console.log('[sync] pull: table empty — nothing to restore'); return; }

      const cloudAt = new Date(data.updated_at).getTime();
      const localAt = parseInt(localStorage.getItem(SYNCED_AT_KEY) ?? '0', 10);

      console.log('[sync] cloudAt:', new Date(cloudAt).toISOString(), 'localAt:', new Date(localAt).toISOString(), 'will restore:', forceReplace || cloudAt > localAt);
      if (forceReplace || cloudAt > localAt) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        restoreFromCloud(data.state_json as any);
        localStorage.setItem(SYNCED_AT_KEY, String(cloudAt));
        // Suppress any push triggered by the state change from restoreFromCloud
        justPulledRef.current = true;
        setTimeout(() => { justPulledRef.current = false; }, DEBOUNCE_MS + 1500);
      }
    } catch (err) {
      console.error('[sync] pull error:', err);
    } finally {
      pullingRef.current = false;
      initialPullDone.current = true;  // unblock push
    }
  }

  // ── Push ────────────────────────────────────────────────────────────────────
  async function pushToCloud(userId: string) {
    if (!CLOUD_ENABLED || !supabase) {
      console.warn('[sync] push skipped — CLOUD_ENABLED:', CLOUD_ENABLED, 'supabase:', !!supabase);
      return;
    }
    try {
      const now = new Date().toISOString();
      console.log('[sync] pushing for user', userId.slice(0, 8) + '…');

      // Mark as "just pushed" so the Realtime echo doesn't re-pull our own data
      justPushedRef.current = true;
      setTimeout(() => { justPushedRef.current = false; }, 3000);

      const { error } = await supabase
        .from(TABLE)
        .upsert(
          { user_id: userId, state_json: buildPayload(), updated_at: now },
          { onConflict: 'user_id' }
        );
      if (error) {
        console.error('[sync] push failed:', error.code, error.message, error.details, error.hint);
      } else {
        localStorage.setItem(SYNCED_AT_KEY, String(new Date(now).getTime()));
        console.log('[sync] push ok at', now);
      }
    } catch (err) {
      console.error('[sync] push exception:', err);
    }
  }

  // ── On login / auth restore: pull using timestamp comparison ────────────────
  useEffect(() => {
    if (user?.id) pullFromCloud(user.id, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // ── On state change: debounced push ─────────────────────────────────────────
  useEffect(() => {
    if (!user?.id || !CLOUD_ENABLED) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      if (!initialPullDone.current) return;  // wait for first pull before pushing
      if (justPulledRef.current) return;     // skip push right after a pull
      await pushToCloud(user.id);
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    user?.id,
    state.patients,
    state.entries,
    state.triggerLogs,
    state.checkIns,
    state.medicationLogs,
    state.foodLogs,
    state.notes,
    state.medicationSchedules,
    state.supplementLogs,
    state.supplementSchedules,
    state.notificationPrefs,
    state.reminders,
  ]);

  // ── On app focus/restore: pull if cloud is newer ────────────────────────────
  useEffect(() => {
    if (!user?.id) return;
    const uid = user.id;

    const handleFocus = () => pullFromCloud(uid, false);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') pullFromCloud(uid, false);
    };
    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted || document.visibilityState === 'visible') pullFromCloud(uid, false);
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('pageshow', handlePageShow);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('pageshow', handlePageShow);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // ── Supabase Realtime: instant pull when another device pushes ──────────────
  // When Device A writes a new state_json, Supabase broadcasts a postgres_changes
  // event. Device B (and any other open device) receives it and pulls immediately
  // without needing a focus/visibility event.
  //
  // Guard: justPushedRef prevents Device A from re-pulling its own write
  // (Supabase echoes the event back to all subscribers including the writer).
  useEffect(() => {
    if (!user?.id || !CLOUD_ENABLED || !supabase) return;
    const uid = user.id;

    const channel = supabase
      .channel(`app-state-${uid}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: TABLE,
          filter: `user_id=eq.${uid}`,
        },
        () => {
          if (justPushedRef.current || justPulledRef.current) return;
          console.log('[sync] realtime: remote change detected — pulling');
          pullFromCloud(uid, false);
        }
      )
      .subscribe((status) => {
        console.log('[sync] realtime channel status:', status);
      });

    return () => {
      void supabase?.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);
}
