import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin as supabase } from "@/integrations/supabase/admin";
import { cronHeaders } from "@/lib/authorize-cron-or-store.server";

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

    const { data: existing } = await supabase
      .from("stores")
      .select("url, woo_key_id, consumer_key, consumer_secret")
      .eq("id", storeId)
      .maybeSingle();

    if (
      existing?.woo_key_id &&
      existing.consumer_key &&
      existing.consumer_secret &&
      existing.url &&
      existing.woo_key_id !== key_id
    ) {
      const oldAuth = Buffer.from(`${existing.consumer_key}:${existing.consumer_secret}`).toString("base64");
      const oldBase = existing.url.replace(/\/$/, "");
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 5000);
      fetch(`${oldBase}/wp-json/wc/v3/keys/${existing.woo_key_id}?force=true`, {
        method: "DELETE",
        headers: { Authorization: `Basic ${oldAuth}` },
        signal: controller.signal,
      })
        .catch((e) => console.error("[callback] revoke old key failed:", e instanceof Error ? e.message : e))
        .finally(() => clearTimeout(t));
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

    // Eager sync: kick off background sync immediately after credentials are saved.
    // This leverages the 10-20s window while user completes WP app-password flow —
    // by the time they land on the Products page, categories/tags/products are often already populated.
    const protocol = (req.headers["x-forwarded-proto"] as string) || "https";
    const host = req.headers.host;
    if (host) {
      const base = `${protocol}://${host}`;
      fetch(`${base}/api/stores/${storeId}/sync-start`, {
        method: "POST",
        headers: cronHeaders(),
        body: JSON.stringify({ is_initial: false }),
      }).catch((e) => console.error("[callback] eager sync trigger failed:", e));
    }

    // Webhook registration and initial sync finalization are owned by the connect wizard.
    // This just gets data flowing early; the wizard still controls completion state.

    // Return success - WooCommerce expects a 200 response
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Callback error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}