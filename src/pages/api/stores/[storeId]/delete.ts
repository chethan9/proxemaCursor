import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { getWooUserAgent } from "@/lib/brand-name-server";
import { logActivity } from "@/lib/activity-log";
import { STORE_DELETE_TOTAL_STEPS } from "@/lib/store-delete-constants";

export type StoreDeleteProgressLine = {
  type: "progress";
  step: number;
  total: number;
  stepKey: string;
};

export type StoreDeleteResult = {
  success: true;
  webhooks_removed: number;
  webhooks_failed: number;
  api_key_removed: boolean;
  api_key_error: string | null;
  record_counts: Record<string, number>;
  details: { id: string; woo_webhook_id: number | null; ok: boolean; error?: string }[];
};

async function runStoreDeletion(
  storeId: string,
  store: Record<string, unknown> & { client_id: string | null; url?: string | null; consumer_key?: string | null; consumer_secret?: string | null },
  req: NextApiRequest,
  emit: ((line: StoreDeleteProgressLine) => void) | null,
): Promise<StoreDeleteResult> {
  const total = STORE_DELETE_TOTAL_STEPS;
  const push = (stepKey: string, step: number) => {
    emit?.({ type: "progress", step, total, stepKey });
  };

  push("audit_linked_data", 1);

  const countTables = ["products", "orders", "customers", "categories", "tags", "coupons", "sync_runs", "webhooks", "deleted_records"] as const;
  const countResults = await Promise.all(
    countTables.map(async (t) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { count } = await (supabaseAdmin as any)
        .from(t)
        .select("id", { count: "exact", head: true })
        .eq("store_id", storeId);
      return [t, count || 0] as const;
    }),
  );
  const recordCounts = Object.fromEntries(countResults) as Record<(typeof countTables)[number], number>;

  push("prepare_webhooks", 2);

  const { data: webhooks } = await supabaseAdmin.from("webhooks").select("*").eq("store_id", storeId);

  const webhookResults: { id: string; woo_webhook_id: number | null; ok: boolean; error?: string }[] = [];
  const ua = await getWooUserAgent();

  push("remove_remote_webhooks", 3);

  if (webhooks && store.consumer_key && store.consumer_secret && store.url) {
    const auth = Buffer.from(`${store.consumer_key}:${store.consumer_secret}`).toString("base64");
    const baseUrl = store.url.replace(/\/$/, "");
    const results = await Promise.all(
      webhooks.map(async (wh) => {
        if (!wh.woo_webhook_id) {
          return { id: wh.id, woo_webhook_id: null, ok: true };
        }
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 5000);
          const resp = await fetch(`${baseUrl}/wp-json/wc/v3/webhooks/${wh.woo_webhook_id}?force=true`, {
            method: "DELETE",
            headers: { Authorization: `Basic ${auth}`, "User-Agent": ua },
            signal: controller.signal,
          });
          clearTimeout(timeout);
          return { id: wh.id, woo_webhook_id: wh.woo_webhook_id, ok: resp.ok };
        } catch (e) {
          return {
            id: wh.id,
            woo_webhook_id: wh.woo_webhook_id,
            ok: false,
            error: e instanceof Error ? e.message : "Unknown error",
          };
        }
      }),
    );
    webhookResults.push(...results);
  }

  push("revoke_api_keys", 4);

  let apiKeyRemoved = false;
  let apiKeyError: string | null = null;
  const wooKeyId = (store as { woo_key_id?: number | null }).woo_key_id ?? null;
  if (wooKeyId && store.consumer_key && store.consumer_secret && store.url) {
    try {
      const auth = Buffer.from(`${store.consumer_key}:${store.consumer_secret}`).toString("base64");
      const baseUrl = store.url.replace(/\/$/, "");
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const resp = await fetch(`${baseUrl}/wp-json/wc/v3/keys/${wooKeyId}?force=true`, {
        method: "DELETE",
        headers: { Authorization: `Basic ${auth}`, "User-Agent": ua },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      apiKeyRemoved = resp.ok;
      if (!resp.ok) apiKeyError = `HTTP ${resp.status}`;
    } catch (e) {
      apiKeyError = e instanceof Error ? e.message : "Unknown error";
    }
  } else if (!wooKeyId) {
    apiKeyError = "No key id tracked (key must be revoked manually in WooCommerce → Advanced → REST API)";
  }

  push("cancel_sync_jobs", 5);

  await supabaseAdmin
    .from("sync_runs")
    .update({
      status: "cancelled",
      completed_at: new Date().toISOString(),
      error_message: "Store deleted",
    })
    .eq("store_id", storeId)
    .eq("status", "running");

  push("cleanup_image_mirrors", 6);

  try {
    const { deleteMirrorsForStore } = await import("@/lib/product-image-mirror.server");
    await deleteMirrorsForStore(storeId);
  } catch (e) {
    console.warn("[store delete] CF mirror cleanup:", e);
  }

  push("delete_database_records", 7);

  const { error: delErr } = await supabaseAdmin.from("stores").delete().eq("id", storeId);

  if (delErr) {
    throw new Error(delErr.message);
  }

  push("write_audit_log", 8);

  await logActivity({
    action: "site.delete",
    entityType: "store",
    entityId: storeId,
    clientId: store.client_id,
    before: store as Record<string, unknown>,
    metadata: {
      webhooks_removed: webhookResults.filter((r) => r.ok).length,
      api_key_removed: apiKeyRemoved,
      record_counts: recordCounts,
    },
    req,
  });

  push("finalize", 9);

  return {
    success: true,
    webhooks_removed: webhookResults.filter((r) => r.ok).length,
    webhooks_failed: webhookResults.filter((r) => !r.ok).length,
    api_key_removed: apiKeyRemoved,
    api_key_error: apiKeyError,
    record_counts: recordCounts as Record<string, number>,
    details: webhookResults,
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "DELETE" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { storeId } = req.query;
  if (typeof storeId !== "string") {
    return res.status(400).json({ error: "Invalid storeId" });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  const token = authHeader.slice(7);
  const { data: userRes, error: userErr } = await supabaseAdmin.auth.getUser(token);
  if (userErr || !userRes.user) {
    return res.status(401).json({ error: "Invalid token" });
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role, client_id")
    .eq("id", userRes.user.id)
    .single();

  if (!profile) return res.status(403).json({ error: "Profile not found" });

  const { data: store } = await supabaseAdmin.from("stores").select("*").eq("id", storeId).single();

  if (!store) return res.status(404).json({ error: "Store not found" });

  const isSuperAdmin = profile.role === "super_admin";
  if (!isSuperAdmin && store.client_id !== profile.client_id) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const wantsNdjson = typeof req.headers.accept === "string" && req.headers.accept.includes("application/x-ndjson");

  if (wantsNdjson) {
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");

    try {
      const result = await runStoreDeletion(storeId, store as never, req, (line) => {
        res.write(`${JSON.stringify(line)}\n`);
      });
      res.write(`${JSON.stringify({ type: "complete", ...result })}\n`);
      res.end();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Delete failed";
      res.write(`${JSON.stringify({ type: "error", message })}\n`);
      res.end();
    }
    return;
  }

  try {
    const result = await runStoreDeletion(storeId, store as never, req, null);
    return res.status(200).json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Delete failed";
    return res.status(500).json({ error: message });
  }
}
