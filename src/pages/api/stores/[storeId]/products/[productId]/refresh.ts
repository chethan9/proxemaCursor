import type { NextApiRequest, NextApiResponse } from "next";
import { waitUntil } from "@vercel/functions";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { assertStoreAccess } from "@/lib/assert-store-access";
import { wooProductPayloadToRow } from "@/lib/woo-product-row";
import { getStoreCreds, wooRequest } from "@/lib/woo-client";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { storeId, productId } = req.query;
  if (typeof storeId !== "string" || typeof productId !== "string") {
    return res.status(400).json({ error: "storeId and productId required" });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return res.status(401).json({ error: "Not authenticated" });
  const token = authHeader.slice(7);
  const { data: userRes, error: userErr } = await supabaseAdmin.auth.getUser(token);
  if (userErr || !userRes.user) return res.status(401).json({ error: "Invalid token" });

  const gate = await assertStoreAccess(userRes.user.id, storeId);
  if (gate.allowed === false) return res.status(gate.status).json({ error: gate.message });

  const { data: local, error: lErr } = await supabaseAdmin
    .from("products")
    .select("id, woo_id, store_id")
    .eq("id", productId)
    .eq("store_id", storeId)
    .maybeSingle();

  if (lErr || !local?.woo_id) return res.status(404).json({ error: "Product not found" });

  const store = await getStoreCreds(storeId);
  if (!store) return res.status(400).json({ error: "Store not connected to WooCommerce" });

  try {
    const p = await wooRequest<Record<string, unknown>>(store, "GET", `products/${local.woo_id}`);
    const now = new Date().toISOString();
    const row = wooProductPayloadToRow(storeId, p, now);

    const { error: upErr } = await supabaseAdmin
      .from("products")
      .upsert(row as never, { onConflict: "store_id,woo_id" });
    if (upErr) return res.status(500).json({ error: upErr.message });

    const { data: fresh, error: fErr } = await supabaseAdmin
      .from("products")
      .select("*")
      .eq("id", productId)
      .single();

    if (fErr || !fresh) return res.status(500).json({ error: fErr?.message || "Reload failed" });

    waitUntil(
      (async () => {
        try {
          const { mirrorImagesForProductRow } = await import("@/lib/product-image-mirror.server");
          await mirrorImagesForProductRow(storeId, productId, fresh.images, "sync");
        } catch (e) {
          console.warn("[product refresh] CF mirror:", e);
        }
      })()
    );

    return res.status(200).json(fresh);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Refresh failed";
    return res.status(502).json({ error: msg });
  }
}
