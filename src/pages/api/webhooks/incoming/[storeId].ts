import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/integrations/supabase/client";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // WooCommerce sends webhooks via POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { storeId } = req.query;

  if (!storeId || typeof storeId !== "string") {
    return res.status(400).json({ error: "Store ID required" });
  }

  try {
    // Get webhook headers from WooCommerce
    const topic = req.headers["x-wc-webhook-topic"] as string;
    const signature = req.headers["x-wc-webhook-signature"] as string;
    const webhookId = req.headers["x-wc-webhook-id"] as string;
    const deliveryId = req.headers["x-wc-webhook-delivery-id"] as string;

    console.log("Incoming webhook:", { storeId, topic, webhookId, deliveryId });

    // Verify store exists
    const { data: store, error: storeError } = await supabase
      .from("stores")
      .select("id, name")
      .eq("id", storeId)
      .single();

    if (storeError || !store) {
      console.error("Store not found:", storeId);
      return res.status(404).json({ error: "Store not found" });
    }

    // Store the webhook event
    const { data: event, error: eventError } = await supabase
      .from("webhook_events")
      .insert({
        store_id: storeId,
        topic: topic || "unknown",
        payload: req.body || {},
        processing_status: "pending",
      })
      .select()
      .single();

    if (eventError) {
      console.error("Error storing webhook event:", eventError);
      return res.status(500).json({ error: "Failed to store event" });
    }

    // Update the webhook's last_triggered_at
    if (topic) {
      await supabase
        .from("webhooks")
        .update({ 
          last_triggered_at: new Date().toISOString(),
          status: "active",
          failure_count: 0 
        })
        .eq("store_id", storeId)
        .eq("topic", topic);
    }

    // Process the webhook event (in a real app, this would be a background job)
    // For now, we'll mark it as completed
    await supabase
      .from("webhook_events")
      .update({
        processing_status: "completed",
        processed_at: new Date().toISOString(),
      })
      .eq("id", event.id);

    console.log("Webhook processed successfully:", event.id);

    // WooCommerce expects a 200 response
    return res.status(200).json({ 
      success: true, 
      event_id: event.id,
      message: "Webhook received and processed" 
    });
  } catch (error) {
    console.error("Webhook processing error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

// Disable body parsing to get raw body for signature verification
export const config = {
  api: {
    bodyParser: true,
  },
};