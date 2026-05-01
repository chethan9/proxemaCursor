import type { NextApiRequest, NextApiResponse } from "next";
import { repairPendingMirrorsBatch } from "@/lib/product-image-mirror.server";

/**
 * Repairs pending/failed product image mirrors (Cloudflare Images).
 * Schedule in vercel.json; protect with CRON_SECRET in production.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;
  if (process.env.NODE_ENV === "production" && cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const raw = process.env.CF_MIRROR_REPAIR_BATCH;
  const parsed = raw ? Number(raw) : 50;
  const limit = Number.isFinite(parsed) ? Math.min(250, Math.max(10, parsed)) : 50;

  const result = await repairPendingMirrorsBatch(limit);

  if (process.env.CLOUDFLARE_IMAGE_MIRROR_METRICS === "true") {
    console.log(
      JSON.stringify({
        source: "cf_product_images",
        event: "repair_cron",
        ts: new Date().toISOString(),
        ...result,
      })
    );
  }

  return res.status(200).json({ ok: true, ...result, limit });
}
