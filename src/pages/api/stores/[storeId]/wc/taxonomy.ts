import type { NextApiRequest, NextApiResponse } from "next";
import { getStoreCreds, wooRequest } from "@/lib/woo-client";
import { supabaseAdmin } from "@/integrations/supabase/admin";

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
  const tableMap: Record<string, "categories" | "tags" | "brands"> = {
    categories: "categories",
    tags: "tags",
    brands: "brands",
  };
  const endpoint = endpointMap[kindStr];
  const table = tableMap[kindStr];

  try {
    if (req.method === "GET") {
      const data = await wooRequest(store, "GET", `${endpoint}?per_page=100`);
      return res.status(200).json(data);
    }
    if (req.method === "POST") {
      const data = await wooRequest(store, "POST", endpoint, req.body) as Record<string, unknown>;
      const wooId = data.id as number | undefined;
      if (wooId) {
        const row = {
          store_id: storeId,
          woo_id: wooId,
          name: (data.name as string) ?? "",
          slug: (data.slug as string) ?? "",
          description: (data.description as string) ?? null,
          count: (data.count as number) ?? 0,
          parent_id: kindStr === "categories" ? ((data.parent as number) ?? null) : null,
          raw_data: data as unknown as import("@/integrations/supabase/types").Database["public"]["Tables"]["categories"]["Row"]["raw_data"],
          synced_at: new Date().toISOString(),
        };
        const { parent_id, ...rest } = row;
        const insertRow = kindStr === "categories" ? row : rest;
        await supabaseAdmin
          .from(table)
          .upsert(insertRow, { onConflict: "store_id,woo_id" })
          .select()
          .maybeSingle();
      }
      return res.status(200).json(data);
    }
    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed";
    if (kindStr === "brands" && msg.includes("404")) {
      return res.status(404).json({ error: "Brands plugin not installed on this store", brandsUnavailable: true });
    }
    return res.status(500).json({ error: msg });
  }
}