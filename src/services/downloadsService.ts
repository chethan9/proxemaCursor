import { supabase } from "@/integrations/supabase/client";

export type DownloadFileType = "invoice" | "packing_slip" | "credit_note" | "report";

export interface DownloadFile {
  id: string;
  source: "bulk_job";
  source_id: string;
  type: DownloadFileType;
  file_name: string;
  order_ref: string | null;
  customer_name: string | null;
  generated_at: string;
  size_bytes: number | null;
  artifact_path: string;
}

export interface DownloadsFilters {
  search?: string;
  types?: DownloadFileType[];
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

export interface DownloadsResult {
  rows: DownloadFile[];
  total: number;
  counts: Record<DownloadFileType | "all", number>;
}

const JOB_TYPE_TO_FILE_TYPE: Record<string, DownloadFileType> = {
  print_invoices_bulk: "invoice",
};

export async function listSiteDownloads(
  storeId: string,
  filters: DownloadsFilters = {}
): Promise<DownloadsResult> {
  const page = Math.max(1, filters.page || 1);
  const pageSize = Math.max(1, Math.min(200, filters.pageSize || 20));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("bulk_jobs")
    .select("id, store_id, job_type, payload, status, completed_at, total", { count: "exact" })
    .eq("store_id", storeId)
    .eq("status", "completed")
    .in("job_type", Object.keys(JOB_TYPE_TO_FILE_TYPE))
    .not("payload->>artifact_path", "is", null)
    .order("completed_at", { ascending: false });

  if (filters.dateFrom) query = query.gte("completed_at", filters.dateFrom);
  if (filters.dateTo) query = query.lte("completed_at", filters.dateTo);

  const { data, error, count } = await query.range(from, to);
  if (error) throw error;

  const rows: DownloadFile[] = [];
  for (const j of data || []) {
    const payload = (j.payload as Record<string, unknown>) || {};
    if (payload.artifact_deleted === true) continue;
    const artifactPath = payload.artifact_path as string | undefined;
    if (!artifactPath) continue;

    const type = JOB_TYPE_TO_FILE_TYPE[j.job_type] || "invoice";
    if (filters.types && filters.types.length > 0 && !filters.types.includes(type)) continue;

    const ext = artifactPath.split(".").pop() || "pdf";
    const total = j.total || 0;
    const fileName = `invoices_${j.id.slice(0, 8)}_${total}orders.${ext}`;
    const sizeBytes = (payload.artifact_size_bytes as number | undefined) ?? null;

    if (filters.search) {
      const q = filters.search.toLowerCase();
      const haystack = `${fileName} ${j.id}`.toLowerCase();
      if (!haystack.includes(q)) continue;
    }

    rows.push({
      id: j.id,
      source: "bulk_job",
      source_id: j.id,
      type,
      file_name: fileName,
      order_ref: null,
      customer_name: null,
      generated_at: j.completed_at as string,
      size_bytes: sizeBytes,
      artifact_path: artifactPath,
    });
  }

  const counts: Record<DownloadFileType | "all", number> = {
    all: rows.length,
    invoice: rows.filter((r) => r.type === "invoice").length,
    packing_slip: rows.filter((r) => r.type === "packing_slip").length,
    credit_note: rows.filter((r) => r.type === "credit_note").length,
    report: rows.filter((r) => r.type === "report").length,
  };

  return { rows, total: count || 0, counts };
}

export async function deleteDownload(jobId: string, storeId: string): Promise<void> {
  const { data: job, error: fetchErr } = await supabase
    .from("bulk_jobs")
    .select("payload")
    .eq("id", jobId)
    .eq("store_id", storeId)
    .maybeSingle();
  if (fetchErr) throw fetchErr;
  if (!job) throw new Error("Job not found");

  const payload = { ...((job.payload as Record<string, unknown>) || {}), artifact_deleted: true };
  delete payload.artifact_path;

  const { error } = await supabase
    .from("bulk_jobs")
    .update({ payload: payload as never })
    .eq("id", jobId);
  if (error) throw error;
}