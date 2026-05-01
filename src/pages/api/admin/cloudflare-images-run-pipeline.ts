import type { NextApiRequest, NextApiResponse } from "next";
import { runMirrorProductImagesPipeline } from "@/lib/product-image-mirror.server";
import { resolveUserFromRequest } from "@/lib/server-auth";

/**
 * Manual trigger: same work as GET /api/cron/mirror-product-images-pipeline (super admin only).
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const me = await resolveUserFromRequest(req);
  if (!me?.userId || me.role !== "super_admin") {
    return res.status(403).json({ error: "Super admin only" });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = (typeof req.body === "object" && req.body) || {};
  const repairRaw = (body as { repairLimit?: unknown }).repairLimit;
  const productRaw = (body as { productLimit?: unknown }).productLimit;
  const persistRaw = (body as { persistBackfillCursor?: unknown }).persistBackfillCursor;

  const repairLimit =
    typeof repairRaw === "number" && Number.isFinite(repairRaw)
      ? Math.min(250, Math.max(10, repairRaw))
      : undefined;
  const productLimit =
    typeof productRaw === "number" && Number.isFinite(productRaw)
      ? Math.min(80, Math.max(1, productRaw))
      : undefined;
  const persistBackfillCursor = persistRaw === false ? false : true;

  const result = await runMirrorProductImagesPipeline({
    repairLimit,
    productLimit,
    persistBackfillCursor,
  });

  if (process.env.CLOUDFLARE_IMAGE_MIRROR_METRICS === "true") {
    console.log(
      JSON.stringify({
        source: "cf_product_images",
        event: "pipeline_manual",
        ts: new Date().toISOString(),
        userId: me.userId,
        ...result,
      }),
    );
  }

  return res.status(200).json({ ok: true, ...result });
}

export const config = {
  maxDuration: 300,
};
