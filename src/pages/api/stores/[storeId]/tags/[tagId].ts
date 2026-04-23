import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { wooRequest, getStoreCreds } from "@/lib/woo-client";
import type { Database } from "@/integrations/supabase/helpers";

type Json = Database["public"]["Tables"]["tags"]["Row"]["raw_data"];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { storeId, tagId } = req.query;
  if (typeof storeId !== "string" || typeof tagId !== "string") {
    return res.status(400).json({ error: "storeId and tagId required" });
  }

  const creds = await getStoreCreds(storeId);
  if (!creds) return res.status(400).json({ error: "Store credentials missing" });

  const { data: tag, error: fetchErr } = await supabaseAdmin
    .from("tags")
    .select("*")
    .eq("id", tagId)
    .eq("store_id", storeId)
    .single();
  if (fetchErr || !tag) return res.status(404).json({ error: "Tag not found" });

  if (req.method === "PUT") {
    const updates = req.body as Record<string, unknown>;
    try {
      const wooResponse = await wooRequest<Record<string, unknown>>(
        creds,
        "PUT",
        `products/tags/${tag.woo_id}`,
        updates
      );

      const mapped = {
        name: (wooResponse.name as string) ?? tag.name,
        slug: (wooResponse.slug as string) ?? tag.slug,
        description: (wooResponse.description as string) ?? tag.description,
        count: (wooResponse.count as number) ?? tag.count,
        raw_data: wooResponse as unknown as Json,
        synced_at: new Date().toISOString(),
      };

      const { data: updated, error: updateErr } = await supabaseAdmin
        .from("tags")
        .update(mapped)
        .eq("id", tagId)
        .select("*")
        .single();
      if (updateErr) throw updateErr;

      await supabaseAdmin.from("entity_changes").insert({
        store_id: storeId,
        entity_type: "tag",
        entity_id: tagId,
        entity_name: mapped.name,
        woo_id: tag.woo_id,
        change_type: "update",
        source: "dashboard",
        status: "success",
        snapshot_before: tag as unknown as Json,
        snapshot_after: updated as unknown as Json,
        changed_fields: updates as unknown as Json,
      });

      return res.status(200).json(updated);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      await supabaseAdmin.from("entity_changes").insert({
        store_id: storeId,
        entity_type: "tag",
        entity_id: tagId,
        entity_name: tag.name,
        woo_id: tag.woo_id,
        change_type: "update",
        source: "dashboard",
        status: "failed",
        error_message: message,
        retry_payload: updates as unknown as Json,
        snapshot_before: tag as unknown as Json,
      });
      return res.status(500).json({ error: "Failed to update tag", message });
    }
  }

  if (req.method === "DELETE") {
    try {
      await wooRequest(creds, "DELETE", `products/tags/${tag.woo_id}?force=true`);
      await supabaseAdmin.from("tags").delete().eq("id", tagId);
      await supabaseAdmin.from("entity_changes").insert({
        store_id: storeId,
        entity_type: "tag",
        entity_id: tagId,
        entity_name: tag.name,
        woo_id: tag.woo_id,
        change_type: "delete",
        source: "dashboard",
        status: "success",
        snapshot_before: tag as unknown as Json,
      });
      return res.status(200).json({ success: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      await supabaseAdmin.from("entity_changes").insert({
        store_id: storeId,
        entity_type: "tag",
        entity_id: tagId,
        entity_name: tag.name,
        woo_id: tag.woo_id,
        change_type: "delete",
        source: "dashboard",
        status: "failed",
        error_message: message,
        snapshot_before: tag as unknown as Json,
      });
      return res.status(500).json({ error: "Failed to delete tag", message });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}