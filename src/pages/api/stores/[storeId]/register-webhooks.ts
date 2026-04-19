import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin as supabase } from "@/integrations/supabase/admin";
import { WEBHOOK_TOPICS, generateWebhookSecret } from "@/services/webhookService";
import { getWebhookDeliveryUrl } from "@/lib/app-url";

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
    const results: Array<{ topic: string; success: boolean; action?: string; error?: string; woo_id?: number }> = [];

    // Fetch all existing WooCommerce webhooks once
    let wooWebhooks: Array<{ id: number; topic: string; delivery_url: string; status: string }> = [];
    try {
      const listResp = await fetch(`${store.url}/wp-json/wc/v3/webhooks?per_page=100`, {
        headers: { Authorization: authHeader },
      });
      if (listResp.ok) {
        wooWebhooks = await listResp.json();
      }
    } catch (e) {
      console.warn("Failed to list existing webhooks:", e);
    }

    const { data: existingLocal } = await supabase
      .from("webhooks")
      .select("*")
      .eq("store_id", storeId);

    const localByTopic = new Map((existingLocal || []).map((w) => [w.topic, w]));

    for (const { topic, name } of WEBHOOK_TOPICS) {
      const localRow = localByTopic.get(topic);

      // Find matching WooCommerce webhook: same topic + same delivery URL
      const matchingWoo = wooWebhooks.find(
        (w) => w.topic === topic && w.delivery_url === deliveryUrl
      );

      try {
        // Path 1: local row exists and points to a valid WC webhook
        if (localRow?.woo_webhook_id && matchingWoo && matchingWoo.id === localRow.woo_webhook_id) {
          if (matchingWoo.status !== "active") {
            const putResp = await fetch(
              `${store.url}/wp-json/wc/v3/webhooks/${matchingWoo.id}`,
              {
                method: "PUT",
                headers: { "Content-Type": "application/json", Authorization: authHeader },
                body: JSON.stringify({ status: "active" }),
              }
            );
            if (putResp.ok) {
              await supabase
                .from("webhooks")
                .update({ status: "active", updated_at: new Date().toISOString() })
                .eq("id", localRow.id);
            }
          }
          results.push({ topic, success: true, action: "kept", woo_id: matchingWoo.id });
          continue;
        }

        // Path 2: WC has a matching webhook but local row is missing/mismatched -> adopt
        if (matchingWoo) {
          await supabase.from("webhooks").upsert(
            {
              store_id: storeId,
              topic,
              woo_webhook_id: matchingWoo.id,
              delivery_url: deliveryUrl,
              status: "active",
              secret: localRow?.secret || generateWebhookSecret(),
            },
            { onConflict: "store_id,topic" }
          );
          results.push({ topic, success: true, action: "adopted", woo_id: matchingWoo.id });
          continue;
        }

        // Path 3: no existing webhook anywhere -> create
        const secret = generateWebhookSecret();
        const postResp = await fetch(`${store.url}/wp-json/wc/v3/webhooks`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: authHeader },
          body: JSON.stringify({
            name: `Proxima - ${name}`,
            topic,
            delivery_url: deliveryUrl,
            status: "active",
            secret,
          }),
        });

        if (!postResp.ok) {
          const errorText = await postResp.text();
          results.push({ topic, success: false, action: "create-failed", error: errorText.slice(0, 200) });
          continue;
        }

        const wooWh = await postResp.json();
        await supabase.from("webhooks").upsert(
          {
            store_id: storeId,
            topic,
            woo_webhook_id: wooWh.id,
            delivery_url: deliveryUrl,
            status: "active",
            secret: wooWh.secret || secret,
          },
          { onConflict: "store_id,topic" }
        );
        results.push({ topic, success: true, action: "created", woo_id: wooWh.id });
      } catch (error) {
        results.push({ topic, success: false, error: String(error).slice(0, 200) });
      }
    }

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
    return res.status(500).json({ error: String(error) });
  }
}