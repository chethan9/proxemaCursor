import type { NextApiRequest, NextApiResponse } from "next";
import { runMirrorProductImagesPipeline } from "@/lib/product-image-mirror.server";

/**
 * Server automation: pending/failed repair + catalog backfill in one invocation.
 * Schedule in vercel.json; protect with CRON_SECRET in production.
 * Replaces separate mirror-product-images + mirror-product-images-backfill schedules.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;
  if (process.env.NODE_ENV === "production" && cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const result = await runMirrorProductImagesPipeline();

  if (process.env.CLOUDFLARE_IMAGE_MIRROR_METRICS === "true") {
    console.log(
      JSON.stringify({
        source: "cf_product_images",
        event: "pipeline_cron",
        ts: new Date().toISOString(),
        repair: result.repair,
        backfill: result.backfill,
        repairLimit: result.repairLimit,
        productLimit: result.productLimit,
      }),
    );
  }

  return res.status(200).json({ ok: true, ...result });
}

export const config = {
  maxDuration: 300,
};
