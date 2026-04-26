import { supabase } from "@/integrations/supabase/client";

export type DownloadFileType = "invoice" | "packing_slip" | "credit_note" | "report";

export interface DownloadFile {
  id: string;
  source: "bulk_job";
  source_id: string;
  type: DownloadFileType;
  file_name: string;
  reference: string | null;
  customer: string | null;
  generated_at: string;
  expires_at: string | null;
  size_bytes: number | null;
  artifact_path: string;
  download_url: string;
}

const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const JOB_TYPE_TO_FILE_TYPE: Record<string, DownloadFileType> = {
  print_invoices_bulk: "invoice",
};

export async function listSiteDownloads(storeId: string): Promise<DownloadFile[]> {
  const { data, error } = await supabase
    .from("bulk_jobs")
    .select("id, store_id, job_type, payload, status, completed_at, total")
    .eq("store_id", storeId)
    .eq("status", "completed")
    .in("job_type", Object.keys(JOB_TYPE_TO_FILE_TYPE))
    .order("completed_at", { ascending: false })
    .limit(500);

  if (error) throw error;

  const rows: DownloadFile[] = [];
  for (const j of data || []) {
    const payload = (j.payload as Record<string, unknown>) || {};
    if (payload.artifact_deleted === true) continue;
    const artifactPath = payload.artifact_path as string | undefined;
    if (!artifactPath) continue;

    const type = JOB_TYPE_TO_FILE_TYPE[j.job_type] || "invoice";
    const ext = artifactPath.split(".").pop() || "pdf";
    const total = j.total || 0;
    const fileName = `invoices_${j.id.slice(0, 8)}_${total}orders.${ext}`;
    const sizeBytes = (payload.artifact_size_bytes as number | undefined) ?? null;
    const completedAt = j.completed_at as string;
    const expiresAt = completedAt
      ? new Date(new Date(completedAt).getTime() + RETENTION_MS).toISOString()
      : null;

    rows.push({
      id: j.id,
      source: "bulk_job",
      source_id: j.id,
      type,
      file_name: fileName,
      reference: `Job ${j.id.slice(0, 8)}`,
      customer: total > 0 ? `${total} orders` : null,
      generated_at: completedAt,
      expires_at: expiresAt,
      size_bytes: sizeBytes,
      artifact_path: artifactPath,
      download_url: `/api/bulk-jobs/${j.id}/download`,
    });
  }
  return rows;
}

export async function dismissJobArtifact(jobId: string): Promise<void> {
  const { data: job, error: fetchErr } = await supabase
    .from("bulk_jobs")
    .select("payload")
    .eq("id", jobId)
    .maybeSingle();
  if (fetchErr) throw fetchErr;
  if (!job) throw new Error("Job not found");

  const current = (job.payload as Record<string, unknown>) || {};
  const next: Record<string, unknown> = { ...current, artifact_deleted: true };
  delete next.artifact_path;

  const { error } = await supabase
    .from("bulk_jobs")
    .update({ payload: next as never })
    .eq("id", jobId);
  if (error) throw error;
}