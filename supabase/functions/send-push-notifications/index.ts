import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ── Environment ──────────────────────────────────────────────────────────────
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!;
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!;
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:noreply@symtrack.netlify.app';

// ── Time helpers ─────────────────────────────────────────────────────────────
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

function isWithinWindow(current: number, target: number, window: number): boolean {
  let diff = Math.abs(current - target);
  if (diff > 720) diff = 1440 - diff;
  return diff <= window;
}

// Supplement time window definitions (must match client-side SUPPLEMENT_TIME_WINDOWS)
const SUPPLEMENT_TIME_WINDOWS: Record<string, { start: string; end: string; label: string }> = {
  morning:   { start: '07:00', end: '08:00', label: 'Morning' },
  breakfast: { start: '08:00', end: '09:00', label: 'Breakfast' },
  lunch:     { start: '12:00', end: '14:00', label: 'Lunch' },
  dinner:    { start: '18:00', end: '20:00', label: 'Dinner' },
  bed:       { start: '21:00', end: '23:00', label: 'Before Bed' },
};

// ── Uint8Array utilities ─────────────────────────────────────────────────────
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

function concat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((s, a) => s + a.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const arr of arrays) { result.set(arr, offset); offset += arr.length; }
  return result;
}

// ── HKDF (RFC 5869) ──────────────────────────────────────────────────────────
async function hkdfExtract(salt: Uint8Array, ikm: Uint8Array): Promise<Uint8Array> {
  const saltKey = await crypto.subtle.importKey('raw', salt, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', saltKey, ikm));
}

async function hkdfExpand(prk: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const prkKey = await crypto.subtle.importKey('raw', prk, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const result = new Uint8Array(length);
  let t = new Uint8Array(0);
  let offset = 0;
  let counter = 1;
  while (offset < length) {
    const data = concat(t, info, new Uint8Array([counter++]));
    t = new Uint8Array(await crypto.subtle.sign('HMAC', prkKey, data));
    const toCopy = Math.min(t.length, length - offset);
    result.set(t.slice(0, toCopy), offset);
    offset += toCopy;
  }
  return result;
}

// ── RFC 8291 payload encryption ───────────────────────────────────────────────
async function encryptPayload(
  p256dhBase64url: string,
  authBase64url: string,
  plaintext: string,
): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const clientPublicKeyBytes = base64urlToUint8Array(p256dhBase64url);
  const authSecret = base64urlToUint8Array(authBase64url);
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // Generate ephemeral sender key pair
  const senderKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']
  );
  const senderPublicKeyBuffer = await crypto.subtle.exportKey('raw', senderKeyPair.publicKey);
  const senderPublicKey = new Uint8Array(senderPublicKeyBuffer); // 65 bytes uncompressed

  // Import client public key for ECDH
  const clientPublicKey = await crypto.subtle.importKey(
    'raw', clientPublicKeyBytes, { name: 'ECDH', namedCurve: 'P-256' }, false, []
  );

  // ECDH shared secret
  const ecdhBits = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: clientPublicKey }, senderKeyPair.privateKey, 256
  );

  // RFC 8291 §3.3: IKM derivation
  const prkKey = await hkdfExtract(authSecret, new Uint8Array(ecdhBits));
  const keyInfo = concat(enc.encode('WebPush: info\0'), clientPublicKeyBytes, senderPublicKey);
  const ikm = await hkdfExpand(prkKey, keyInfo, 32);

  // Content encryption key + nonce
  const prk = await hkdfExtract(salt, ikm);
  const cek = await hkdfExpand(prk, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdfExpand(prk, enc.encode('Content-Encoding: nonce\0'), 12);

  // AES-128-GCM encrypt (padding: append 0x02 delimiter byte)
  const aesKey = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM', length: 128 }, false, ['encrypt']);
  const plaintextBytes = enc.encode(plaintext);
  const paddedPlaintext = concat(plaintextBytes, new Uint8Array([0x02]));
  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce, tagLength: 128 }, aesKey, paddedPlaintext
  );

  // Build aes128gcm body: salt(16) | rs(4 BE) | keylen(1) | senderPubKey(65) | ciphertext
  const rs = 4096;
  const header = new Uint8Array(21 + senderPublicKey.length);
  header.set(salt, 0);
  header[16] = (rs >> 24) & 0xff;
  header[17] = (rs >> 16) & 0xff;
  header[18] = (rs >> 8) & 0xff;
  header[19] = rs & 0xff;
  header[20] = senderPublicKey.length; // = 65
  header.set(senderPublicKey, 21);

  return concat(header, new Uint8Array(ciphertextBuffer));
}

