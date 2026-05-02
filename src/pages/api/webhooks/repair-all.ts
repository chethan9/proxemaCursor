import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin as supabase } from "@/integrations/supabase/admin";
import { getWooUserAgent } from "@/lib/brand-name-server";
import { resolveUserFromRequest } from "@/lib/server-auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const cronSecret = process.env.CRON_SECRET?.trim();
  const cronOk = !!cronSecret && req.headers.authorization === `Bearer ${cronSecret}`;
  const user = cronOk ? null : await resolveUserFromRequest(req);
  const superOk = user?.role === "super_admin";

  if (!cronOk && !superOk) {
    if (process.env.NODE_ENV === "production" && !cronSecret) {
      return res.status(503).json({ error: "CRON_SECRET not configured" });
    }
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const { data: stores } = await supabase
      .from("stores")
      .select("id, url, consumer_key, consumer_secret")
      .not("consumer_key", "is", null)
      .not("consumer_secret", "is", null);

    if (!stores || stores.length === 0) {
      return res.status(200).json({ success: true, message: "No connected stores", deleted: 0 });
    }

    const ua = await getWooUserAgent();
    let totalDeleted = 0;
    const storeResults: Array<{ store_id: string; deleted: number; error?: string }> = [];

    for (const store of stores) {
      try {
        const authHeader = `Basic ${Buffer.from(`${store.consumer_key}:${store.consumer_secret}`).toString("base64")}`;
        const listResp = await fetch(`${store.url}/wp-json/wc/v3/webhooks?per_page=100`, {
          headers: { Authorization: authHeader, "User-Agent": ua },
        });

        if (!listResp.ok) {
          storeResults.push({ store_id: store.id, deleted: 0, error: `List failed: ${listResp.status}` });
          continue;
        }

        const webhooks: Array<{ id: number; topic: string; delivery_url: string; date_created: string }> =
          await listResp.json();

        // Group by topic, keep newest, delete rest
        const byTopic = new Map<string, typeof webhooks>();
        for (const wh of webhooks) {
          const arr = byTopic.get(wh.topic) || [];
          arr.push(wh);
          byTopic.set(wh.topic, arr);
        }

        let storeDeleted = 0;
        for (const [, group] of byTopic) {
          if (group.length <= 1) continue;
          // Sort newest first
          group.sort((a, b) => new Date(b.date_created).getTime() - new Date(a.date_created).getTime());
          const toDelete = group.slice(1);
          for (const wh of toDelete) {
            try {
              await fetch(`${store.url}/wp-json/wc/v3/webhooks/${wh.id}?force=true`, {
                method: "DELETE",
                headers: { Authorization: authHeader, "User-Agent": ua },
              });
              await supabase.from("webhooks").delete().eq("woo_webhook_id", wh.id).eq("store_id", store.id);
              storeDeleted++;
            } catch (e) {
              console.warn(`Delete failed for webhook ${wh.id}:`, e);
            }
          }
        }

        totalDeleted += storeDeleted;
        storeResults.push({ store_id: store.id, deleted: storeDeleted });
      } catch (e) {
        storeResults.push({ store_id: store.id, deleted: 0, error: String(e).slice(0, 200) });
      }
    }

    return res.status(200).json({
      success: true,
      message: `Removed ${totalDeleted} duplicate webhooks across ${stores.length} store(s)`,
      deleted: totalDeleted,
      results: storeResults,
    });
  } catch (error) {
    console.error("Repair webhooks error:", error);
    return res.status(500).json({ error: String(error) });
  }
}