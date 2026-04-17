import { supabase } from "@/integrations/supabase/client";

export interface HealthScore {
  overall: number;
  syncFreshness: number;
  syncSuccessRate: number;
  webhookStatus: number;
  connectivity: number;
  label: "healthy" | "warning" | "critical";
  details: {
    lastSyncAge: number | null;
    recentSyncSuccess: number;
    recentSyncTotal: number;
    activeWebhooks: number;
    totalWebhooks: number;
    lastWebhookEvent: string | null;
  };
}

export async function computeHealthScore(storeId: string): Promise<HealthScore> {
  const now = Date.now();

  // 1. Sync freshness (40% weight) - how recent is the last successful sync?
  const { data: lastSync } = await supabase
    .from("sync_runs")
    .select("completed_at")
    .eq("store_id", storeId)
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let syncFreshness = 0;
  let lastSyncAge: number | null = null;
  if (lastSync?.completed_at) {
    lastSyncAge = Math.floor((now - new Date(lastSync.completed_at).getTime()) / 60000);
    if (lastSyncAge <= 60) syncFreshness = 100;
    else if (lastSyncAge <= 360) syncFreshness = 80;
    else if (lastSyncAge <= 1440) syncFreshness = 60;
    else if (lastSyncAge <= 4320) syncFreshness = 30;
    else syncFreshness = 10;
  }

  // 2. Sync success rate (30% weight) - last 20 runs
  const { data: recentRuns } = await supabase
    .from("sync_runs")
    .select("status")
    .eq("store_id", storeId)
    .order("started_at", { ascending: false })
    .limit(20);

  const recentSyncTotal = recentRuns?.length || 0;
  const recentSyncSuccess = recentRuns?.filter(r => r.status === "completed").length || 0;
  const syncSuccessRate = recentSyncTotal > 0
    ? Math.round((recentSyncSuccess / recentSyncTotal) * 100)
    : 0;

  // 3. Webhook status (20% weight) - active vs total
  const { data: webhooks } = await supabase
    .from("webhooks")
    .select("status")
    .eq("store_id", storeId);

  const totalWebhooks = webhooks?.length || 0;
  const activeWebhooks = webhooks?.filter(w => w.status === "active").length || 0;
  const webhookStatus = totalWebhooks > 0
    ? Math.round((activeWebhooks / totalWebhooks) * 100)
    : 0;

  // 4. Connectivity (10% weight) - recent webhook events
  const { data: lastEvent } = await supabase
    .from("webhook_events")
    .select("created_at")
    .eq("store_id", storeId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let connectivity = 50;
  const lastWebhookEvent = lastEvent?.created_at || null;
  if (lastWebhookEvent) {
    const eventAge = Math.floor((now - new Date(lastWebhookEvent).getTime()) / 60000);
    if (eventAge <= 60) connectivity = 100;
    else if (eventAge <= 1440) connectivity = 80;
    else connectivity = 40;
  } else if (totalWebhooks > 0) {
    connectivity = 30;
  }

  const overall = Math.round(
    syncFreshness * 0.4 +
    syncSuccessRate * 0.3 +
    webhookStatus * 0.2 +
    connectivity * 0.1
  );

  const label: HealthScore["label"] =
    overall >= 70 ? "healthy" : overall >= 40 ? "warning" : "critical";

  return {
    overall,
    syncFreshness,
    syncSuccessRate,
    webhookStatus,
    connectivity,
    label,
    details: {
      lastSyncAge,
      recentSyncSuccess,
      recentSyncTotal,
      activeWebhooks,
      totalWebhooks,
      lastWebhookEvent,
    },
  };
}