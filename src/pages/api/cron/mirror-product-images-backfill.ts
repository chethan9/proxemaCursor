import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { CLOUDFLARE_SETTINGS_SINGLETON_ID } from "@/lib/cloudflare-images-config.server";
import { runMirrorBackfillBatch } from "@/lib/product-image-mirror.server";

/**
 * Paginated backfill: walks all products (by id) and mirrors missing Cloudflare Images rows.
 * Cursor stored on cloudflare_images_settings.mirror_backfill_after_product_id.
 * Env: CF_BACKFILL_PRODUCT_BATCH (default 20, max 80).
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;
  if (process.env.NODE_ENV === "production" && cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const raw = process.env.CF_BACKFILL_PRODUCT_BATCH;
  const parsed = raw ? Number(raw) : 20;
  const productLimit = Number.isFinite(parsed) ? Math.min(80, Math.max(1, parsed)) : 20;

  const { data: row } = await supabaseAdmin
    .from("cloudflare_images_settings")
    .select("mirror_backfill_after_product_id")
    .eq("id", CLOUDFLARE_SETTINGS_SINGLETON_ID)
    .maybeSingle();

  const afterId = row?.mirror_backfill_after_product_id ?? null;

  const result = await runMirrorBackfillBatch({
    afterId,
    productLimit,
  });

  if (result.ok && result.integrationEnabled) {
    await supabaseAdmin
      .from("cloudflare_images_settings")
      .update({
        mirror_backfill_after_product_id: result.hasMore ? result.nextAfterId : null,
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", CLOUDFLARE_SETTINGS_SINGLETON_ID);
  }

  if (process.env.CLOUDFLARE_IMAGE_MIRROR_METRICS === "true") {
    console.log(
      JSON.stringify({
        source: "cf_product_images",
        event: "backfill_cron",
        ts: new Date().toISOString(),
        ...result,
        productLimit,
      })
    );
  }

  return res.status(200).json({ ok: true, ...result, productLimit });
}
