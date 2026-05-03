import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { assertStoreAccess } from "@/lib/assert-store-access";
import { runMirrorBackfillStoreTimeboxed, type MirrorBackfillTimeboxedResult } from "@/lib/product-image-mirror.server";
import { ensureConfiguredVariants } from "@/lib/cloudflare-images.server";
import { getResolvedCloudflareConfig } from "@/lib/cloudflare-images-config.server";

export const maxDuration = 300;
export const config = { maxDuration: 300 };

type SyncAllImagesResponse =
  | (MirrorBackfillTimeboxedResult & {
      ok: true;
      storeId: string;
      maxMs: number;
      fromScratch: boolean;
    })
  | { error: string };

const DEFAULT_MAX_MS = 280_000;

export default async function handler(req: NextApiRequest, res: NextApiResponse<SyncAllImagesResponse>) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const storeId = typeof req.query.storeId === "string" ? req.query.storeId : "";
  if (!storeId) return res.status(400).json({ error: "storeId required" });

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return res.status(401).json({ error: "Not authenticated" });
  const token = authHeader.slice(7);
  const { data: userRes, error: userErr } = await supabaseAdmin.auth.getUser(token);
  if (userErr || !userRes.user) return res.status(401).json({ error: "Invalid token" });

  const gate = await assertStoreAccess(userRes.user.id, storeId);
  if (gate.allowed === false) return res.status(gate.status).json({ error: gate.message });

  const body = (req.body || {}) as {
    fromScratch?: boolean;
    afterId?: string | null;
    maxMs?: number;
    productLimit?: number;
  };

  const fromScratch = body.fromScratch !== false;
  const afterId = fromScratch ? null : typeof body.afterId === "string" && body.afterId.trim() !== "" ? body.afterId.trim() : null;

  const rawMax = body.maxMs ?? Number(process.env.CF_SYNC_ALL_IMAGES_MAX_MS || DEFAULT_MAX_MS);
  const maxMs = Number.isFinite(rawMax) ? Math.min(290_000, Math.max(30_000, rawMax)) : DEFAULT_MAX_MS;

  const rawLimit = body.productLimit ?? Number(process.env.CF_FORCE_SYNC_PRODUCT_LIMIT || 100);
  const productLimit = Number.isFinite(rawLimit) ? Math.min(100, Math.max(1, rawLimit)) : 100;

  const cfg = await getResolvedCloudflareConfig().catch(() => null);
  if (cfg) {
    await ensureConfiguredVariants(cfg).catch((e) => {
      console.warn("[sync-all-images] ensure variants warning", e);
    });
  }

  const result = await runMirrorBackfillStoreTimeboxed(storeId, maxMs, { afterId, productLimit });

  return res.status(200).json({
    ok: true,
    storeId,
    maxMs,
    fromScratch,
    ...result,
  });
}
