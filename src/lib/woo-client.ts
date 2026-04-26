import { supabaseAdmin } from "@/integrations/supabase/admin";
import {
  WOO_USER_AGENT,
  WooApiError,
  detectBlockingService,
} from "./sync-error";

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
      throw new WooApiError(`Request timeout (${timeoutMs}ms)`, {
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
    const bodySnippet = text.slice(0, 2000);
    const detection = detectBlockingService(res.status, bodySnippet, res.headers);
    let wooMessage = "";
    let wooCode = "";
    try {
      const parsed = JSON.parse(text) as { message?: string; code?: string; data?: { params?: Record<string, string> } };
      if (parsed?.message) wooMessage = parsed.message;
      if (parsed?.code) wooCode = parsed.code;
      if (parsed?.data?.params) {
        const params = Object.entries(parsed.data.params).map(([k, v]) => `${k}: ${v}`).join("; ");
        if (params) wooMessage = wooMessage ? `${wooMessage} — ${params}` : params;
      }
    } catch { /* not JSON */ }
    const detail = wooMessage || bodySnippet.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 240);
    const tag = detection ? ` [${detection.service}]` : wooCode ? ` [${wooCode}]` : "";
    throw new WooApiError(
      `WooCommerce ${method} ${endpoint} → ${res.status}${tag}: ${detail || "no body"}`,
      {
        url,
        method,
        status: res.status,
        body: bodySnippet.slice(0, 600),
        blocking_service: detection?.service,
        blocking_hint: detection?.hint,
      }
    );
  }
  return (await res.json()) as T;
}