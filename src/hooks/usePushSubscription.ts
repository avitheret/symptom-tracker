import { useState, useEffect, useCallback } from 'react';
import { supabase, CLOUD_ENABLED } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

const VAPID_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Convert a base64url-encoded VAPID public key to a Uint8Array for pushManager.subscribe(). */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    arr[i] = raw.charCodeAt(i);
  }
  return arr;
}

function getDeviceLabel(): string {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) return 'iOS';
  if (/Android/.test(ua)) return 'Android';
  if (/Mac/.test(ua)) return 'Mac';
  if (/Win/.test(ua)) return 'Windows';
  if (/Linux/.test(ua)) return 'Linux';
  return 'Unknown';
}

// ── Hook ────────────────────────────────────────────────────────────────────

export function usePushSubscription() {
  const { user } = useAuth();

  const isSupported =
    CLOUD_ENABLED &&
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    !!VAPID_KEY;

  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  // Check existing subscription on mount
  useEffect(() => {
    if (!isSupported) return;

    let cancelled = false;

    (async () => {
      try {
        const registration = await navigator.serviceWorker.ready;
        const existing = await registration.pushManager.getSubscription();
        if (!cancelled) {
          setIsSubscribed(!!existing);
        }
      } catch {
        // Silently ignore — browser may not support or SW not registered
      }
    })();

    return () => { cancelled = true; };
  }, [isSupported]);

  // ── subscribe ─────────────────────────────────────────────────────────────

  const subscribe = useCallback(async () => {
    if (!isSupported || !supabase || !user) return;

    setLoading(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setLoading(false);
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const appServerKey = urlBase64ToUint8Array(VAPID_KEY!);
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: appServerKey.buffer as ArrayBuffer,
      });

      const json = subscription.toJSON();
      const endpoint = json.endpoint!;
      const p256dh = json.keys?.p256dh ?? '';
      const auth = json.keys?.auth ?? '';
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const deviceLabel = getDeviceLabel();

      const { error } = await supabase.from('push_subscriptions').upsert(
        {
          user_id: user.id,
          endpoint,
          p256dh,
          auth,
          timezone,
          device_label: deviceLabel,
        },
        { onConflict: 'user_id,endpoint' },
      );

      if (error) {
        console.error('[usePushSubscription] upsert error:', error);
        alert(`Failed to save push subscription: ${error.message}`);
      } else {
        setIsSubscribed(true);
      }
    } catch (err) {
      console.error('[usePushSubscription] subscribe error:', err);
    } finally {
      setLoading(false);
    }
  }, [isSupported, user]);

  // ── unsubscribe ───────────────────────────────────────────────────────────

  const unsubscribe = useCallback(async () => {
    if (!supabase || !user) return;

    setLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        const endpoint = subscription.endpoint;

        // Remove from Supabase
        const { error } = await supabase
          .from('push_subscriptions')
          .delete()
          .eq('user_id', user.id)
          .eq('endpoint', endpoint);

        if (error) {
          console.error('[usePushSubscription] delete error:', error);
        }

        // Unsubscribe locally
        await subscription.unsubscribe();
      }

      setIsSubscribed(false);
    } catch (err) {
      console.error('[usePushSubscription] unsubscribe error:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  return { isSubscribed, isSupported, loading, subscribe, unsubscribe };
}
