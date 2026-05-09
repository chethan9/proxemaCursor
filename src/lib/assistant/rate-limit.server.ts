/**
 * Simple in-memory rate limiter (per Node process). On serverless, instances are independent — acceptable MVP guardrail.
 */
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 40;

type Bucket = { windowStart: number; count: number };

const buckets = new Map<string, Bucket>();

export function checkAssistantRateLimit(userId: string): { ok: true } | { ok: false; retryAfterMs: number } {
  const now = Date.now();
  const key = userId;
  let b = buckets.get(key);
  if (!b || now - b.windowStart >= WINDOW_MS) {
    b = { windowStart: now, count: 0 };
    buckets.set(key, b);
  }
  if (b.count >= MAX_PER_WINDOW) {
    const retryAfterMs = WINDOW_MS - (now - b.windowStart);
    return { ok: false, retryAfterMs: Math.max(retryAfterMs, 1000) };
  }
  b.count += 1;
  return { ok: true };
}
