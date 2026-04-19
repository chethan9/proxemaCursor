import type { NextApiRequest, NextApiResponse } from "next";
import { getStoreCreds, wooRequest } from "@/lib/woo-client";

// Unified endpoint: ?kind=categories|tags|brands with GET list / POST create
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { storeId: raw, kind } = req.query;
  const storeId = Array.isArray(raw) ? raw[0] : raw;
  const kindStr = Array.isArray(kind) ? kind[0] : kind;

  if (!storeId) return res.status(400).json({ error: "Missing store id" });
  if (!kindStr || !["categories", "tags", "brands"].includes(kindStr)) {
    return res.status(400).json({ error: "Invalid kind" });
  }

  const store = await getStoreCreds(storeId);
  if (!store) return res.status(404).json({ error: "Store not connected" });

  const endpointMap: Record<string, string> = {
    categories: "products/categories",
    tags: "products/tags",
    brands: "products/brands",
  };
  const endpoint = endpointMap[kindStr];

  try {
    if (req.method === "GET") {
      const data = await wooRequest(store, "GET", `${endpoint}?per_page=100`);
      return res.status(200).json(data);
    }
    if (req.method === "POST") {
      const data = await wooRequest(store, "POST", endpoint, req.body);
      return res.status(200).json(data);
    }
    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed";
    // Brands plugin may not be installed - surface 404 clearly
    if (kindStr === "brands" && msg.includes("404")) {
      return res.status(404).json({ error: "Brands plugin not installed on this store", brandsUnavailable: true });
    }
    return res.status(500).json({ error: msg });
  }
}