import type { NextApiRequest, NextApiResponse } from "next";
import { getStoreCreds, wooRequest } from "@/lib/woo-client";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { storeId: s, attrId: a } = req.query;
  const storeId = Array.isArray(s) ? s[0] : s;
  const attrId = Array.isArray(a) ? a[0] : a;
  if (!storeId || !attrId) return res.status(400).json({ error: "Missing params" });

  const store = await getStoreCreds(storeId);
  if (!store) return res.status(404).json({ error: "Store not connected" });

  try {
    if (req.method === "GET") {
      const all: unknown[] = [];
      let page = 1;
      while (page < 20) {
        const batch = await wooRequest<unknown[]>(
          store,
          "GET",
          `products/attributes/${attrId}/terms?per_page=100&page=${page}`
        );
        all.push(...batch);
        if (!Array.isArray(batch) || batch.length < 100) break;
        page++;
      }
      return res.status(200).json(all);
    }
    if (req.method === "POST") {
      const data = await wooRequest(store, "POST", `products/attributes/${attrId}/terms`, req.body);
      return res.status(200).json(data);
    }
    if (req.method === "PUT") {
      const body = (req.body || {}) as Record<string, unknown>;
      const termId = body.termId as number | undefined;
      if (!termId) return res.status(400).json({ error: "Missing termId" });
      const { termId: _drop, ...payload } = body;
      const data = await wooRequest(store, "PUT", `products/attributes/${attrId}/terms/${termId}`, payload);
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
      const data = await wooRequest(store, "DELETE", `products/attributes/${attrId}/terms/${termId}?force=true`);
      return res.status(200).json(data);
    }
    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : "Failed" });
  }
}