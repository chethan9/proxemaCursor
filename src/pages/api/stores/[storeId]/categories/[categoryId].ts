import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { wooRequest } from "@/lib/woo-client";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { storeId, categoryId } = req.query;
  if (typeof storeId !== "string" || typeof categoryId !== "string") {
    return res.status(400).json({ error: "storeId and categoryId required" });
  }

  const { data: category, error: fetchErr } = await supabaseAdmin
    .from("categories")
    .select("*")
    .eq("id", categoryId)
    .eq("store_id", storeId)
    .single();
  if (fetchErr || !category) return res.status(404).json({ error: "Category not found" });

  if (req.method === "PUT") {
    const updates = req.body as Record<string, unknown>;
    try {
      const wooResponse = await wooRequest<Record<string, unknown>>(
        storeId,
        "PUT",
        `products/categories/${category.woo_id}`,
        updates
      );

      const mapped = {
        name: (wooResponse.name as string) ?? category.name,
        slug: (wooResponse.slug as string) ?? category.slug,
        description: (wooResponse.description as string) ?? category.description,
        parent_id: (wooResponse.parent as number) ?? category.parent_id,
        count: (wooResponse.count as number) ?? category.count,
        raw_data: wooResponse,
        synced_at: new Date().toISOString(),
      };

      const { data: updated, error: updateErr } = await supabaseAdmin
        .from("categories")
        .update(mapped)
        .eq("id", categoryId)
        .select("*")
        .single();
      if (updateErr) throw updateErr;

      await supabaseAdmin.from("entity_changes").insert({
        store_id: storeId,
        entity_type: "category",
        entity_id: categoryId,
        entity_name: mapped.name,
        woo_id: category.woo_id,
        change_type: "update",
        source: "dashboard",
        status: "success",
        snapshot_before: category,
        snapshot_after: updated,
        changed_fields: updates,
      });

      return res.status(200).json(updated);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      await supabaseAdmin.from("entity_changes").insert({
        store_id: storeId,
        entity_type: "category",
        entity_id: categoryId,
        entity_name: category.name,
        woo_id: category.woo_id,
        change_type: "update",
        source: "dashboard",
        status: "failed",
        error_message: message,
        retry_payload: updates,
        snapshot_before: category,
      });
      return res.status(500).json({ error: "Failed to update category", message });
    }
  }

  if (req.method === "DELETE") {
    try {
      await wooRequest(storeId, "DELETE", `products/categories/${category.woo_id}?force=true`);
      await supabaseAdmin.from("categories").delete().eq("id", categoryId);
      await supabaseAdmin.from("entity_changes").insert({
        store_id: storeId,
        entity_type: "category",
        entity_id: categoryId,
        entity_name: category.name,
        woo_id: category.woo_id,
        change_type: "delete",
        source: "dashboard",
        status: "success",
        snapshot_before: category,
      });
      return res.status(200).json({ success: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      await supabaseAdmin.from("entity_changes").insert({
        store_id: storeId,
        entity_type: "category",
        entity_id: categoryId,
        entity_name: category.name,
        woo_id: category.woo_id,
        change_type: "delete",
        source: "dashboard",
        status: "failed",
        error_message: message,
        snapshot_before: category,
      });
      return res.status(500).json({ error: "Failed to delete category", message });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}