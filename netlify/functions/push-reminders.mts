import type { Config } from '@netlify/functions';

/**
 * Scheduled function — runs every minute.
 * Calls the Supabase Edge Function which checks all medication + supplement
 * schedules and sends web push notifications to subscribed devices.
 */
export default async function handler() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[push-reminders] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    return;
  }

  const url = `${supabaseUrl}/functions/v1/send-push-notifications`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
    });

    if (res.ok) {
      const data = await res.json();
      console.log(`[push-reminders] sent=${data.sent} skipped=${data.skipped}`);
    } else {
      console.error(`[push-reminders] Edge Function returned ${res.status}:`, await res.text());
    }
  } catch (err) {
    console.error('[push-reminders] fetch error:', err);
  }
}

export const config: Config = {
  schedule: '* * * * *', // every minute
};
