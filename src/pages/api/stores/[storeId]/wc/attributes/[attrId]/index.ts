import type { NextApiRequest, NextApiResponse } from "next";
import { getStoreCreds, wooRequest } from "@/lib/woo-client";
import {
  deleteGlobalAttributeMirror,
  getGlobalAttributeFromMirror,
  mirrorUpsertAttributeAfterWoo,
  storeHasInitialSyncDone,
} from "@/lib/product-global-attributes-mirror.server";

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
          const row = await getGlobalAttributeFromMirror(storeId, aid);
          if (row) return res.status(200).json(row);
        } catch (e) {
          console.warn("[wc/attributes/id] mirror GET:", e);
        }
      }
      const data = await wooRequest(store, "GET", `products/attributes/${attrId}`);
      return res.status(200).json(data);
    }
    if (req.method === "PUT") {
      const data = await wooRequest<Record<string, unknown>>(store, "PUT", `products/attributes/${attrId}`, req.body);
      try {
        await mirrorUpsertAttributeAfterWoo(storeId, data);
      } catch (e) {
        console.warn("[wc/attributes/id] mirror upsert after PUT:", e);
      }
      return res.status(200).json(data);
    }
    if (req.method === "DELETE") {
      await wooRequest(store, "DELETE", `products/attributes/${attrId}?force=true`);
      if (Number.isFinite(aid)) {
        try {
          await deleteGlobalAttributeMirror(storeId, aid);
        } catch (e) {
          console.warn("[wc/attributes/id] mirror delete:", e);
        }
      }
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : "Failed" });
  }
}
