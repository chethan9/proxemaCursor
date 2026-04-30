import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { resolveUserFromRequest } from "@/lib/server-auth";
import { logActivity } from "@/lib/activity-log";
import type { TablesUpdate } from "@/integrations/supabase/helpers";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const me = await resolveUserFromRequest(req);
  if (!me?.userId || me.role !== "super_admin") {
    return res.status(403).json({ error: "Super admin only" });
  }

  const id = typeof req.query.id === "string" ? req.query.id : "";
  if (!id) return res.status(400).json({ error: "Missing id" });

  if (req.method === "PATCH") {
    const patch = req.body as TablesUpdate<"ai_features">;
    patch.updated_at = new Date().toISOString();
    const { data, error } = await supabaseAdmin.from("ai_features").update(patch).eq("id", id).select("*").single();
    if (error) return res.status(500).json({ error: error.message });

    await logActivity({
      action: "admin.ai_feature.updated",
      entityType: "ai_features",
      entityId: id,
      actorType: "admin",
      metadata: { module: "admin" },
      req,
    });

    return res.status(200).json({ feature: data });
  }

  if (req.method === "DELETE") {
    const { error } = await supabaseAdmin.from("ai_features").delete().eq("id", id);
    if (error) return res.status(500).json({ error: error.message });

    await logActivity({
      action: "admin.ai_feature.deleted",
      entityType: "ai_features",
      entityId: id,
      actorType: "admin",
      metadata: { module: "admin" },
      req,
    });

    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
