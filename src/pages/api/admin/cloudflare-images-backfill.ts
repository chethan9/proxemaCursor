import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { CLOUDFLARE_SETTINGS_SINGLETON_ID } from "@/lib/cloudflare-images-config.server";
import { runMirrorBackfillBatch } from "@/lib/product-image-mirror.server";
import { resolveUserFromRequest } from "@/lib/server-auth";
import { logActivity } from "@/lib/activity-log";

/**
 * Super-admin: enqueue/process Cloudflare mirror uploads for products that never received mirror rows
 * (legacy databases). Uses the same pipeline as Woo sync / save. Call repeatedly with afterId until hasMore is false.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const me = await resolveUserFromRequest(req);
  if (!me?.userId || me.role !== "super_admin") {
    return res.status(403).json({ error: "Super admin only" });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = req.body as {
    storeId?: string | null;
    productLimit?: number;
    afterId?: string | null;
    /** Start from the cursor persisted for the scheduled cron (see mirror_backfill_after_product_id). */
    useStoredCursor?: boolean;
    /** Persist nextAfterId after this run (same behavior as the backfill cron). */
    updateStoredCursor?: boolean;
  };

  let afterId: string | null | undefined = body.afterId;

  if (body.useStoredCursor) {
    const { data: row } = await supabaseAdmin
      .from("cloudflare_images_settings")
      .select("mirror_backfill_after_product_id")
      .eq("id", CLOUDFLARE_SETTINGS_SINGLETON_ID)
      .maybeSingle();
    afterId = row?.mirror_backfill_after_product_id ?? null;
  }

  const rawLimit = body.productLimit ?? Number(process.env.CF_BACKFILL_PRODUCT_BATCH || 25);
  const productLimit = Number.isFinite(rawLimit) ? Math.min(80, Math.max(1, rawLimit)) : 25;

  const storeId =
    body.storeId != null && String(body.storeId).trim() !== "" ? String(body.storeId).trim() : null;

  const result = await runMirrorBackfillBatch({
    storeId,
    afterId: afterId ?? null,
    productLimit,
  });

  if (body.updateStoredCursor && result.ok && result.integrationEnabled) {
    const { error: upErr } = await supabaseAdmin
      .from("cloudflare_images_settings")
      .update({
        mirror_backfill_after_product_id: result.hasMore ? result.nextAfterId : null,
        updated_at: new Date().toISOString(),
        updated_by: me.userId,
      } as never)
      .eq("id", CLOUDFLARE_SETTINGS_SINGLETON_ID);
    if (upErr) {
      return res.status(500).json({ error: upErr.message, ...result, productLimit });
    }
  }

  if (result.ok) {
    await logActivity({
      action: "admin.cloudflare_images.backfill",
      entityType: "cloudflare_images_settings",
      entityId: CLOUDFLARE_SETTINGS_SINGLETON_ID,
      actorType: "admin",
      metadata: {
        module: "admin",
        storeId,
        productLimit,
        touched: result.touched,
        skipped: result.skipped,
        errors: result.errors,
        hasMore: result.hasMore,
        updateStoredCursor: Boolean(body.updateStoredCursor),
      },
      req,
    });
  }

  const status = result.ok ? 200 : 500;
  return res.status(status).json({ ok: result.ok, ...result, productLimit });
}
