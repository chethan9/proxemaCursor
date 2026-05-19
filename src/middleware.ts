import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { API_RATE_LIMIT_EXCLUDED_PREFIXES } from "@/lib/api-rate-limit-config";

/**
 * Global API rate limiting when Upstash env vars are set.
 * Anonymous requests (no Bearer): stricter. Requests with Authorization: Bearer: higher ceiling.
 * Cron, payment webhooks, build-info, i18n are excluded (they use their own auth or static payloads).
 */
export const config = {
  matcher: "/api/:path*",
};

function isExcluded(pathname: string): boolean {
  if (pathname === "/api/build-info") return true;
  return API_RATE_LIMIT_EXCLUDED_PREFIXES.some((p) => pathname.startsWith(p));
}

let anonLimiter: Ratelimit | null = null;
let authLimiter: Ratelimit | null = null;

function getLimiters(): { anon: Ratelimit; auth: Ratelimit } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  if (!anonLimiter || !authLimiter) {
    const redis = new Redis({ url, token });
    anonLimiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(120, "1 m"),
      prefix: "proxima-api-anon",
    });
    authLimiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(600, "1 m"),
      prefix: "proxima-api-auth",
    });
  }
  return { anon: anonLimiter, auth: authLimiter };
}

function clientIp(req: NextRequest): string {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0]!.trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}

export default async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  if (!pathname.startsWith("/api/") || isExcluded(pathname)) {
    return NextResponse.next();
  }

  const limiters = getLimiters();
  if (!limiters) {
    return NextResponse.next();
  }

  const hasBearer = !!request.headers.get("authorization")?.startsWith("Bearer ");
  const limiter = hasBearer ? limiters.auth : limiters.anon;
  const id = `${hasBearer ? "a" : "u"}:${clientIp(request)}`;
  const out = await limiter.limit(id);
  if (out.pending) {
    try {
      await out.pending;
    } catch {
      /* analytics fire-and-forget */
    }
  }
  const { success, limit, reset, remaining } = out;

  if (!success) {
    const retrySec = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
    return new NextResponse(JSON.stringify({ error: "Too many requests", code: "RATE_LIMIT" }), {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retrySec),
        "X-RateLimit-Limit": String(limit),
        "X-RateLimit-Remaining": String(remaining ?? 0),
      },
    });
  }

  const res = NextResponse.next();
  res.headers.set("X-RateLimit-Remaining", String(remaining ?? 0));
  return res;
}
