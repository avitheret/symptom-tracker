import type { Context } from '@netlify/functions';

/**
 * POST /.netlify/functions/log-healthkit
 *
 * Receives health metrics from an iOS Shortcut and upserts them into
 * the health_metrics Supabase table.
 *
 * Body:
 *   {
 *     token   : string,              // API key from HealthKit setup
 *     date    : string,              // YYYY-MM-DD  (local date on device)
 *     metrics : Array<{
 *       type  : string,              // sleep_hours | resting_hr | steps | hrv | systolic_bp | diastolic_bp
 *       value : number,
 *       unit  : string               // e.g. "hours", "bpm", "count", "ms", "mmHg"
 *     }>
 *   }
 *
 * Returns 200 { ok: true, inserted: N } on success.
 */

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

interface MetricInput {
  type:  string;
  value: number;
  unit?: string;
}

interface RequestBody {
  token:   string;
  date:    string;
  metrics: MetricInput[];
}

export default async function handler(req: Request, _ctx: Context) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405, headers: CORS });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error('[log-healthkit] Missing env vars');
    return Response.json({ error: 'Server misconfiguration' }, { status: 500, headers: CORS });
  }

  // ── Parse body ─────────────────────────────────────────────────────────────
  let body: RequestBody;
  try {
    body = await req.json() as RequestBody;
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400, headers: CORS });
  }

  const { token, date, metrics } = body;

  if (!token || typeof token !== 'string' || token.length < 10) {
    return Response.json({ error: 'Missing or invalid token' }, { status: 401, headers: CORS });
  }
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return Response.json({ error: 'Invalid date — expected YYYY-MM-DD' }, { status: 400, headers: CORS });
  }
  if (!Array.isArray(metrics) || metrics.length === 0) {
    return Response.json({ error: 'No metrics provided' }, { status: 400, headers: CORS });
  }

  const base        = `${supabaseUrl}/rest/v1`;
  const svcHeaders  = {
    apikey:          serviceKey,
    Authorization:   `Bearer ${serviceKey}`,
    'Content-Type':  'application/json',
  };

  // ── Resolve token → user_id ────────────────────────────────────────────────
  const tokenRes = await fetch(
    `${base}/healthkit_tokens?token=eq.${encodeURIComponent(token)}&select=user_id&limit=1`,
    { headers: svcHeaders }
  );
  if (!tokenRes.ok) {
    console.error('[log-healthkit] token lookup failed:', await tokenRes.text());
    return Response.json({ error: 'Database error' }, { status: 500, headers: CORS });
  }

  const tokenRows = await tokenRes.json() as Array<{ user_id: string }>;
  if (!Array.isArray(tokenRows) || tokenRows.length === 0) {
    return Response.json({ error: 'Invalid token' }, { status: 401, headers: CORS });
  }

  const userId = tokenRows[0].user_id;

  // ── Validate + build rows ──────────────────────────────────────────────────
  const ALLOWED_TYPES = new Set([
    'sleep_hours', 'resting_hr', 'steps', 'hrv', 'systolic_bp', 'diastolic_bp',
  ]);

  const rows = metrics
    .filter(m =>
      typeof m.type  === 'string' &&
      ALLOWED_TYPES.has(m.type)   &&
      typeof m.value === 'number' &&
      isFinite(m.value)
    )
    .map(m => ({
      user_id: userId,
      date,
      type:    m.type,
      value:   m.value,
      unit:    m.unit ?? '',
      source:  'ios_shortcuts',
    }));

  if (rows.length === 0) {
    return Response.json({ ok: true, inserted: 0 }, { status: 200, headers: CORS });
  }

  // ── Upsert (ON CONFLICT (user_id, date, type) DO UPDATE) ──────────────────
  const upsertRes = await fetch(`${base}/health_metrics`, {
    method:  'POST',
    headers: { ...svcHeaders, Prefer: 'resolution=merge-duplicates' },
    body:    JSON.stringify(rows),
  });

  if (!upsertRes.ok) {
    const err = await upsertRes.text();
    console.error('[log-healthkit] upsert failed:', err);
    return Response.json({ error: 'Failed to store metrics' }, { status: 500, headers: CORS });
  }

  console.log(`[log-healthkit] stored ${rows.length} metric(s) for user ${userId.slice(0, 8)}… on ${date}`);
  return Response.json({ ok: true, inserted: rows.length }, { status: 200, headers: CORS });
}
