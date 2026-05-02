import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { assertStoreAccess } from "@/lib/assert-store-access";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const storeId = typeof req.query.storeId === "string" ? req.query.storeId : "";
  if (!storeId) return res.status(400).json({ error: "storeId required" });

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return res.status(401).json({ error: "Not authenticated" });
  const token = authHeader.slice(7);
  const { data: userRes, error: userErr } = await supabaseAdmin.auth.getUser(token);
  if (userErr || !userRes.user) return res.status(401).json({ error: "Invalid token" });

  const gate = await assertStoreAccess(userRes.user.id, storeId);
  if (gate.allowed === false) return res.status(gate.status).json({ error: gate.message });

  const { data, error } = await supabaseAdmin
    .from("product_image_mirrors")
    .select("id, status, error, updated_at, created_at, storage_key, src_normalized, cf_image_id, product_id")
    .eq("store_id", storeId)
    .order("updated_at", { ascending: false })
    .limit(50);

  if (error) return res.status(500).json({ error: error.message });

  const list = data || [];
  const productIds = [...new Set(list.map((r) => r.product_id).filter(Boolean))] as string[];
  const nameById = new Map<string, string>();
  if (productIds.length > 0) {
    const { data: prows } = await supabaseAdmin.from("products").select("id, name").in("id", productIds);
    for (const p of prows || []) {
      nameById.set(p.id as string, (p.name as string) || "");
    }
  }

  const rows = list.map((r: Record<string, unknown>) => ({
    id: r.id,
    status: r.status,
    error: r.error,
    updated_at: r.updated_at,
    created_at: r.created_at,
    storage_key: r.storage_key,
    src_normalized: r.src_normalized,
    cf_image_id: r.cf_image_id,
    product_id: r.product_id,
    product_name: nameById.get(String(r.product_id)) ?? null,
  }));

  return res.status(200).json({ rows });
}
