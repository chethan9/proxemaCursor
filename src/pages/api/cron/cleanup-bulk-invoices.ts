import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";

const RETENTION_DAYS = 7;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = req.headers.authorization || "";
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && auth !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const startedAt = Date.now();

  let scanned = 0;
  let deleted = 0;
  let errors = 0;
  const errorDetails: Array<{ jobId: string; message: string }> = [];

  try {
    const { data: jobs, error } = await supabaseAdmin
      .from("bulk_jobs")
      .select("id, store_id, payload, status, completed_at")
      .eq("job_type", "print_invoices_bulk")
      .lt("completed_at", cutoff)
      .limit(500);

    if (error) {
      console.error("[cleanup-bulk-invoices] query error:", error);
      return res.status(500).json({ error: "Query failed" });
    }

    for (const job of jobs || []) {
      scanned++;
      const payload = (job.payload as Record<string, unknown>) || {};
      const artifactPath = payload.artifact_path as string | undefined;
      const artifactDeleted = payload.artifact_deleted === true;

      if (artifactDeleted) continue;
      if (!artifactPath && job.status !== "failed" && job.status !== "cancelled") continue;

      try {
        const { data: storeRow } = await supabaseAdmin
          .from("stores")
          .select("client_id")
          .eq("id", job.store_id)
          .maybeSingle();
        const pathScope = (storeRow?.client_id as string | null) ?? `store-${job.store_id}`;

        const filesToRemove: string[] = [];
        if (artifactPath) filesToRemove.push(artifactPath);

        const partsPrefix = `${pathScope}/${job.id}/parts`;
        try {
          const { data: list } = await supabaseAdmin.storage.from("bulk-invoices").list(partsPrefix);
          if (list && list.length > 0) {
            for (const f of list) filesToRemove.push(`${partsPrefix}/${f.name}`);
          }
        } catch {
          /* non-fatal */
        }

        if (filesToRemove.length > 0) {
          const { error: rmErr } = await supabaseAdmin.storage.from("bulk-invoices").remove(filesToRemove);
          if (rmErr && !/not.?found/i.test(rmErr.message)) {
            throw rmErr;
          }
        }

        const newPayload: Record<string, unknown> = { ...payload, artifact_deleted: true };
        delete newPayload.artifact_path;
        await supabaseAdmin
          .from("bulk_jobs")
          .update({ payload: newPayload as never })
          .eq("id", job.id);

        deleted++;
      } catch (e) {
        errors++;
        errorDetails.push({ jobId: job.id, message: e instanceof Error ? e.message : String(e) });
      }
    }

    return res.status(200).json({
      ok: true,
      scanned,
      deleted,
      errors,
      duration_ms: Date.now() - startedAt,
      cutoff,
      error_details: errorDetails.slice(0, 20),
    });
  } catch (e) {
    console.error("[cleanup-bulk-invoices] fatal:", e);
    return res.status(500).json({ error: e instanceof Error ? e.message : "Unknown error" });
  }
}