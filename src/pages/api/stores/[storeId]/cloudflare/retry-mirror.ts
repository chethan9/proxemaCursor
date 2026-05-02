import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { assertStoreAccess } from "@/lib/assert-store-access";
import { mirrorOneImageForProduct } from "@/lib/product-image-mirror.server";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
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

  const mirrorId = typeof req.body?.mirrorId === "string" ? req.body.mirrorId : "";
  if (!mirrorId) return res.status(400).json({ error: "mirrorId required" });

  const { data: row, error } = await supabaseAdmin
    .from("product_image_mirrors")
    .select("id, store_id, product_id, src_normalized, status")
    .eq("id", mirrorId)
    .maybeSingle();

  if (error || !row) return res.status(404).json({ error: "Mirror row not found" });
  if (row.store_id !== storeId) return res.status(403).json({ error: "Forbidden" });

  try {
    await mirrorOneImageForProduct(storeId, row.product_id, row.src_normalized, "repair");
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : "Retry failed" });
  }
}
