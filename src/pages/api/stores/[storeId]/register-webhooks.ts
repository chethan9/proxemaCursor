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

    const { data: existingWebhooks } = await supabase
      .from("webhooks")
      .select("*")
      .eq("store_id", storeId);

    const existingByTopic = new Map((existingWebhooks || []).map((w) => [w.topic, w]));

    for (const { topic, name } of WEBHOOK_TOPICS) {
      const existing = existingByTopic.get(topic);

      try {
        if (existing?.woo_webhook_id) {
          const putResp = await fetch(
            `${store.url}/wp-json/wc/v3/webhooks/${existing.woo_webhook_id}`,
            {
              method: "PUT",
              headers: { "Content-Type": "application/json", Authorization: authHeader },
              body: JSON.stringify({ delivery_url: deliveryUrl, status: "active" }),
            }
          );

          if (putResp.ok) {
            const wooWh = await putResp.json();
            await supabase
              .from("webhooks")
              .update({
                delivery_url: deliveryUrl,
                status: "active",
                updated_at: new Date().toISOString(),
              })
              .eq("id", existing.id);
            results.push({ topic, success: true, action: "updated", woo_id: wooWh.id });
            continue;
          }

          if (putResp.status === 404) {
            // webhook was deleted from WooCommerce — fall through to create
          } else {
            const errorText = await putResp.text();
            results.push({ topic, success: false, action: "update-failed", error: errorText.slice(0, 200) });
            continue;
          }
        }

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
    const updatedCount = results.filter((r) => r.action === "updated").length;
    const createdCount = results.filter((r) => r.action === "created").length;

    return res.status(200).json({
      success: true,
      message: `${successCount}/${WEBHOOK_TOPICS.length} OK (${updatedCount} updated, ${createdCount} created)`,
      delivery_url: deliveryUrl,
      results,
    });
  } catch (error) {
    console.error("Register webhooks error:", error);
    return res.status(500).json({ error: String(error) });
  }
}