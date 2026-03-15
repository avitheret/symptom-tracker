import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ── Environment ──
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!;
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!;
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:noreply@symtrack.netlify.app';

// ── Helpers ──

function formatTime12(time24: string): string {
  const [h, m] = time24.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function isWithinWindow(currentMinutes: number, doseMinutes: number, windowMinutes: number): boolean {
  let diff = Math.abs(currentMinutes - doseMinutes);
  if (diff > 720) diff = 1440 - diff; // wrap around midnight
  return diff <= windowMinutes;
}

// ── Base64url utilities ──

function base64urlToUint8Array(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
  const binary = atob(b64 + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function uint8ArrayToBase64url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// ── VAPID JWT ──

async function createVapidJwt(audience: string): Promise<string> {
  const header = { typ: 'JWT', alg: 'ES256' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: audience,
    exp: now + 12 * 3600,
    sub: VAPID_SUBJECT,
  };

  const enc = new TextEncoder();
  const headerB64 = uint8ArrayToBase64url(enc.encode(JSON.stringify(header)));
  const payloadB64 = uint8ArrayToBase64url(enc.encode(JSON.stringify(payload)));
  const unsigned = `${headerB64}.${payloadB64}`;

  // Import private key
  const rawKey = base64urlToUint8Array(VAPID_PRIVATE_KEY);
  const key = await crypto.subtle.importKey(
    'pkcs8',
    await pkcs8FromRaw(rawKey),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );

  const signature = new Uint8Array(
    await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      key,
      enc.encode(unsigned)
    )
  );

  return `${unsigned}.${uint8ArrayToBase64url(signature)}`;
}

// Convert raw 32-byte EC private key to PKCS8 DER format
async function pkcs8FromRaw(raw: Uint8Array): Promise<ArrayBuffer> {
  // PKCS8 header for P-256 EC key
  const header = new Uint8Array([
    0x30, 0x81, 0x87, 0x02, 0x01, 0x00, 0x30, 0x13,
    0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02,
    0x01, 0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d,
    0x03, 0x01, 0x07, 0x04, 0x6d, 0x30, 0x6b, 0x02,
    0x01, 0x01, 0x04, 0x20,
  ]);
  const footer = new Uint8Array([
    0xa1, 0x44, 0x03, 0x42, 0x00,
  ]);

  // We need to derive the public key from the private key
  // Import as JWK to get both coordinates
  const jwk = await crypto.subtle.importKey(
    'raw',
    raw,
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign']
  ).catch(() => null);

  if (jwk) {
    const exported = await crypto.subtle.exportKey('pkcs8', jwk);
    return exported;
  }

  // Fallback: construct manually
  const result = new Uint8Array(header.length + raw.length + footer.length + 65);
  result.set(header);
  result.set(raw, header.length);
  // For the public key part, we'd need to compute it - skip for now
  return result.buffer;
}

// ── Send Web Push (simplified - payload as plaintext for now) ──

async function sendPushNotification(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: object
): Promise<boolean> {
  try {
    const url = new URL(subscription.endpoint);
    const audience = `${url.protocol}//${url.host}`;
    const jwt = await createVapidJwt(audience);

    const body = JSON.stringify(payload);

    const response = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Encoding': 'aes128gcm',
        'TTL': '86400',
        'Authorization': `vapid t=${jwt}, k=${VAPID_PUBLIC_KEY}`,
        'Content-Length': String(new TextEncoder().encode(body).length),
      },
      body,
    });

    if (response.status === 201 || response.status === 200) {
      return true;
    }

    // 404 or 410 = subscription expired/invalid
    if (response.status === 404 || response.status === 410) {
      console.log(`Subscription expired: ${subscription.endpoint.slice(0, 50)}...`);
      return false;
    }

    console.error(`Push failed (${response.status}):`, await response.text());
    return false;
  } catch (err) {
    console.error('Push error:', err);
    return false;
  }
}

// ── Main handler ──

Deno.serve(async (req) => {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Get all active schedules with notifications enabled
    const { data: schedules, error: schedErr } = await supabase
      .from('medication_schedules')
      .select('*')
      .eq('status', 'active')
      .eq('notifications_enabled', true);

    if (schedErr) {
      console.error('Error fetching schedules:', schedErr);
      return new Response(JSON.stringify({ error: schedErr.message }), { status: 500 });
    }

    if (!schedules || schedules.length === 0) {
      return Response.json({ sent: 0, message: 'No active schedules' });
    }

    const today = new Date().toISOString().slice(0, 10);
    let sentCount = 0;
    let skippedCount = 0;

    for (const schedule of schedules) {
      // Calculate current time in the schedule's timezone
      const tz = schedule.timezone || 'UTC';
      const nowInTz = new Date().toLocaleString('en-US', { timeZone: tz });
      const localDate = new Date(nowInTz);
      const currentMinutes = localDate.getHours() * 60 + localDate.getMinutes();
      const localDateStr = `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, '0')}-${String(localDate.getDate()).padStart(2, '0')}`;

      for (const doseTime of (schedule.dose_times as string[])) {
        const doseMinutes = timeToMinutes(doseTime);
        const window = schedule.reminder_window_minutes ?? 2;

        if (!isWithinWindow(currentMinutes, doseMinutes, window)) {
          continue;
        }

        // 2. Check dedup
        const { data: existing } = await supabase
          .from('sent_notifications')
          .select('id')
          .eq('user_id', schedule.user_id)
          .eq('schedule_id', schedule.id)
          .eq('dose_time', doseTime)
          .eq('sent_date', localDateStr)
          .maybeSingle();

        if (existing) {
          skippedCount++;
          continue;
        }

        // 3. Get push subscriptions for this user
        const { data: subs } = await supabase
          .from('push_subscriptions')
          .select('endpoint, p256dh, auth')
          .eq('user_id', schedule.user_id);

        if (!subs || subs.length === 0) continue;

        // 4. Send push to each device
        const payload = {
          title: `Time to take ${schedule.name}`,
          body: `${schedule.dosage} \u2014 scheduled for ${formatTime12(doseTime)}`,
          icon: '/icon-192.png',
          badge: '/icon-96.png',
          tag: `med-${schedule.id}-${doseTime}`,
          data: { url: '/' },
        };

        let anySent = false;
        for (const sub of subs) {
          const ok = await sendPushNotification(sub, payload);
          if (ok) anySent = true;

          // Clean up expired subscriptions
          if (!ok) {
            await supabase
              .from('push_subscriptions')
              .delete()
              .eq('endpoint', sub.endpoint)
              .eq('user_id', schedule.user_id);
          }
        }

        // 5. Mark as sent
        if (anySent) {
          await supabase.from('sent_notifications').insert({
            user_id: schedule.user_id,
            schedule_id: schedule.id,
            dose_time: doseTime,
            sent_date: localDateStr,
          });
          sentCount++;
        }
      }
    }

    // 6. Cleanup old sent_notifications
    await supabase.rpc('cleanup_old_notifications');

    return Response.json({ sent: sentCount, skipped: skippedCount });
  } catch (err) {
    console.error('Edge function error:', err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