// ── VAPID JWT (RFC 8292) ──────────────────────────────────────────────────────
async function importVapidPrivateKey(rawBase64url: string): Promise<CryptoKey> {
  // Wrap raw 32-byte P-256 private key in minimal PKCS8 DER (no public key)
  const PKCS8_PREFIX = new Uint8Array([
    0x30, 0x41, 0x02, 0x01, 0x00, 0x30, 0x13, 0x06,
    0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01,
    0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03,
    0x01, 0x07, 0x04, 0x27, 0x30, 0x25, 0x02, 0x01,
    0x01, 0x04, 0x20,
  ]);
  const rawKey = base64urlToUint8Array(rawBase64url);
  const pkcs8 = concat(PKCS8_PREFIX, rawKey);
  return await crypto.subtle.importKey(
    'pkcs8', pkcs8.buffer,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false, ['sign']
  );
}

async function createVapidJwt(audience: string): Promise<string> {
  const enc = new TextEncoder();
  const header = { typ: 'JWT', alg: 'ES256' };
  const now = Math.floor(Date.now() / 1000);
  const payload = { aud: audience, exp: now + 43200, sub: VAPID_SUBJECT };

  const h = uint8ArrayToBase64url(enc.encode(JSON.stringify(header)));
  const p = uint8ArrayToBase64url(enc.encode(JSON.stringify(payload)));
  const unsigned = `${h}.${p}`;

  const key = await importVapidPrivateKey(VAPID_PRIVATE_KEY);
  const sig = new Uint8Array(await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(unsigned)
  ));

  return `${unsigned}.${uint8ArrayToBase64url(sig)}`;
}

