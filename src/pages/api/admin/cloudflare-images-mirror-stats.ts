import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { CLOUDFLARE_SETTINGS_SINGLETON_ID } from "@/lib/cloudflare-images-config.server";
import { resolveUserFromRequest } from "@/lib/server-auth";

export type MirrorDashboardStats = {
  counts: {
    total_rows: number;
    ready: number;
    pending: number;
    failed: number;
    deleting: number;
    distinct_cf_images: number;
    repair_queue: number;
  };
  by_source: Record<string, number>;
  recent_failures: Array<{
    id: string;
    store_id: string;
    product_id: string;
    error: string | null;
    updated_at: string | null;
    source_kind: string | null;
    store_name: string | null;
    store_url: string | null;
  }>;
  top_pending_by_store: Array<{
    store_id: string;
    store_name: string | null;
    store_url: string | null;
    pending_count: number;
  }>;
  repair_batch_size: number;
  repair_cron_schedule: string;
  estimated_batches_remaining: number;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const me = await resolveUserFromRequest(req);
  if (!me?.userId || me.role !== "super_admin") {
    return res.status(403).json({ error: "Super admin only" });
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { data: raw, error } = await supabaseAdmin.rpc("get_product_image_mirror_dashboard_stats");
  if (error) {
    console.error("[cloudflare-images-mirror-stats]", error);
    return res.status(500).json({ error: error.message });
  }

  const { data: settingsRow } = await supabaseAdmin
    .from("cloudflare_images_settings")
    .select("repair_batch_size")
    .eq("id", CLOUDFLARE_SETTINGS_SINGLETON_ID)
    .maybeSingle();

  const repairBatch =
    settingsRow?.repair_batch_size != null && Number.isFinite(Number(settingsRow.repair_batch_size)) ?
      Math.min(500, Math.max(10, Number(settingsRow.repair_batch_size)))
    : 50;

  const envBatch = process.env.CF_MIRROR_REPAIR_BATCH ? Number(process.env.CF_MIRROR_REPAIR_BATCH) : null;
  const effectiveBatch =
    envBatch != null && Number.isFinite(envBatch) ? Math.min(250, Math.max(10, envBatch)) : repairBatch;

  const payload = raw as {
    counts?: MirrorDashboardStats["counts"];
    by_source?: Record<string, number>;
    recent_failures?: MirrorDashboardStats["recent_failures"];
    top_pending_by_store?: MirrorDashboardStats["top_pending_by_store"];
  };

  const repairQueue = Number(payload.counts?.repair_queue ?? 0);
  const estimated_batches_remaining =
    repairQueue === 0 ? 0 : Math.ceil(repairQueue / Math.max(1, effectiveBatch));

  const body: MirrorDashboardStats = {
    counts: {
      total_rows: Number(payload.counts?.total_rows ?? 0),
      ready: Number(payload.counts?.ready ?? 0),
      pending: Number(payload.counts?.pending ?? 0),
      failed: Number(payload.counts?.failed ?? 0),
      deleting: Number(payload.counts?.deleting ?? 0),
      distinct_cf_images: Number(payload.counts?.distinct_cf_images ?? 0),
      repair_queue: repairQueue,
    },
    by_source: payload.by_source ?? {},
    recent_failures: Array.isArray(payload.recent_failures) ? payload.recent_failures : [],
    top_pending_by_store: Array.isArray(payload.top_pending_by_store) ? payload.top_pending_by_store : [],
    repair_batch_size: effectiveBatch,
    repair_cron_schedule: "*/15 * * * * (every 15 minutes)",
    estimated_batches_remaining,
  };

  return res.status(200).json(body);
}
