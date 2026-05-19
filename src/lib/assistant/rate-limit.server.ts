/**
 * Assistant chat rate limit: prefer Upstash (distributed) when configured; otherwise in-memory per instance.
 */
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 40;

type Bucket = { windowStart: number; count: number };

const buckets = new Map<string, Bucket>();

let assistantRatelimit: Ratelimit | null = null;

function getUpstashAssistantLimiter(): Ratelimit | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  if (!assistantRatelimit) {
    assistantRatelimit = new Ratelimit({
      redis: new Redis({ url, token }),
      limiter: Ratelimit.slidingWindow(MAX_PER_WINDOW, `${WINDOW_MS / 1000} s`),
      prefix: "assistant-chat",
    });
  }
  return assistantRatelimit;
}

export async function checkAssistantRateLimit(
  userId: string,
): Promise<{ ok: true } | { ok: false; retryAfterMs: number }> {
  const upstash = getUpstashAssistantLimiter();
  if (upstash) {
    const out = await upstash.limit(userId);
    if (out.pending) {
      try {
        await out.pending;
      } catch {
        /* noop */
      }
    }
    if (!out.success) {
      const retryAfterMs = Math.max(out.reset - Date.now(), 1000);
      return { ok: false, retryAfterMs };
    }
    return { ok: true };
  }

  const now = Date.now();
  let b = buckets.get(userId);
  if (!b || now - b.windowStart >= WINDOW_MS) {
    b = { windowStart: now, count: 0 };
    buckets.set(userId, b);
  }
  if (b.count >= MAX_PER_WINDOW) {
    const retryAfterMs = WINDOW_MS - (now - b.windowStart);
    return { ok: false, retryAfterMs: Math.max(retryAfterMs, 1000) };
  }
  b.count += 1;
  return { ok: true };
}
