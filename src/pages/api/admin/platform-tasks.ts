import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { resolveUserFromRequest } from "@/lib/server-auth";

export type PlatformTaskStatusFilter = "all" | "running" | "failed" | "completed";

export type PlatformTasksResponse = {
  summary: {
    syncRunsRunning: number;
    cronInProgress: number;
    bulkRunning: number;
    syncRunsFailed24h: number;
    cronFailed24h: number;
    bulkFailed24h: number;
  };
  syncRuns: Array<{
    id: string;
    store_id: string;
    store_name: string | null;
    aspect: string;
    status: string | null;
    started_at: string | null;
    completed_at: string | null;
    error_message: string | null;
    records_processed: number | null;
  }>;
  cronLogs: Array<{
    id: string;
    store_id: string | null;
    store_name: string | null;
    job_type: string;
    status: string;
    started_at: string | null;
    completed_at: string | null;
    error_message: string | null;
    message: string | null;
  }>;
  bulkJobs: Array<{
    id: string;
    store_id: string;
    store_name: string | null;
    job_type: string;
    status: string;
    started_at: string | null;
    completed_at: string | null;
    error_message: string | null;
    processed: number;
    total: number;
  }>;
};

const LIMIT = 150;
const SINCE_24H_MS = 24 * 60 * 60 * 1000;

function buildSyncRunsQuery(
  filter: PlatformTaskStatusFilter,
  storeId: string | null
) {
  let q = supabaseAdmin
    .from("sync_runs")
    .select(
      "id, store_id, aspect, status, started_at, completed_at, error_message, records_processed"
    )
    .order("started_at", { ascending: false })
    .limit(LIMIT);
  if (storeId) q = q.eq("store_id", storeId);
  if (filter === "running") {
    q = q.in("status", ["running", "retrying"]);
  } else if (filter === "failed") {
    q = q.eq("status", "failed");
  } else if (filter === "completed") {
    q = q.eq("status", "completed");
  }
  return q;
}

function buildCronLogsQuery(filter: PlatformTaskStatusFilter, storeId: string | null) {
  let q = supabaseAdmin
    .from("cron_logs")
    .select(
      "id, store_id, job_type, status, started_at, completed_at, error_message, message"
    )
    .order("started_at", { ascending: false })
    .limit(LIMIT);
  if (storeId) q = q.eq("store_id", storeId);
  if (filter === "running") {
    q = q.eq("status", "started").is("completed_at", null);
  } else if (filter === "failed") {
    q = q.eq("status", "failed");
  } else if (filter === "completed") {
    q = q.eq("status", "completed");
  }
  return q;
}

