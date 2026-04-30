import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";

/** Delete activity_log older than 90d (cascades activity_diff_items). */
const RETENTION_DAYS = 90;
const BATCH = 2000;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const cronSecret = process.env.CRON_SECRET;
  if (
    process.env.NODE_ENV === "production" &&
    cronSecret &&
    req.headers.authorization !== `Bearer ${cronSecret}`
  ) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const cutoff = new Date(Date.now() - RETENTION_DAYS * 86400_000).toISOString();
  let total = 0;

  for (let i = 0; i < 50; i++) {
    const { data: batch, error } = await supabaseAdmin
      .from("activity_log")
      .select("id")
      .lt("created_at", cutoff)
      .limit(BATCH);

    if (error) {
      return res.status(500).json({ error: error.message, deleted: total });
    }
    const ids = (batch ?? []).map((r) => (r as { id: string }).id);
    if (ids.length === 0) break;

    const { error: delErr } = await supabaseAdmin.from("activity_log").delete().in("id", ids);
    if (delErr) {
      return res.status(500).json({ error: delErr.message, deleted: total });
    }
    total += ids.length;
    if (ids.length < BATCH) break;
  }

  return res.status(200).json({
    ok: true,
    retention_days: RETENTION_DAYS,
    cutoff,
    deleted_rows: total,
  });
}
