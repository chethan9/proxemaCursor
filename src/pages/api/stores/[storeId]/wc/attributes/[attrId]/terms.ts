import type { NextApiRequest, NextApiResponse } from "next";
import { getStoreCreds, wooRequest } from "@/lib/woo-client";
import {
  deleteGlobalAttributeTermMirror,
  getGlobalAttributeFromMirror,
  listGlobalAttributeTermsFromMirror,
  mirrorUpsertTermAfterWoo,
  storeHasInitialSyncDone,
} from "@/lib/product-global-attributes-mirror.server";

async function fetchAllTermsLive(
  store: NonNullable<Awaited<ReturnType<typeof getStoreCreds>>>,
  attrId: string,
): Promise<Record<string, unknown>[]> {
  const all: Record<string, unknown>[] = [];
  let page = 1;
  while (page < 50) {
    const batch = await wooRequest<Record<string, unknown>[]>(
      store,
      "GET",
      `products/attributes/${attrId}/terms?per_page=100&page=${page}`,
    );
    all.push(...batch);
    if (!Array.isArray(batch) || batch.length < 100) break;
    page++;
  }
  return all;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { storeId: s, attrId: a } = req.query;
  const storeId = Array.isArray(s) ? s[0] : s;
  const attrId = Array.isArray(a) ? a[0] : a;
  if (!storeId || !attrId) return res.status(400).json({ error: "Missing params" });

  const store = await getStoreCreds(storeId);
  if (!store) return res.status(404).json({ error: "Store not connected" });

  const aid = typeof attrId === "string" ? Number.parseInt(attrId, 10) : Number.NaN;

  try {
    if (req.method === "GET") {
      const mirrorOk = await storeHasInitialSyncDone(storeId);
      if (mirrorOk && Number.isFinite(aid)) {
        try {
          const attrMirror = await getGlobalAttributeFromMirror(storeId, aid);
          if (attrMirror) {
            const fromDb = await listGlobalAttributeTermsFromMirror(storeId, aid);
            return res.status(200).json(fromDb);
          }
        } catch (e) {
          console.warn("[wc/terms] mirror read failed:", e);
        }
      }
      const all = await fetchAllTermsLive(store, String(attrId));
      return res.status(200).json(all);
    }
    if (req.method === "POST") {
      const data = await wooRequest<Record<string, unknown>>(
        store,
        "POST",
        `products/attributes/${attrId}/terms`,
        req.body,
      );
      if (Number.isFinite(aid)) {
        try {
          await mirrorUpsertTermAfterWoo(storeId, aid, data);
        } catch (e) {
          console.warn("[wc/terms] mirror upsert POST:", e);
        }
      }
      return res.status(200).json(data);
    }
    if (req.method === "PUT") {
      const body = (req.body || {}) as Record<string, unknown>;
      const termId = body.termId as number | undefined;
      if (!termId) return res.status(400).json({ error: "Missing termId" });
      const { termId: _drop, ...payload } = body;
      const data = await wooRequest<Record<string, unknown>>(
        store,
        "PUT",
        `products/attributes/${attrId}/terms/${termId}`,
        payload,
      );
      if (Number.isFinite(aid)) {
        try {
          await mirrorUpsertTermAfterWoo(storeId, aid, data);
        } catch (e) {
          console.warn("[wc/terms] mirror upsert PUT:", e);
        }
      }
      return res.status(200).json(data);
    }
    if (req.method === "DELETE") {
      const q = req.query.termId;
      const fromQuery = typeof q === "string" ? q : Array.isArray(q) ? q[0] : undefined;
      const fromBody = (req.body || {}) as { termId?: number | string };
      const termId = fromQuery ?? fromBody.termId;
      if (termId === undefined || termId === null || termId === "") {
        return res.status(400).json({ error: "Missing termId" });
      }
      const tid = typeof termId === "string" ? Number.parseInt(termId, 10) : Number(termId);
      await wooRequest(store, "DELETE", `products/attributes/${attrId}/terms/${termId}?force=true`);
      if (Number.isFinite(aid) && Number.isFinite(tid)) {
        try {
          await deleteGlobalAttributeTermMirror(storeId, aid, tid);
        } catch (e) {
          console.warn("[wc/terms] mirror delete:", e);
        }
      }
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : "Failed" });
  }
}
