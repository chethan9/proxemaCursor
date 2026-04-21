import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin as supabase } from "@/integrations/supabase/admin";
import { WEBHOOK_TOPICS, generateWebhookSecret } from "@/services/webhookService";
import { getWebhookDeliveryUrl } from "@/lib/app-url";
import { WOO_USER_AGENT } from "@/lib/sync-error";

export const config = { maxDuration: 60 };

async function fetchWithTimeout(url: string, init: RequestInit, ms = 8000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const headers = new Headers(init.headers || {});
    headers.set("User-Agent", WOO_USER_AGENT);
    return await fetch(url, { ...init, headers, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { storeId } = req.query;
  if (!storeId || typeof storeId !== "string") {
    return res.status(400).json({ error: "Store ID required" });
  }

  try {
    const { data: store, error: storeError } = await supabase
      .from("stores")
      .select("*")
      .eq("id", storeId)
      .single();

    if (storeError || !store) return res.status(404).json({ error: "Store not found" });
    if (!store.consumer_key || !store.consumer_secret) {
      return res.status(400).json({ error: "Store not connected - missing API credentials" });
    }

    const deliveryUrl = getWebhookDeliveryUrl(storeId, req);
    const authHeader = `Basic ${Buffer.from(`${store.consumer_key}:${store.consumer_secret}`).toString("base64")}`;

    let wooWebhooks: Array<{ id: number; topic: string; delivery_url: string; status: string }> = [];
    try {
      const listResp = await fetchWithTimeout(`${store.url}/wp-json/wc/v3/webhooks?per_page=100`, {
        headers: { Authorization: authHeader },
      }, 10000);
      if (listResp.ok) wooWebhooks = await listResp.json();
    } catch (e) {
      console.warn("Failed to list existing webhooks:", e);
    }

    const { data: existingLocal } = await supabase
      .from("webhooks")
      .select("*")
      .eq("store_id", storeId);
    const localByTopic = new Map((existingLocal || []).map((w) => [w.topic, w]));

    const registerOne = async ({ topic, name }: { topic: string; name: string }) => {
      const localRow = localByTopic.get(topic);
      const matchingWoo = wooWebhooks.find((w) => w.topic === topic && w.delivery_url === deliveryUrl);
      try {
        if (localRow?.woo_webhook_id && matchingWoo && matchingWoo.id === localRow.woo_webhook_id) {
          if (matchingWoo.status !== "active") {
            const putResp = await fetchWithTimeout(
              `${store.url}/wp-json/wc/v3/webhooks/${matchingWoo.id}`,
              { method: "PUT", headers: { "Content-Type": "application/json", Authorization: authHeader }, body: JSON.stringify({ status: "active" }) },
              8000
            );
            if (putResp.ok) {
              await supabase.from("webhooks").update({ status: "active", updated_at: new Date().toISOString() }).eq("id", localRow.id);
            }
          }
          return { topic, success: true, action: "kept", woo_id: matchingWoo.id };
        }
        if (matchingWoo) {
          await supabase.from("webhooks").upsert(
            { store_id: storeId, topic, woo_webhook_id: matchingWoo.id, delivery_url: deliveryUrl, status: "active", secret: localRow?.secret || generateWebhookSecret() },
            { onConflict: "store_id,topic" }
          );
          return { topic, success: true, action: "adopted", woo_id: matchingWoo.id };
        }
        const secret = generateWebhookSecret();
        const postResp = await fetchWithTimeout(`${store.url}/wp-json/wc/v3/webhooks`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: authHeader },
          body: JSON.stringify({ name: `Proxima - ${name}`, topic, delivery_url: deliveryUrl, status: "active", secret }),
        }, 8000);
        if (!postResp.ok) {
          const errorText = await postResp.text();
          return { topic, success: false, action: "create-failed", error: errorText.slice(0, 200) };
        }
        const wooWh = await postResp.json();
        await supabase.from("webhooks").upsert(
          { store_id: storeId, topic, woo_webhook_id: wooWh.id, delivery_url: deliveryUrl, status: "active", secret: wooWh.secret || secret },
          { onConflict: "store_id,topic" }
        );
        return { topic, success: true, action: "created", woo_id: wooWh.id };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return { topic, success: false, error: msg.slice(0, 200) };
      }
    };

    const results = await Promise.all(WEBHOOK_TOPICS.map(registerOne));

    const successCount = results.filter((r) => r.success).length;
    const createdCount = results.filter((r) => r.action === "created").length;
    const adoptedCount = results.filter((r) => r.action === "adopted").length;
    const keptCount = results.filter((r) => r.action === "kept").length;

    return res.status(200).json({
      success: true,
      message: `${successCount}/${WEBHOOK_TOPICS.length} OK (${createdCount} created, ${adoptedCount} adopted, ${keptCount} kept)`,
      delivery_url: deliveryUrl,
      results,
    });
  } catch (error) {
    console.error("Register webhooks error:", error);
    const msg = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ success: false, error: msg });
  }
}