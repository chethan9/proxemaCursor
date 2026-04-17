import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/integrations/supabase/client";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  
  const { webhookId } = req.query;
  if (!webhookId || typeof webhookId !== "string") {
    return res.status(400).json({ error: "Webhook ID required" });
  }

  try {
    const { data: webhook, error } = await supabase
      .from("webhooks").select("*, stores(*)").eq("id", webhookId).single();
    
    if (error || !webhook) return res.status(404).json({ error: "Webhook not found" });
    
    const startTime = Date.now();
    let success = false;
    let statusCode = 0;
    let errorMessage = "";
    
    try {
      const response = await fetch(webhook.delivery_url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-WC-Webhook-Topic": webhook.topic,
          "X-WC-Webhook-Source": webhook.stores?.url || "",
          "X-WC-Webhook-Test": "true",
        },
        body: JSON.stringify({ test: true, webhook_id: webhook.id, topic: webhook.topic, timestamp: new Date().toISOString() }),
      });
      statusCode = response.status;
      success = response.ok;
    } catch (e) {
      errorMessage = e instanceof Error ? e.message : "Network error";
    }
    
    const duration = Date.now() - startTime;
    
    // Log test result
    await supabase.from("webhook_test_results").insert({
      webhook_id: webhook.id,
      success,
      status_code: statusCode,
      duration_ms: duration,
      error_message: errorMessage || null,
    });
    
    return res.status(200).json({ success, status_code: statusCode, duration_ms: duration, error: errorMessage || null });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
}