import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { resolveUserFromRequest } from "@/lib/server-auth";
import { logActivity } from "@/lib/activity-log";
import type { TablesInsert } from "@/integrations/supabase/helpers";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const me = await resolveUserFromRequest(req);
  if (!me?.userId || me.role !== "super_admin") {
    return res.status(403).json({ error: "Super admin only" });
  }

  if (req.method === "GET") {
    const { data, error } = await supabaseAdmin.from("ai_features").select("*").order("sort_order", { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ features: data ?? [] });
  }

  if (req.method === "POST") {
    const row = req.body as TablesInsert<"ai_features">;
    if (!row.slug || !row.name || !row.provider || !row.model || !row.prompt_template) {
      return res.status(400).json({ error: "slug, name, provider, model, prompt_template required" });
    }
    const { data, error } = await supabaseAdmin.from("ai_features").insert(row).select("*").single();
    if (error) return res.status(500).json({ error: error.message });

    await logActivity({
      action: "admin.ai_feature.created",
      entityType: "ai_features",
      entityId: data.id,
      actorType: "admin",
      metadata: { module: "admin", slug: data.slug },
      req,
    });

    return res.status(201).json({ feature: data });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
