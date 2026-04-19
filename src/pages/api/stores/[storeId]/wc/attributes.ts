import type { NextApiRequest, NextApiResponse } from "next";
import { getStoreCreds, wooRequest } from "@/lib/woo-client";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { storeId: raw } = req.query;
  const storeId = Array.isArray(raw) ? raw[0] : raw;
  if (!storeId) return res.status(400).json({ error: "Missing store id" });

  const store = await getStoreCreds(storeId);
  if (!store) return res.status(404).json({ error: "Store not connected" });

  try {
    if (req.method === "GET") {
      const data = await wooRequest(store, "GET", "products/attributes?per_page=100");
      return res.status(200).json(data);
    }
    if (req.method === "POST") {
      const data = await wooRequest(store, "POST", "products/attributes", req.body);
      return res.status(200).json(data);
    }
    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : "Failed" });
  }
}