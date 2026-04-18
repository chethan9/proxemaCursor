import type { NextApiRequest } from "next";

/**
 * Returns the canonical app base URL (no trailing slash).
 * Priority:
 *  1. NEXT_PUBLIC_APP_URL env var (set per environment)
 *  2. Request host (dev fallback — lets local work without env config)
 *  3. Empty string (throws in callers expecting URL)
 */
export function getAppUrl(req?: NextApiRequest): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  if (req) {
    const proto = (req.headers["x-forwarded-proto"] as string) || "https";
    const host = req.headers.host;
    if (host) return `${proto}://${host}`;
  }
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return "";
}

/**
 * Returns the full delivery URL for a store's incoming webhook endpoint.
 */
export function getWebhookDeliveryUrl(storeId: string, req?: NextApiRequest): string {
  const base = getAppUrl(req);
  if (!base) throw new Error("App URL not configured. Set NEXT_PUBLIC_APP_URL.");
  return `${base}/api/webhooks/incoming/${storeId}`;
}