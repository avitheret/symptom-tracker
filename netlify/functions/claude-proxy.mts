import type { Context } from "@netlify/functions";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MAX_TOKENS_LIMIT = 1024;
const ALLOWED_MODELS = [
  "claude-haiku-4-5-20251001",
  "claude-sonnet-4-6",
  "claude-opus-4-6",
  // legacy aliases kept for compatibility
  "claude-sonnet-4-20250514",
];

// Simple in-memory rate limiter (resets on cold start)
const rateLimits = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 30; // requests per window
const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimits.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimits.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

export default async function handler(req: Request, context: Context) {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const apiKey = Netlify.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return Response.json(
      { error: "API key not configured on server" },
      { status: 500 }
    );
  }

  // Rate limit by IP
  const clientIp = context.ip ?? "unknown";
  if (!checkRateLimit(clientIp)) {
    return Response.json(
      { error: "Rate limited. Please try again later." },
      { status: 429 }
    );
  }

  try {
    const body = await req.json();

    if (!body.messages || !Array.isArray(body.messages)) {
      return Response.json({ error: "Invalid request" }, { status: 400 });
    }

    const model = ALLOWED_MODELS.includes(body.model)
      ? body.model
      : ALLOWED_MODELS[0]; // default to haiku (fastest/cheapest)
    const maxTokens = Math.min(body.max_tokens ?? 512, MAX_TOKENS_LIMIT);

    const response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        ...(body.system ? { system: body.system } : {}),
        messages: body.messages,
      }),
    });

    const data = await response.text();

    return new Response(data, {
      status: response.status,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    return Response.json(
      {
        error: `Proxy error: ${err instanceof Error ? err.message : "Unknown error"}`,
      },
      { status: 500 }
    );
  }
}
