import { supabaseAdmin } from "@/integrations/supabase/admin";

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

export async function wooRequest<T>(
  store: WooStoreCreds,
  method: "GET" | "POST" | "PUT" | "DELETE",
  endpoint: string,
  body?: Record<string, unknown>
): Promise<T> {
  const auth = Buffer.from(`${store.consumer_key}:${store.consumer_secret}`).toString("base64");
  const url = `${store.url.replace(/\/$/, "")}/wp-json/wc/v3/${endpoint}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`WooCommerce ${method} ${endpoint} failed: ${res.status} ${text.slice(0, 300)}`);
    }
    return (await res.json()) as T;
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`WooCommerce ${method} ${endpoint} timeout (30s)`);
    }
    throw err;
  }
}