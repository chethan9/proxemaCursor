import { supabaseAdmin } from "@/integrations/supabase/admin";
import { WOO_USER_AGENT, WooApiError, detectBlockingService } from "./sync-error";

export interface WooStoreCreds {
  id: string;
  url: string;
  consumer_key: string;
  consumer_secret: string;
}

export async function getStoreCreds(storeId: string): Promise<WooStoreCreds | null> {
  const { data, error } = await supabaseAdmin
    .from("stores")
    .select("id, url, consumer_key, consumer_secret")
    .eq("id", storeId)
    .single();
  if (error || !data) return null;
  if (!data.consumer_key || !data.consumer_secret) return null;
  return data as WooStoreCreds;
}

/**
 * Shared low-level HTTP request for outbound WooCommerce / WordPress calls.
 * Every outbound request to a customer's site should route through this helper
 * (or at minimum include WOO_USER_AGENT) so that:
 *   1. We carry a branded, allowlistable User-Agent
 *   2. Response bodies on non-OK statuses can be classified by detectBlockingService
 */
export async function wooHttpRequest(
  url: string,
  init: RequestInit = {},
  timeoutMs = 30000
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const headers = new Headers(init.headers || {});
  headers.set("User-Agent", WOO_USER_AGENT);
  if (!headers.has("Accept")) headers.set("Accept", "application/json");

  try {
    const res = await fetch(url, { ...init, headers, signal: controller.signal });
    clearTimeout(timeout);
    return res;
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === "AbortError") {
      throw new WooApiError(`WooCommerce request timeout (${timeoutMs}ms): ${url}`, {
        url,
        method: (init.method as string) || "GET",
      });
    }
    throw err;
  }
}

export async function wooRequest<T>(
  store: WooStoreCreds,
  method: "GET" | "POST" | "PUT" | "DELETE",
  endpoint: string,
  body?: Record<string, unknown>
): Promise<T> {
  const auth = Buffer.from(`${store.consumer_key}:${store.consumer_secret}`).toString("base64");
  const url = `${store.url.replace(/\/$/, "")}/wp-json/wc/v3/${endpoint}`;

  const res = await wooHttpRequest(url, {
    method,
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    const detection = detectBlockingService(res.status, text, res.headers);
    const headersObj: Record<string, string> = {};
    res.headers.forEach((v, k) => {
      headersObj[k] = v;
    });
    throw new WooApiError(
      `WooCommerce ${method} ${endpoint} failed: ${res.status} ${text.slice(0, 300)}`,
      {
        url,
        method,
        status: res.status,
        body: text.slice(0, 2000),
        headers: headersObj,
        blocking_service: detection?.service,
        blocking_hint: detection?.hint,
      }
    );
  }
  return (await res.json()) as T;
}