import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/integrations/supabase/client";
import { WEBHOOK_TOPICS, generateWebhookSecret, buildWebhookDeliveryUrl } from "@/services/webhookService";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { storeId } = req.query;

  if (!storeId || typeof storeId !== "string") {
    return res.status(400).json({ error: "Store ID required" });
  }

  try {
    // Get store credentials
    const { data: store, error: storeError } = await supabase
      .from("stores")
      .select("*")
      .eq("id", storeId)
      .single();

    if (storeError || !store) {
      return res.status(404).json({ error: "Store not found" });
    }

    if (!store.consumer_key || !store.consumer_secret) {
      return res.status(400).json({ error: "Store not connected - missing API credentials" });
    }

    const deliveryUrl = buildWebhookDeliveryUrl(storeId);
    const results: Array<{ topic: string; success: boolean; error?: string; woo_id?: number }> = [];

    // Register each webhook with WooCommerce
    for (const { topic, name } of WEBHOOK_TOPICS) {
      try {
        // Create webhook in WooCommerce
        const wooResponse = await fetch(`${store.url}/wp-json/wc/v3/webhooks`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Basic ${Buffer.from(`${store.consumer_key}:${store.consumer_secret}`).toString("base64")}`,
          },
          body: JSON.stringify({
            name: `WooSync - ${name}`,
            topic: topic,
            delivery_url: deliveryUrl,
            status: "active",
            secret: generateWebhookSecret(),
          }),
        });

        if (!wooResponse.ok) {
          const errorText = await wooResponse.text();
          console.error(`Failed to register ${topic}:`, errorText);
          
          // Check if webhook already exists (duplicate error)
          if (errorText.includes("already exists") || wooResponse.status === 400) {
            results.push({ topic, success: true, error: "Already exists" });
            
            // Update our record to active
            await supabase
              .from("webhooks")
              .upsert({
                store_id: storeId,
                topic,
                delivery_url: deliveryUrl,
                status: "active",
                secret: generateWebhookSecret(),
              }, { onConflict: "store_id,topic" });
            
            continue;
          }
          
          results.push({ topic, success: false, error: errorText });
          continue;
        }

        const wooWebhook = await wooResponse.json();
        
        // Save/update webhook in our database
        await supabase
          .from("webhooks")
          .upsert({
            store_id: storeId,
            topic,
            woo_webhook_id: wooWebhook.id,
            delivery_url: deliveryUrl,
            status: "active",
            secret: wooWebhook.secret,
          }, { onConflict: "store_id,topic" });

        results.push({ topic, success: true, woo_id: wooWebhook.id });
      } catch (error) {
        console.error(`Error registering webhook ${topic}:`, error);
        results.push({ topic, success: false, error: String(error) });
      }
    }

    const successCount = results.filter(r => r.success).length;
    
    return res.status(200).json({
      success: true,
      message: `Registered ${successCount}/${WEBHOOK_TOPICS.length} webhooks`,
      results,
    });
  } catch (error) {
    console.error("Register webhooks error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}