function buildBulkJobsQuery(filter: PlatformTaskStatusFilter, storeId: string | null) {
  let q = supabaseAdmin
    .from("bulk_jobs")
    .select(
      "id, store_id, job_type, status, started_at, completed_at, error_message, processed, total"
    )
    .order("created_at", { ascending: false })
    .limit(LIMIT);
  if (storeId) q = q.eq("store_id", storeId);
  if (filter === "running") {
    q = q.in("status", ["pending", "running"]);
  } else if (filter === "failed") {
    q = q.eq("status", "failed");
  } else if (filter === "completed") {
    q = q.eq("status", "completed");
  }
  return q;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<PlatformTasksResponse | { error: string }>) {
  const me = await resolveUserFromRequest(req);
  if (!me?.userId || me.role !== "super_admin") {
    return res.status(403).json({ error: "Super admin only" });
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const rawFilter = typeof req.query.status === "string" ? req.query.status : "all";
  const filter: PlatformTaskStatusFilter =
    rawFilter === "running" || rawFilter === "failed" || rawFilter === "completed" ? rawFilter : "all";

  const storeId =
    typeof req.query.storeId === "string" && req.query.storeId.trim() !== ""
      ? req.query.storeId.trim()
      : null;

  const since24h = new Date(Date.now() - SINCE_24H_MS).toISOString();

  const { data: stores } = await supabaseAdmin.from("stores").select("id, name");
  const storeMap = new Map((stores || []).map((s) => [s.id, s.name as string]));

  let qSrRun = supabaseAdmin
    .from("sync_runs")
    .select("id", { count: "exact", head: true })
    .in("status", ["running", "retrying"]);
  let qSrFail = supabaseAdmin
    .from("sync_runs")
    .select("id", { count: "exact", head: true })
    .eq("status", "failed")
    .gte("started_at", since24h);
  let qCronProg = supabaseAdmin
    .from("cron_logs")
    .select("id", { count: "exact", head: true })
    .eq("status", "started")
    .is("completed_at", null);
  let qCronFail = supabaseAdmin
    .from("cron_logs")
    .select("id", { count: "exact", head: true })
    .eq("status", "failed")
    .gte("started_at", since24h);
  let qBulkRun = supabaseAdmin
    .from("bulk_jobs")
    .select("id", { count: "exact", head: true })
    .in("status", ["pending", "running"]);
  let qBulkFail = supabaseAdmin
    .from("bulk_jobs")
    .select("id", { count: "exact", head: true })
    .eq("status", "failed")
    .gte("updated_at", since24h);
  if (storeId) {
    qSrRun = qSrRun.eq("store_id", storeId);
    qSrFail = qSrFail.eq("store_id", storeId);
    qCronProg = qCronProg.eq("store_id", storeId);
    qCronFail = qCronFail.eq("store_id", storeId);
    qBulkRun = qBulkRun.eq("store_id", storeId);
    qBulkFail = qBulkFail.eq("store_id", storeId);
  }

  const [
    syncRunsRes,
    cronRes,
    bulkRes,
    srRunCount,
    srFailCount,
    cronProgCount,
    cronFailCount,
    bulkRunCount,
    bulkFailCount,
  ] = await Promise.all([
    buildSyncRunsQuery(filter, storeId),
    buildCronLogsQuery(filter, storeId),
    buildBulkJobsQuery(filter, storeId),
    qSrRun,
    qSrFail,
    qCronProg,
    qCronFail,
    qBulkRun,
    qBulkFail,
  ]);

  if (syncRunsRes.error) {
    console.error("[platform-tasks] sync_runs", syncRunsRes.error);
    return res.status(500).json({ error: syncRunsRes.error.message });
  }
  if (cronRes.error) {
    console.error("[platform-tasks] cron_logs", cronRes.error);
    return res.status(500).json({ error: cronRes.error.message });
  }
  if (bulkRes.error) {
    console.error("[platform-tasks] bulk_jobs", bulkRes.error);
    return res.status(500).json({ error: bulkRes.error.message });
  }

  const syncRuns = (syncRunsRes.data || []).map((r) => ({
    id: r.id,
    store_id: r.store_id,
    store_name: storeMap.get(r.store_id) ?? null,
    aspect: r.aspect,
    status: r.status,
    started_at: r.started_at,
    completed_at: r.completed_at,
    error_message: r.error_message,
    records_processed: r.records_processed,
  }));

  const cronLogs = (cronRes.data || []).map((r) => ({
    id: r.id,
    store_id: r.store_id,
    store_name: r.store_id ? storeMap.get(r.store_id) ?? null : null,
    job_type: r.job_type,
    status: r.status,
    started_at: r.started_at,
    completed_at: r.completed_at,
    error_message: r.error_message,
    message: r.message,
  }));

  const bulkJobs = (bulkRes.data || []).map((r) => ({
    id: r.id,
    store_id: r.store_id,
    store_name: storeMap.get(r.store_id) ?? null,
    job_type: r.job_type,
    status: r.status,
    started_at: r.started_at,
    completed_at: r.completed_at,
    error_message: r.error_message,
    processed: r.processed,
    total: r.total,
  }));

  const body: PlatformTasksResponse = {
    summary: {
      syncRunsRunning: srRunCount.count ?? 0,
      cronInProgress: cronProgCount.count ?? 0,
      bulkRunning: bulkRunCount.count ?? 0,
      syncRunsFailed24h: srFailCount.count ?? 0,
      cronFailed24h: cronFailCount.count ?? 0,
      bulkFailed24h: bulkFailCount.count ?? 0,
    },
    syncRuns,
    cronLogs,
    bulkJobs,
  };

  return res.status(200).json(body);
}
