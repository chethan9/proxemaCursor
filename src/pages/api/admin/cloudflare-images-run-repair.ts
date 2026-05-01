import type { NextApiRequest, NextApiResponse } from "next";
import { repairPendingMirrorsBatch } from "@/lib/product-image-mirror.server";
import { resolveUserFromRequest } from "@/lib/server-auth";

/**
 * Manual trigger for the same repair batch as GET /api/cron/mirror-product-images (super admin only).
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const me = await resolveUserFromRequest(req);
  if (!me?.userId || me.role !== "super_admin") {
    return res.status(403).json({ error: "Super admin only" });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const raw = process.env.CF_MIRROR_REPAIR_BATCH;
  const parsed = raw ? Number(raw) : 50;
  const limit = Number.isFinite(parsed) ? Math.min(250, Math.max(10, parsed)) : 50;

  const result = await repairPendingMirrorsBatch(limit);

  if (process.env.CLOUDFLARE_IMAGE_MIRROR_METRICS === "true") {
    console.log(
      JSON.stringify({
        source: "cf_product_images",
        event: "repair_manual",
        ts: new Date().toISOString(),
        userId: me.userId,
        ...result,
      })
    );
  }

  return res.status(200).json({ ok: true, ...result, limit });
}
