import type { NextApiRequest, NextApiResponse } from "next";
import { getStoreCreds, wooRequest } from "@/lib/woo-client";
import {
  countGlobalAttributesMirror,
  listGlobalAttributesFromMirror,
  mirrorUpsertAttributeAfterWoo,
  storeHasInitialSyncDone,
} from "@/lib/product-global-attributes-mirror.server";

async function fetchAllAttributesLive(
  store: NonNullable<Awaited<ReturnType<typeof getStoreCreds>>>,
): Promise<Record<string, unknown>[]> {
  const all: Record<string, unknown>[] = [];
  let page = 1;
  while (page < 50) {
    const batch = await wooRequest<Record<string, unknown>[]>(
      store,
      "GET",
      `products/attributes?per_page=100&page=${page}`,
    );
    all.push(...batch);
    if (batch.length < 100) break;
    page++;
  }
  return all;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { storeId: raw } = req.query;
  const storeId = Array.isArray(raw) ? raw[0] : raw;
  if (!storeId) return res.status(400).json({ error: "Missing store id" });

  const store = await getStoreCreds(storeId);
  if (!store) return res.status(404).json({ error: "Store not connected" });

  try {
    if (req.method === "GET") {
      const mirrorOk = await storeHasInitialSyncDone(storeId);
      let mirrorWarmed = false;
      if (mirrorOk) {
        try {
          mirrorWarmed = (await countGlobalAttributesMirror(storeId)) > 0;
          if (mirrorWarmed) {
            const fromDb = await listGlobalAttributesFromMirror(storeId);
            return res.status(200).json(fromDb);
          }
        } catch (e) {
          console.warn("[wc/attributes] mirror read failed, falling back to Woo:", e);
        }
      }
      const data = await fetchAllAttributesLive(store);
      return res.status(200).json(data);
    }
    if (req.method === "POST") {
      const data = await wooRequest<Record<string, unknown>>(store, "POST", "products/attributes", req.body);
      try {
        await mirrorUpsertAttributeAfterWoo(storeId, data);
      } catch (e) {
        console.warn("[wc/attributes] mirror upsert after POST:", e);
      }
      return res.status(200).json(data);
    }
    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : "Failed" });
  }
}
