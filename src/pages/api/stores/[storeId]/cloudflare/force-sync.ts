import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { assertStoreAccess } from "@/lib/assert-store-access";
import { runMirrorBackfillBatch, type MirrorBackfillBatchResult } from "@/lib/product-image-mirror.server";

export const maxDuration = 300;
export const config = { maxDuration: 300 };

const MAX_ROUNDS = 20;
const MAX_PRODUCT_LIMIT = 100;

type ForceSyncResponse = {
  ok: boolean;
  integrationEnabled: boolean;
  productLimit: number;
  roundsRequested: number;
  roundsRun: number;
  touched: number;
  scanned: number;
  skipped: number;
  errors: number;
  hasMore: boolean;
  nextAfterId: string | null;
  lastBatch: MirrorBackfillBatchResult | null;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse<ForceSyncResponse | { error: string }>) {
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
    afterId?: string | null;
    productLimit?: number;
    rounds?: number;
  };

  const rawLimit = body.productLimit ?? Number(process.env.CF_FORCE_SYNC_PRODUCT_LIMIT || 80);
  const productLimit = Number.isFinite(rawLimit) ? Math.min(MAX_PRODUCT_LIMIT, Math.max(1, rawLimit)) : 80;
  const rawRounds = body.rounds ?? Number(process.env.CF_FORCE_SYNC_ROUNDS || 8);
  const roundsRequested = Number.isFinite(rawRounds) ? Math.min(MAX_ROUNDS, Math.max(1, rawRounds)) : 8;

  let afterId: string | null =
    body.afterId === null || body.afterId === undefined
      ? null
      : typeof body.afterId === "string" && body.afterId.trim() !== ""
        ? body.afterId.trim()
        : null;

  let touched = 0;
  let scanned = 0;
  let skipped = 0;
  let errors = 0;
  let lastBatch: MirrorBackfillBatchResult | null = null;
  let roundsRun = 0;
  let integrationEnabled = true;

  for (let i = 0; i < roundsRequested; i++) {
    const batch = await runMirrorBackfillBatch({
      storeId,
      afterId,
      productLimit,
    });
    lastBatch = batch;
    integrationEnabled = batch.integrationEnabled;
    roundsRun++;

    if (!batch.integrationEnabled) {
      return res.status(200).json({
        ok: true,
        integrationEnabled: false,
        productLimit,
        roundsRequested,
        roundsRun,
        touched: 0,
        scanned: 0,
        skipped: 0,
        errors: 0,
        hasMore: false,
        nextAfterId: null,
        lastBatch: batch,
      });
    }

    if (!batch.ok) {
      return res.status(500).json({ error: "Mirror batch failed" });
    }

    touched += batch.touched;
    scanned += batch.scanned;
    skipped += batch.skipped;
    errors += batch.errors;

    if (!batch.hasMore) {
      return res.status(200).json({
        ok: true,
        integrationEnabled: true,
        productLimit,
        roundsRequested,
        roundsRun,
        touched,
        scanned,
        skipped,
        errors,
        hasMore: false,
        nextAfterId: null,
        lastBatch: batch,
      });
    }

    afterId = batch.nextAfterId;
  }

  return res.status(200).json({
    ok: true,
    integrationEnabled,
    productLimit,
    roundsRequested,
    roundsRun,
    touched,
    scanned,
    skipped,
    errors,
    hasMore: lastBatch?.hasMore ?? false,
    nextAfterId: lastBatch?.nextAfterId ?? null,
    lastBatch,
  });
}
