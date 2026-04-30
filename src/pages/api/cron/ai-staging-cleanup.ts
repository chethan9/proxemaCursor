import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";

const TTL_HOURS = 24;
const BATCH = 40;

/** Remove ai-staging objects referenced by generations older than TTL (backup for approve/reject deletes). */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const cronSecret = process.env.CRON_SECRET;
  if (process.env.NODE_ENV === "production" && cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const cutoff = new Date(Date.now() - TTL_HOURS * 3600_000).toISOString();
  let removed = 0;
  let rowsCleared = 0;

  const { data: gens, error } = await supabaseAdmin
    .from("ai_generations")
    .select("id, output_storage_paths")
    .lt("created_at", cutoff)
    .limit(BATCH * 4);

  if (error) return res.status(500).json({ error: error.message });

  const toProcess = (gens ?? []).filter((g) => ((g as { output_storage_paths?: string[] }).output_storage_paths?.length ?? 0) > 0).slice(0, BATCH);

  for (const g of toProcess) {
    const paths = (g as { output_storage_paths?: string[] }).output_storage_paths ?? [];
    for (const path of paths) {
      if (!path) continue;
      const rel = path.startsWith("ai-staging/") ? path.slice("ai-staging/".length) : path;
      const { error: delErr } = await supabaseAdmin.storage.from("ai-staging").remove([rel]);
      if (!delErr) removed += 1;
    }
    await supabaseAdmin.from("ai_generations").update({ output_storage_paths: [] }).eq("id", (g as { id: string }).id);
    rowsCleared += 1;
  }

  return res.status(200).json({
    ok: true,
    ttl_hours: TTL_HOURS,
    cutoff,
    generations_processed: toProcess.length,
    rows_cleared: rowsCleared,
    objects_removed: removed,
  });
}
