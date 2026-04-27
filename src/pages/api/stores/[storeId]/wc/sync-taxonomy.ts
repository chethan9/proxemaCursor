import type { NextApiRequest, NextApiResponse } from "next";
import { getStoreCreds, wooRequest } from "@/lib/woo-client";
import { supabaseAdmin } from "@/integrations/supabase/admin";

const endpointMap: Record<string, string> = {
  categories: "products/categories",
  tags: "products/tags",
  brands: "products/brands",
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { storeId: raw } = req.query;
  const storeId = Array.isArray(raw) ? raw[0] : raw;
  const kind = (req.body?.kind as string) || "";

  if (!storeId) return res.status(400).json({ error: "Missing store id" });
  if (!["categories", "tags", "brands"].includes(kind)) {
    return res.status(400).json({ error: "Invalid kind" });
  }

  const store = await getStoreCreds(storeId);
  if (!store) return res.status(404).json({ error: "Store not connected" });

  const endpoint = endpointMap[kind];
  const table = kind as "categories" | "tags" | "brands";

  try {
    let page = 1;
    let total = 0;
    const all: Record<string, unknown>[] = [];
    while (true) {
      const batch = await wooRequest(store, "GET", `${endpoint}?per_page=100&page=${page}`) as Record<string, unknown>[];
      if (!Array.isArray(batch) || batch.length === 0) break;
      all.push(...batch);
      total += batch.length;
      if (batch.length < 100) break;
      page += 1;
      if (page > 100) break;
    }

    if (all.length > 0) {
      const rows = all.map((d) => {
        const base = {
          store_id: storeId,
          woo_id: d.id as number,
          name: (d.name as string) ?? "",
          slug: (d.slug as string) ?? "",
          description: (d.description as string) ?? null,
          count: (d.count as number) ?? 0,
          raw_data: d as unknown as import("@/integrations/supabase/types").Database["public"]["Tables"]["categories"]["Row"]["raw_data"],
          synced_at: new Date().toISOString(),
        };
        if (kind === "categories") {
          return { ...base, parent_id: (d.parent as number) ?? null };
        }
        return base;
      });
      const chunkSize = 200;
      for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize);
        await supabaseAdmin.from(table).upsert(chunk, { onConflict: "store_id,woo_id" });
      }
    }

    return res.status(200).json({ synced: total });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed";
    if (kind === "brands" && msg.includes("404")) {
      return res.status(404).json({ error: "Brands plugin not installed on this store", brandsUnavailable: true });
    }
    return res.status(500).json({ error: msg });
  }
}