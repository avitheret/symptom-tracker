/**
 * Push notification utilities — Web Push API helpers for subscribe / save.
 */

// ── VAPID public key (frontend-safe) ──────────────────────────────────────────

export const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined
  ?? 'BAHfAW9v1rhh5q06dfw0EtPuBMvQtgnj_9dhC675RvcFW01ngmg440moqpxmC8PMXlLCCi6wyuhsEQP0KjTQoOU';

// ── Feature detection ─────────────────────────────────────────────────────────

export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export function isIosDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    // iPad with desktop UA (iPadOS 13+)
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

export function isIosStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    'standalone' in window.navigator &&
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}

export function getPushPermission(): NotificationPermission | 'unsupported' {
  if (!isPushSupported()) return 'unsupported';
  return Notification.permission;
}

// ── Subscribe ─────────────────────────────────────────────────────────────────

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    output[i] = rawData.charCodeAt(i);
  }
  return output;
}

/**
 * Request permission + subscribe to push. Returns the PushSubscription or null
 * if permission was denied or an error occurred.
 */
export async function subscribeToPush(vapidPublicKey: string): Promise<PushSubscription | null> {
  if (!isPushSupported()) throw new Error('Push notifications are not supported on this device.');

  const reg = await navigator.serviceWorker.ready;

  // Re-use an existing subscription if already subscribed
  const existing = await reg.pushManager.getSubscription();
  if (existing) return existing;

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return null;

  // Cast needed because TypeScript's Uint8Array.buffer is typed as ArrayBufferLike
  // but applicationServerKey expects ArrayBuffer | string.
  return reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey).buffer as ArrayBuffer,
  });
}

// ── Save subscription to server ──────────────────────────────────────────────

/**
 * POST the push subscription to the Netlify function which stores it in
 * the `push_subscriptions` Supabase table.
 */
export async function savePushSubscription(
  sub: PushSubscription,
  jwt: string,
  utcOffsetMinutes: number,
): Promise<void> {
  await fetch('/.netlify/functions/save-push-subscription', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
    },
    body: JSON.stringify({
      subscription: sub.toJSON(),
      utcOffsetMinutes,
    }),
  });
}
