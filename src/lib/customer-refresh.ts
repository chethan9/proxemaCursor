import { supabaseAdmin } from "@/integrations/supabase/admin";
import { getStoreCreds, wooRequest } from "@/lib/woo-client";
import type { Json } from "@/integrations/supabase/database.types";

const FRESH_WINDOW_MS = 5 * 60 * 1000;

interface WooCustomer {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  username: string;
  role: string;
  billing: Record<string, unknown>;
  shipping: Record<string, unknown>;
  avatar_url: string;
  date_created: string;
  date_modified: string;
  orders_count?: number;
  total_spent?: string;
}

function toJson<T>(v: T): Json {
  return JSON.parse(JSON.stringify(v)) as Json;
}

/**
 * Fetches the customer fresh from WooCommerce and upserts into our mirror.
 * Skips if the row was synced within the last 5 minutes.
 * Never throws — failures are logged and swallowed so the calling order
 * update is unaffected.
 */
export async function refreshCustomerForOrder(
  storeId: string,
  wooCustomerId: number | null | undefined,
): Promise<{ refreshed: boolean; reason?: string }> {
  try {
    if (!wooCustomerId || wooCustomerId <= 0) {
      return { refreshed: false, reason: "guest_or_no_customer" };
    }

    const { data: existing } = await supabaseAdmin
      .from("customers")
      .select("id, synced_at")
      .eq("store_id", storeId)
      .eq("woo_id", wooCustomerId)
      .maybeSingle();

    if (existing?.synced_at) {
      const age = Date.now() - new Date(existing.synced_at).getTime();
      if (age < FRESH_WINDOW_MS) {
        return { refreshed: false, reason: "fresh" };
      }
    }

    const creds = await getStoreCreds(storeId);
    if (!creds) return { refreshed: false, reason: "no_creds" };

    const wc = await wooRequest<WooCustomer>(creds, "GET", `customers/${wooCustomerId}`);

    const row = {
      store_id: storeId,
      woo_id: wc.id,
      email: wc.email ?? null,
      first_name: wc.first_name ?? null,
      last_name: wc.last_name ?? null,
      username: wc.username ?? null,
      role: wc.role ?? null,
      billing: toJson(wc.billing ?? {}),
      shipping: toJson(wc.shipping ?? {}),
      avatar_url: wc.avatar_url ?? null,
      orders_count: wc.orders_count ?? 0,
      total_spent: wc.total_spent ? Number(wc.total_spent) : 0,
      date_created: wc.date_created ?? null,
      raw_data: toJson(wc),
      synced_at: new Date().toISOString(),
    };

    const { error: upErr } = await supabaseAdmin
      .from("customers")
      .upsert(row, { onConflict: "store_id,woo_id" });

    if (upErr) {
      console.warn("[refreshCustomerForOrder] upsert failed:", upErr.message);
      return { refreshed: false, reason: "upsert_error" };
    }

    return { refreshed: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    console.warn(`[refreshCustomerForOrder] storeId=${storeId} customerId=${wooCustomerId}: ${msg}`);
    return { refreshed: false, reason: "fetch_error" };
  }
}