import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin as supabase } from "@/integrations/supabase/admin";

// WooCommerce sends credentials via POST to this callback
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { key_id, user_id, consumer_key, consumer_secret } = req.body;

    // user_id from WooCommerce callback contains our store_id (passed during auth request)
    const storeId = user_id;

    if (!storeId || !consumer_key || !consumer_secret) {
      console.error("Missing required fields:", { key_id, user_id, consumer_key: !!consumer_key, consumer_secret: !!consumer_secret });
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Update the store with the received credentials
    const { error } = await supabase
      .from("stores")
      .update({
        consumer_key,
        consumer_secret,
        woo_key_id: key_id ?? null,
        status: "connected",
      })
      .eq("id", storeId);

    if (error) {
      console.error("Error updating store:", error);
      return res.status(500).json({ error: "Failed to save credentials" });
    }

    console.log("Store connected successfully:", storeId);

    // Webhook registration and initial sync are owned by the connect wizard (both OAuth and manual paths).
    // This prevents double-registration and gives the user real-time feedback + retry capability.

    // Return success - WooCommerce expects a 200 response
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Callback error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}