import type { Context } from '@netlify/functions';

/**
 * POST /.netlify/functions/save-push-subscription
 * Body: { subscription: PushSubscriptionJSON, utcOffsetMinutes: number }
 * Authorization: Bearer <supabase-jwt>
 *
 * Upserts the subscription into push_subscriptions (keyed by endpoint).
 */
export default async function handler(req: Request, _context: Context) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  const supabaseUrl    = process.env.SUPABASE_URL;
  const serviceKey     = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error('[save-push-subscription] Missing env vars');
    return Response.json({ error: 'Server misconfiguration' }, { status: 500 });
  }

  // ── Extract user from JWT ──────────────────────────────────────────────────
  const authHeader = req.headers.get('Authorization') ?? '';
  const jwt = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (!jwt) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Use Supabase /auth/v1/user to resolve the JWT → user_id
  const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${jwt}`,
    },
  });

  if (!userRes.ok) {
    return Response.json({ error: 'Invalid token' }, { status: 401 });
  }

  const { id: userId } = (await userRes.json()) as { id: string };

  // ── Parse body ─────────────────────────────────────────────────────────────
  let subscription: { endpoint: string; keys: { p256dh: string; auth: string } };
  let utcOffsetMinutes: number;

  try {
    const body = await req.json() as {
      subscription: typeof subscription;
      utcOffsetMinutes: number;
    };
    subscription      = body.subscription;
    utcOffsetMinutes  = body.utcOffsetMinutes ?? 0;
  } catch {
    return Response.json({ error: 'Invalid body' }, { status: 400 });
  }

  if (!subscription?.endpoint) {
    return Response.json({ error: 'Missing subscription endpoint' }, { status: 400 });
  }

  // ── Upsert into push_subscriptions ────────────────────────────────────────
  const base = `${supabaseUrl}/rest/v1`;
  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
    Prefer: 'resolution=merge-duplicates',
  };

  const upsertRes = await fetch(`${base}/push_subscriptions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      user_id:             userId,
      subscription,
      utc_offset_minutes:  utcOffsetMinutes,
      updated_at:          new Date().toISOString(),
    }),
  });

  if (!upsertRes.ok) {
    const err = await upsertRes.text();
    console.error('[save-push-subscription] upsert failed:', err);
    return Response.json({ error: 'Failed to save subscription' }, { status: 500 });
  }

  return Response.json({ ok: true }, {
    status: 200,
    headers: { 'Access-Control-Allow-Origin': '*' },
  });
}
