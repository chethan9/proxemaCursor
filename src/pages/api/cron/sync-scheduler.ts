import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/integrations/supabase/client";

// Vercel Cron job - runs every minute to check for stores needing sync
// Configure in vercel.json: { "crons": [{ "path": "/api/cron/sync-scheduler", "schedule": "* * * * *" }] }

interface StoreToSync {
  id: string;
  name: string;
  url: string;
  consumer_key: string;
  consumer_secret: string;
  sync_interval: number;
  next_sync_at: string | null;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Verify cron secret for security (Vercel sets this header)
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;
  
  // In production, verify the cron secret
  if (process.env.NODE_ENV === "production" && cronSecret) {
    if (authHeader !== `Bearer ${cronSecret}`) {
      console.log("[Cron] Unauthorized request");
      return res.status(401).json({ error: "Unauthorized" });
    }
  }

  console.log("[Cron] Sync scheduler started at", new Date().toISOString());

  try {
    // Find all stores with sync_interval set and next_sync_at in the past (or null)
    const now = new Date().toISOString();
    
    const { data: stores, error: storesError } = await supabase
      .from("stores")
      .select("id, name, url, consumer_key, consumer_secret, sync_interval, next_sync_at")
      .not("sync_interval", "is", null)
      .eq("status", "connected")
      .or(`next_sync_at.is.null,next_sync_at.lte.${now}`);

    if (storesError) {
      console.error("[Cron] Error fetching stores:", storesError);
      throw storesError;
    }

    if (!stores || stores.length === 0) {
      console.log("[Cron] No stores due for sync");
      return res.status(200).json({ 
        message: "No stores due for sync",
        checked_at: now,
        stores_synced: 0 
      });
    }

    console.log(`[Cron] Found ${stores.length} store(s) due for sync`);

    const results = [];

    for (const store of stores as StoreToSync[]) {
      // Create cron log entry
      const { data: cronLog, error: logError } = await supabase
        .from("cron_logs")
        .insert({
          job_type: "scheduled_sync",
          store_id: store.id,
          status: "started",
          message: `Scheduled sync started for ${store.name}`,
          metadata: { 
            sync_interval: store.sync_interval,
            trigger: "cron"
          }
        })
        .select()
        .single();

      if (logError) {
        console.error("[Cron] Error creating log:", logError);
      }

      try {
        // Create sync run for each aspect
        const aspects = ["products", "orders", "customers"];
        let totalRecords = 0;

        for (const aspect of aspects) {
          const { data: syncRun, error: syncError } = await supabase
            .from("sync_runs")
            .insert({
              store_id: store.id,
              aspect,
              status: "running",
              started_at: new Date().toISOString(),
            })
            .select()
            .single();

          if (syncError) {
            console.error(`[Cron] Error creating sync run for ${aspect}:`, syncError);
            continue;
          }

          // Simulate sync (in real implementation, this would call WooCommerce API)
          // For now, we'll mark as completed with simulated data
          const recordsProcessed = Math.floor(Math.random() * 50) + 5;
          totalRecords += recordsProcessed;

          await supabase
            .from("sync_runs")
            .update({
              status: "completed",
              completed_at: new Date().toISOString(),
              records_processed: recordsProcessed,
            })
            .eq("id", syncRun.id);
        }

        // Calculate next sync time
        const nextSyncAt = new Date();
        nextSyncAt.setMinutes(nextSyncAt.getMinutes() + (store.sync_interval || 60));

        // Update store's next_sync_at and last_sync_at
        await supabase
          .from("stores")
          .update({
            last_sync_at: new Date().toISOString(),
            next_sync_at: nextSyncAt.toISOString(),
          })
          .eq("id", store.id);

        // Update cron log as completed
        if (cronLog) {
          await supabase
            .from("cron_logs")
            .update({
              status: "completed",
              message: `Scheduled sync completed for ${store.name}. Processed ${totalRecords} records.`,
              completed_at: new Date().toISOString(),
              metadata: {
                sync_interval: store.sync_interval,
                trigger: "cron",
                records_processed: totalRecords,
                next_sync_at: nextSyncAt.toISOString()
              }
            })
            .eq("id", cronLog.id);
        }

        results.push({
          store_id: store.id,
          store_name: store.name,
          status: "completed",
          records_processed: totalRecords,
          next_sync_at: nextSyncAt.toISOString()
        });

        console.log(`[Cron] Completed sync for ${store.name}, next sync at ${nextSyncAt.toISOString()}`);

      } catch (syncError) {
        console.error(`[Cron] Error syncing store ${store.name}:`, syncError);

        // Update cron log as failed
        if (cronLog) {
          await supabase
            .from("cron_logs")
            .update({
              status: "failed",
              error_message: syncError instanceof Error ? syncError.message : "Unknown error",
              completed_at: new Date().toISOString(),
            })
            .eq("id", cronLog.id);
        }

        results.push({
          store_id: store.id,
          store_name: store.name,
          status: "failed",
          error: syncError instanceof Error ? syncError.message : "Unknown error"
        });
      }
    }

    console.log("[Cron] Sync scheduler completed", results);

    return res.status(200).json({
      message: "Sync scheduler completed",
      checked_at: now,
      stores_synced: results.length,
      results
    });

  } catch (error) {
    console.error("[Cron] Sync scheduler error:", error);
    
    // Log the error
    await supabase
      .from("cron_logs")
      .insert({
        job_type: "scheduled_sync",
        status: "failed",
        error_message: error instanceof Error ? error.message : "Unknown error",
        message: "Sync scheduler failed",
      });

    return res.status(500).json({ 
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
}