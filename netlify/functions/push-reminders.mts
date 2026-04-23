import webpush from 'web-push';
import type { Config } from '@netlify/functions';

/**
 * Scheduled function — runs every minute.
 * Reads reminders from user_app_state and sends web push notifications
 * to all subscribed devices when a reminder is due.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

interface Reminder {
  id: string;
  patientId: string;
  title: string;
  time: string;           // HH:MM (24h)
  repeat: 'hourly' | 'daily' | 'weekly' | 'monthly';
  daysOfWeek?: number[];  // 0–6 for weekly
  dayOfMonth?: number;    // 1–31 for monthly
  enabled: boolean;
}

interface PushSubscriptionRecord {
  id: string;
  user_id: string;
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } };
  utc_offset_minutes: number;
}

interface AppStateRow {
  user_id: string;
  state_json: { reminders?: Reminder[] };
}

// ── Due-time check ────────────────────────────────────────────────────────────

/**
 * Returns true if this reminder should fire right now for the given UTC offset.
 * "Now" is the time at which this function was called (UTC).
 */
function isDueNow(reminder: Reminder, utcOffsetMinutes: number): boolean {
  if (!reminder.enabled) return false;

  const utcNow = new Date();
  // Compute the user's local time (in total minutes since midnight)
  const utcTotalMinutes = utcNow.getUTCHours() * 60 + utcNow.getUTCMinutes();
  const localTotalMinutes = (utcTotalMinutes + utcOffsetMinutes + 1440) % 1440;

  const localHH = Math.floor(localTotalMinutes / 60);
  const localMM = localTotalMinutes % 60;

  // User's local date (for weekly/monthly checks)
  const localDayOfWeek = new Date(Date.UTC(
    utcNow.getUTCFullYear(),
    utcNow.getUTCMonth(),
    utcNow.getUTCDate(),
    utcNow.getUTCHours(),
    utcNow.getUTCMinutes(),
  ).valueOf() + utcOffsetMinutes * 60000).getUTCDay(); // 0 = Sun

  const localDayOfMonth = new Date(Date.UTC(
    utcNow.getUTCFullYear(),
    utcNow.getUTCMonth(),
    utcNow.getUTCDate(),
    utcNow.getUTCHours(),
    utcNow.getUTCMinutes(),
  ).valueOf() + utcOffsetMinutes * 60000).getUTCDate(); // 1–31

  const [reminderHH, reminderMM] = reminder.time.split(':').map(Number);

  switch (reminder.repeat) {
    case 'hourly':
      return localMM === reminderMM;

    case 'daily':
      return localHH === reminderHH && localMM === reminderMM;

    case 'weekly':
      return (
        localHH === reminderHH &&
        localMM === reminderMM &&
        (reminder.daysOfWeek ?? []).includes(localDayOfWeek)
      );

    case 'monthly':
      return (
        localHH === reminderHH &&
        localMM === reminderMM &&
        reminder.dayOfMonth === localDayOfMonth
      );

    default:
      return false;
  }
}

// ── Dedup key ─────────────────────────────────────────────────────────────────

function sentKey(reminderId: string, utcNow: Date, repeat: string): string {
  const YYYY = utcNow.getUTCFullYear();
  const MM   = String(utcNow.getUTCMonth() + 1).padStart(2, '0');
  const DD   = String(utcNow.getUTCDate()).padStart(2, '0');
  const HH   = String(utcNow.getUTCHours()).padStart(2, '0');
  const min  = String(utcNow.getUTCMinutes()).padStart(2, '0');
  // Hourly reminders dedup per minute; others dedup per day+time.
  const granularity = repeat === 'hourly' ? `${HH}${min}` : `${HH}${min}`;
  return `${YYYY}${MM}${DD}T${granularity}|${reminderId}`;
}

// ── Main handler ──────────────────────────────────────────────────────────────

export default async function handler() {
  const supabaseUrl      = process.env.SUPABASE_URL;
  const serviceRoleKey   = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const vapidPublicKey   = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivateKey  = process.env.VAPID_PRIVATE_KEY;
  const vapidEmail       = process.env.VAPID_EMAIL ?? 'mailto:admin@example.com';

  if (!supabaseUrl || !serviceRoleKey || !vapidPublicKey || !vapidPrivateKey) {
    console.error('[push-reminders] Missing required env vars');
    return;
  }

  webpush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey);

  const headers = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    'Content-Type': 'application/json',
  };

  const base = `${supabaseUrl}/rest/v1`;
  const utcNow = new Date();

  // ── 1. Load all app states that have reminders ────────────────────────────
  const stateRes = await fetch(`${base}/user_app_state?select=user_id,state_json`, { headers });
  if (!stateRes.ok) {
    console.error('[push-reminders] Failed to load app states:', await stateRes.text());
    return;
  }
  const states: AppStateRow[] = await stateRes.json();

  // ── 2. Load all push subscriptions ────────────────────────────────────────
  const subRes = await fetch(
    `${base}/push_subscriptions?select=id,user_id,subscription,utc_offset_minutes`,
    { headers }
  );
  if (!subRes.ok) {
    console.error('[push-reminders] Failed to load subscriptions:', await subRes.text());
    return;
  }
  const allSubs: PushSubscriptionRecord[] = await subRes.json();

  let sent = 0;
  let skipped = 0;

  for (const row of states) {
    const reminders = row.state_json?.reminders ?? [];
    if (reminders.length === 0) continue;

    const userSubs = allSubs.filter(s => s.user_id === row.user_id);
    if (userSubs.length === 0) continue;

    for (const sub of userSubs) {
      const offset = sub.utc_offset_minutes;

      for (const reminder of reminders) {
        if (!isDueNow(reminder, offset)) continue;

        const key = sentKey(reminder.id, utcNow, reminder.repeat);

        // ── 3. Dedup check ──────────────────────────────────────────────────
        const dedupRes = await fetch(
          `${base}/push_sent_log?select=id&user_id=eq.${row.user_id}&dedup_key=eq.${encodeURIComponent(key)}&limit=1`,
          { headers }
        );
        const dedupRows: { id: string }[] = dedupRes.ok ? await dedupRes.json() : [];
        if (dedupRows.length > 0) {
          skipped++;
          continue;
        }

        // ── 4. Send push ────────────────────────────────────────────────────
        const payload = JSON.stringify({
          title: reminder.title,
          body:  `Reminder: ${reminder.title}`,
          icon:  '/icons/icon-192x192.png',
          badge: '/icons/icon-192x192.png',
          tag:   `reminder-${reminder.id}`,
        });

        try {
          await webpush.sendNotification(
            sub.subscription as webpush.PushSubscription,
            payload
          );

          // ── 5. Record in dedup log ────────────────────────────────────────
          await fetch(`${base}/push_sent_log`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              user_id:   row.user_id,
              dedup_key: key,
            }),
          });

          sent++;
        } catch (err) {
          // 410 = subscription expired / unsubscribed — remove it
          if ((err as { statusCode?: number }).statusCode === 410) {
            await fetch(`${base}/push_subscriptions?id=eq.${sub.id}`, {
              method: 'DELETE',
              headers,
            });
            console.log('[push-reminders] Removed stale subscription:', sub.id);
          } else {
            console.error('[push-reminders] sendNotification error:', err);
          }
        }
      }
    }
  }

  console.log(`[push-reminders] done — sent=${sent} skipped=${skipped}`);
}

export const config: Config = {
  schedule: '* * * * *', // every minute
};