// ── Send one push notification ────────────────────────────────────────────────
async function sendPush(
  sub: { endpoint: string; p256dh: string; auth: string },
  payload: object,
): Promise<boolean> {
  try {
    const url = new URL(sub.endpoint);
    const audience = `${url.protocol}//${url.host}`;
    const jwt = await createVapidJwt(audience);

    const body = await encryptPayload(sub.p256dh, sub.auth, JSON.stringify(payload));

    const res = await fetch(sub.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Encoding': 'aes128gcm',
        'TTL': '86400',
        'Urgency': 'normal',
        'Authorization': `vapid t=${jwt},k=${VAPID_PUBLIC_KEY}`,
      },
      body,
    });

    if (res.status === 201 || res.status === 200) return true;
    if (res.status === 404 || res.status === 410) return false; // expired
    console.error(`Push failed ${res.status}:`, await res.text().catch(() => ''));
    return false;
  } catch (err) {
    console.error('sendPush error:', err);
    return false;
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────
Deno.serve(async () => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  let sent = 0, skipped = 0;

  // ── 1. Medication schedules ────────────────────────────────────────────────
  const { data: medSchedules } = await supabase
    .from('medication_schedules')
    .select('id, user_id, name, dosage, dose_times, reminder_window_minutes, timezone')
    .eq('status', 'active')
    .eq('notifications_enabled', true);

  for (const sched of medSchedules ?? []) {
    const tz = sched.timezone ?? 'UTC';
    const nowInTz = new Date(new Date().toLocaleString('en-US', { timeZone: tz }));
    const currentMins = nowInTz.getHours() * 60 + nowInTz.getMinutes();
    const localDate = nowInTz.toISOString().slice(0, 10);
    const window = sched.reminder_window_minutes ?? 2;

    for (const doseTime of (sched.dose_times as string[])) {
      if (!isWithinWindow(currentMins, timeToMinutes(doseTime), window)) continue;

      const { data: existing } = await supabase
        .from('sent_notifications')
        .select('id')
        .eq('user_id', sched.user_id)
        .eq('schedule_id', sched.id)
        .eq('dose_time', doseTime)
        .eq('sent_date', localDate)
        .maybeSingle();

      if (existing) { skipped++; continue; }

      const { data: subs } = await supabase
        .from('push_subscriptions')
        .select('endpoint, p256dh, auth')
        .eq('user_id', sched.user_id);

      if (!subs?.length) continue;

      const payload = {
        title: `Time to take ${sched.name}`,
        body: `${sched.dosage} — scheduled for ${formatTime12(doseTime)}`,
        icon: '/icon-192.png',
        badge: '/icon-96.png',
        tag: `med-${sched.id}-${doseTime}`,
        data: { url: '/' },
      };

      let anySent = false;
      for (const sub of subs) {
        const ok = await sendPush(sub, payload);
        if (ok) anySent = true;
        else {
          await supabase.from('push_subscriptions')
            .delete().eq('user_id', sched.user_id).eq('endpoint', sub.endpoint);
        }
      }

      if (anySent) {
        await supabase.from('sent_notifications').insert({
          user_id: sched.user_id, schedule_id: sched.id,
          dose_time: doseTime, sent_date: localDate,
        });
        sent++;
      }
    }
  }

  // ── 2. Supplement schedules ────────────────────────────────────────────────
  const { data: suppSchedules } = await supabase
    .from('supplement_schedules')
    .select('id, user_id, name, quantity, time_window, reminder_time, reminder_window_minutes, timezone')
    .eq('status', 'active')
    .eq('notifications_enabled', true);

  const PRE_WINDOW_MINS = 15;

  for (const sched of suppSchedules ?? []) {
    const tz = sched.timezone ?? 'UTC';
    const nowInTz = new Date(new Date().toLocaleString('en-US', { timeZone: tz }));
    const currentMins = nowInTz.getHours() * 60 + nowInTz.getMinutes();
    const localDate = nowInTz.toISOString().slice(0, 10);
    const window = sched.reminder_window_minutes ?? 2;

    // Determine what time to notify
    let notifyTime: string | null = null;
    let notifyType: 'pre' | 'due' | 'overdue' = 'due';
    let windowLabel = 'Daily';

    if (sched.time_window && SUPPLEMENT_TIME_WINDOWS[sched.time_window]) {
      const tw = SUPPLEMENT_TIME_WINDOWS[sched.time_window];
      windowLabel = tw.label;
      const startMins = timeToMinutes(tw.start);
      const endMins = timeToMinutes(tw.end);

      if (currentMins >= startMins - PRE_WINDOW_MINS && currentMins < startMins) {
        notifyTime = tw.start;
        notifyType = 'pre';
      } else if (isWithinWindow(currentMins, startMins, window)) {
        notifyTime = tw.start;
        notifyType = 'due';
      } else if (currentMins > startMins && currentMins <= endMins) {
        const overdueSlot = Math.floor((currentMins - startMins) / 30);
        if (overdueSlot >= 1) {
          const overdueTimeMins = startMins + overdueSlot * 30;
          notifyTime = `${String(Math.floor(overdueTimeMins / 60)).padStart(2, '0')}:${String(overdueTimeMins % 60).padStart(2, '0')}`;
          notifyType = 'overdue';
        }
      }
    } else if (sched.reminder_time) {
      if (isWithinWindow(currentMins, timeToMinutes(sched.reminder_time), window)) {
        notifyTime = sched.reminder_time;
        notifyType = 'due';
      }
    }

    if (!notifyTime) continue;

    const dedupKey = `sup-${notifyType}`;
    const { data: existing } = await supabase
      .from('sent_notifications')
      .select('id')
      .eq('user_id', sched.user_id)
      .eq('schedule_id', sched.id)
      .eq('dose_time', `${dedupKey}-${notifyTime}`)
      .eq('sent_date', localDate)
      .maybeSingle();

    if (existing) { skipped++; continue; }

    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', sched.user_id);

    if (!subs?.length) continue;

    const titleMap = {
      pre: `${sched.name} coming up`,
      due: `Time to take ${sched.name}`,
      overdue: `⚠️ ${sched.name} overdue`,
    };
    const bodyMap = {
      pre: `${windowLabel} window starts soon${sched.quantity ? ` — ${sched.quantity}` : ''}`,
      due: `${windowLabel}${sched.quantity ? ` — ${sched.quantity}` : ''}`,
      overdue: `${windowLabel} — still not taken${sched.quantity ? ` (${sched.quantity})` : ''}`,
    };

    const payload = {
      title: titleMap[notifyType],
      body: bodyMap[notifyType],
      icon: '/icon-192.png',
      badge: '/icon-96.png',
      tag: `sup-${sched.id}-${notifyType}`,
      data: { url: '/' },
    };

    let anySent = false;
    for (const sub of subs) {
      const ok = await sendPush(sub, payload);
      if (ok) anySent = true;
      else {
        await supabase.from('push_subscriptions')
          .delete().eq('user_id', sched.user_id).eq('endpoint', sub.endpoint);
      }
    }

    if (anySent) {
      await supabase.from('sent_notifications').insert({
        user_id: sched.user_id, schedule_id: sched.id,
        dose_time: `${dedupKey}-${notifyTime}`, sent_date: localDate,
      });
      sent++;
    }
  }

  // Cleanup old dedup records
  await supabase.rpc('cleanup_old_notifications').maybeSingle().catch(() => null);

  return Response.json({ sent, skipped });
});
