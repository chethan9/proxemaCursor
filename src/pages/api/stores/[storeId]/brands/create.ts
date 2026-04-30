import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { wooRequest, getStoreCreds } from "@/lib/woo-client";
import type { Database } from "@/integrations/supabase/helpers";
import { auditSitesMutation } from "@/lib/audit/log";

type Json = Database["public"]["Tables"]["brands"]["Row"]["raw_data"];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const { storeId } = req.query;
  if (typeof storeId !== "string") return res.status(400).json({ error: "storeId required" });

  const creds = await getStoreCreds(storeId);
  if (!creds) return res.status(400).json({ error: "Store credentials missing" });

  const { name, slug, description } = req.body as { name?: string; slug?: string; description?: string };
  if (!name || !name.trim()) return res.status(400).json({ error: "Name is required" });

  try {
    const wooResponse = await wooRequest<Record<string, unknown>>(creds, "POST", "products/brands", {
      name: name.trim(),
      ...(slug ? { slug } : {}),
      ...(description ? { description } : {}),
    });

    const row = {
      store_id: storeId,
      woo_id: wooResponse.id as number,
      name: (wooResponse.name as string) ?? name.trim(),
      slug: (wooResponse.slug as string) ?? slug ?? "",
      description: (wooResponse.description as string) ?? description ?? null,
      count: (wooResponse.count as number) ?? 0,
      raw_data: wooResponse as unknown as Json,
      synced_at: new Date().toISOString(),
    };

    const { data: inserted, error: insErr } = await supabaseAdmin
      .from("brands")
      .insert(row)
      .select("*")
      .single();
    if (insErr) throw insErr;

    await supabaseAdmin.from("entity_changes").insert({
      store_id: storeId,
      entity_type: "brand",
      entity_id: inserted.id,
      entity_name: row.name,
      woo_id: row.woo_id,
      change_type: "create",
      source: "dashboard",
      status: "success",
      snapshot_after: inserted as unknown as Json,
    });

    void auditSitesMutation({
      req,
      action: "brand.create",
      entityType: "brand",
      entityId: inserted.id,
      storeId,
      before: null,
      after: inserted as Record<string, unknown>,
      metadata: { woo_id: row.woo_id },
    });

    return res.status(201).json(inserted);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return res.status(500).json({ error: "Failed to create brand", message });
  }
}