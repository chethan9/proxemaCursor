import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { wooRequest, getStoreCreds } from "@/lib/woo-client";
import type { Database } from "@/integrations/supabase/helpers";

type Json = Database["public"]["Tables"]["brands"]["Row"]["raw_data"];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { storeId, brandId } = req.query;
  if (typeof storeId !== "string" || typeof brandId !== "string") {
    return res.status(400).json({ error: "storeId and brandId required" });
  }

  const creds = await getStoreCreds(storeId);
  if (!creds) return res.status(400).json({ error: "Store credentials missing" });

  const { data: brand, error: fetchErr } = await supabaseAdmin
    .from("brands")
    .select("*")
    .eq("id", brandId)
    .eq("store_id", storeId)
    .single();
  if (fetchErr || !brand) return res.status(404).json({ error: "Brand not found" });

  if (req.method === "PUT") {
    const updates = req.body as Record<string, unknown>;
    try {
      const wooResponse = await wooRequest<Record<string, unknown>>(
        creds,
        "PUT",
        `products/brands/${brand.woo_id}`,
        updates
      );

      const mapped = {
        name: (wooResponse.name as string) ?? brand.name,
        slug: (wooResponse.slug as string) ?? brand.slug,
        description: (wooResponse.description as string) ?? brand.description,
        count: (wooResponse.count as number) ?? brand.count,
        raw_data: wooResponse as unknown as Json,
        synced_at: new Date().toISOString(),
      };

      const { data: updated, error: updateErr } = await supabaseAdmin
        .from("brands")
        .update(mapped)
        .eq("id", brandId)
        .select("*")
        .single();
      if (updateErr) throw updateErr;

      await supabaseAdmin.from("entity_changes").insert({
        store_id: storeId,
        entity_type: "brand",
        entity_id: brandId,
        entity_name: mapped.name,
        woo_id: brand.woo_id,
        change_type: "update",
        source: "dashboard",
        status: "success",
        snapshot_before: brand as unknown as Json,
        snapshot_after: updated as unknown as Json,
        changed_fields: updates as unknown as Json,
      });

      return res.status(200).json(updated);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      await supabaseAdmin.from("entity_changes").insert({
        store_id: storeId,
        entity_type: "brand",
        entity_id: brandId,
        entity_name: brand.name,
        woo_id: brand.woo_id,
        change_type: "update",
        source: "dashboard",
        status: "failed",
        error_message: message,
        retry_payload: updates as unknown as Json,
        snapshot_before: brand as unknown as Json,
      });
      return res.status(500).json({ error: "Failed to update brand", message });
    }
  }

  if (req.method === "DELETE") {
    try {
      await wooRequest(creds, "DELETE", `products/brands/${brand.woo_id}?force=true`);
      await supabaseAdmin.from("brands").delete().eq("id", brandId);
      await supabaseAdmin.from("entity_changes").insert({
        store_id: storeId,
        entity_type: "brand",
        entity_id: brandId,
        entity_name: brand.name,
        woo_id: brand.woo_id,
        change_type: "delete",
        source: "dashboard",
        status: "success",
        snapshot_before: brand as unknown as Json,
      });
      return res.status(200).json({ success: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      await supabaseAdmin.from("entity_changes").insert({
        store_id: storeId,
        entity_type: "brand",
        entity_id: brandId,
        entity_name: brand.name,
        woo_id: brand.woo_id,
        change_type: "delete",
        source: "dashboard",
        status: "failed",
        error_message: message,
        snapshot_before: brand as unknown as Json,
      });
      return res.status(500).json({ error: "Failed to delete brand", message });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}