import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { wooRequest, getStoreCreds } from "@/lib/woo-client";
import type { Database } from "@/integrations/supabase/types";

type Json = Database["public"]["Tables"]["categories"]["Row"]["raw_data"];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const { storeId } = req.query;
  if (typeof storeId !== "string") return res.status(400).json({ error: "storeId required" });

  const creds = await getStoreCreds(storeId);
  if (!creds) return res.status(400).json({ error: "Store credentials missing" });

  const { name, slug, description, parent } = req.body as { name?: string; slug?: string; description?: string; parent?: number };
  if (!name || !name.trim()) return res.status(400).json({ error: "Name is required" });

  try {
    const wooResponse = await wooRequest<Record<string, unknown>>(creds, "POST", "products/categories", {
      name: name.trim(),
      ...(slug ? { slug } : {}),
      ...(description ? { description } : {}),
      ...(parent ? { parent } : {}),
    });

    const row = {
      store_id: storeId,
      woo_id: wooResponse.id as number,
      name: (wooResponse.name as string) ?? name.trim(),
      slug: (wooResponse.slug as string) ?? slug ?? "",
      description: (wooResponse.description as string) ?? description ?? null,
      parent_id: (wooResponse.parent as number) ?? parent ?? 0,
      count: (wooResponse.count as number) ?? 0,
      raw_data: wooResponse as unknown as Json,
      synced_at: new Date().toISOString(),
    };

    const { data: inserted, error: insErr } = await supabaseAdmin
      .from("categories")
      .insert(row)
      .select("*")
      .single();
    if (insErr) throw insErr;

    await supabaseAdmin.from("entity_changes").insert({
      store_id: storeId,
      entity_type: "category",
      entity_id: inserted.id,
      entity_name: row.name,
      woo_id: row.woo_id,
      change_type: "create",
      source: "dashboard",
      status: "success",
      snapshot_after: inserted as unknown as Json,
    });

    return res.status(201).json(inserted);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return res.status(500).json({ error: "Failed to create category", message });
  }
}