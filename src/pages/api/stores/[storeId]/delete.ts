import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "DELETE" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { storeId } = req.query;
  if (typeof storeId !== "string") {
    return res.status(400).json({ error: "Invalid storeId" });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  const token = authHeader.slice(7);
  const { data: userRes, error: userErr } = await supabaseAdmin.auth.getUser(token);
  if (userErr || !userRes.user) {
    return res.status(401).json({ error: "Invalid token" });
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role, client_id")
    .eq("id", userRes.user.id)
    .single();

  if (!profile) return res.status(403).json({ error: "Profile not found" });

  const { data: store } = await supabaseAdmin
    .from("stores")
    .select("*")
    .eq("id", storeId)
    .single();

  if (!store) return res.status(404).json({ error: "Store not found" });

  const isSuperAdmin = profile.role === "super_admin";
  if (!isSuperAdmin && store.client_id !== profile.client_id) {
    return res.status(403).json({ error: "Forbidden" });
  }

  // Try to remove webhooks from WooCommerce
  const { data: webhooks } = await supabaseAdmin
    .from("webhooks")
    .select("*")
    .eq("store_id", storeId);

  const webhookResults: { id: string; remote_id: number | null; ok: boolean; error?: string }[] = [];
  if (webhooks && store.consumer_key && store.consumer_secret && store.url) {
    const auth = Buffer.from(`${store.consumer_key}:${store.consumer_secret}`).toString("base64");
    for (const wh of webhooks) {
      if (!wh.remote_id) {
        webhookResults.push({ id: wh.id, remote_id: null, ok: true });
        continue;
      }
      try {
        const resp = await fetch(
          `${store.url.replace(/\/$/, "")}/wp-json/wc/v3/webhooks/${wh.remote_id}?force=true`,
          {
            method: "DELETE",
            headers: { Authorization: `Basic ${auth}` },
          }
        );
        webhookResults.push({ id: wh.id, remote_id: wh.remote_id, ok: resp.ok });
      } catch (e) {
        webhookResults.push({
          id: wh.id,
          remote_id: wh.remote_id,
          ok: false,
          error: e instanceof Error ? e.message : "Unknown error",
        });
      }
    }
  }

  // Delete store (cascade removes local webhooks, sync_runs, etc via FK)
  const { error: delErr } = await supabaseAdmin
    .from("stores")
    .delete()
    .eq("id", storeId);

  if (delErr) {
    return res.status(500).json({ error: delErr.message });
  }

  return res.status(200).json({
    success: true,
    webhooks_removed: webhookResults.filter((r) => r.ok).length,
    webhooks_failed: webhookResults.filter((r) => !r.ok).length,
    details: webhookResults,
  });
}