import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { getWebhookDeliveryUrl } from "@/lib/app-url";

/**
 * Repairs webhook delivery URLs across all stores (or a single client/store).
 * PUTs the current app URL to each WooCommerce webhook via its API.
 * Use after domain change or env migration.
 *
 * Body: { clientId?: string, storeId?: string }
 * Scope: admin only (uses service role client)
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { clientId, storeId } = (req.body || {}) as { clientId?: string; storeId?: string };

  try {
    let storesQuery = supabaseAdmin.from("stores").select("*");
    if (storeId) storesQuery = storesQuery.eq("id", storeId);
    else if (clientId) storesQuery = storesQuery.eq("client_id", clientId);

    const { data: stores, error: storesErr } = await storesQuery;
    if (storesErr) throw storesErr;
    if (!stores || stores.length === 0) {
      return res.status(200).json({ updated: 0, failed: 0, stores: 0, message: "No stores found" });
    }

    let updated = 0;
    let failed = 0;
    const results: Array<{ store_id: string; topic: string; success: boolean; error?: string }> = [];

    for (const store of stores) {
      if (!store.consumer_key || !store.consumer_secret || !store.url) continue;

      const newDeliveryUrl = getWebhookDeliveryUrl(store.id, req);
      const authHeader = `Basic ${Buffer.from(`${store.consumer_key}:${store.consumer_secret}`).toString("base64")}`;

      const { data: webhooks } = await supabaseAdmin
        .from("webhooks")
        .select("*")
        .eq("store_id", store.id);

      for (const wh of webhooks || []) {
        if (!wh.woo_webhook_id) {
          results.push({ store_id: store.id, topic: wh.topic, success: false, error: "no woo_webhook_id" });
          failed++;
          continue;
        }
        try {
          const resp = await fetch(`${store.url}/wp-json/wc/v3/webhooks/${wh.woo_webhook_id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", Authorization: authHeader },
            body: JSON.stringify({ delivery_url: newDeliveryUrl }),
          });
          if (!resp.ok) {
            const text = await resp.text();
            results.push({ store_id: store.id, topic: wh.topic, success: false, error: text.slice(0, 200) });
            failed++;
            continue;
          }
          await supabaseAdmin
            .from("webhooks")
            .update({ delivery_url: newDeliveryUrl, updated_at: new Date().toISOString() })
            .eq("id", wh.id);
          results.push({ store_id: store.id, topic: wh.topic, success: true });
          updated++;
        } catch (e) {
          results.push({ store_id: store.id, topic: wh.topic, success: false, error: String(e).slice(0, 200) });
          failed++;
        }
      }
    }

    return res.status(200).json({
      updated,
      failed,
      stores: stores.length,
      new_url_sample: getWebhookDeliveryUrl(stores[0].id, req),
      results,
    });
  } catch (error) {
    console.error("repair-all webhooks error:", error);
    return res.status(500).json({ error: String(error) });
  }
}