import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin as supabase } from "@/integrations/supabase/admin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;
  if (process.env.NODE_ENV === "production" && cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const now = new Date().toISOString();
  const { data: dueRuns } = await supabase
    .from("sync_runs")
    .select("id, store_id, aspect, attempt")
    .eq("status", "retrying")
    .lte("next_retry_at", now)
    .limit(20);

  if (!dueRuns?.length) {
    return res.status(200).json({ message: "No retries due", checked_at: now });
  }

  const results = [];
  for (const run of dueRuns) {
    const { error } = await supabase
      .from("sync_runs")
      .update({
        status: "running",
        started_at: new Date().toISOString(),
        error_message: null,
      })
      .eq("id", run.id)
      .eq("status", "retrying");

    if (error) continue;

    try {
      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL
        || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
      fetch(`${baseUrl}/api/stores/${run.store_id}/sync-start?aspect=${run.aspect}&runId=${run.id}`, {
        method: "POST",
        headers: { "X-Retry-Attempt": String(run.attempt + 1) },
      }).catch(() => {});
      results.push({ id: run.id, store_id: run.store_id, aspect: run.aspect, attempt: run.attempt + 1 });
    } catch (err) {
      await supabase
        .from("sync_runs")
        .update({
          status: "failed",
          error_message: err instanceof Error ? err.message : "Retry dispatch failed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", run.id);
    }
  }

  return res.status(200).json({ retried: results.length, runs: results });
}