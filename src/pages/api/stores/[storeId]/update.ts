import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { logActivity } from "@/lib/activity-log";
import { buildFieldDiffs, capFieldDiffs } from "@/lib/audit/diff-engine";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST" && req.method !== "PATCH") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { storeId } = req.query;
  if (typeof storeId !== "string") {
    return res.status(400).json({ error: "Invalid storeId" });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  const token = authHeader.slice(7);
  const { data: userRes, error: userErr } = await supabaseAdmin.auth.getUser(token);
  if (userErr || !userRes.user) {
    return res.status(401).json({ error: "Invalid token" });
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role, client_id")
    .eq("id", userRes.user.id)
    .single();

  if (!profile) return res.status(403).json({ error: "Profile not found" });

  const { data: store } = await supabaseAdmin
    .from("stores")
    .select("*")
    .eq("id", storeId)
    .single();

  if (!store) return res.status(404).json({ error: "Store not found" });

  const isSuperAdmin = profile.role === "super_admin";
  if (!isSuperAdmin && store.client_id !== profile.client_id) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const patch = req.body || {};
  // Strip fields the caller shouldn't be able to set directly
  delete patch.id;
  delete patch.created_at;

  const { data: updated, error: updErr } = await supabaseAdmin
    .from("stores")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", storeId)
    .select()
    .single();

  if (updErr) {
    console.error("[store-update] error:", updErr);
    return res.status(500).json({ error: updErr.message });
  }

  void logActivity({
    action: "site.update",
    entityType: "store",
    entityId: storeId,
    clientId: updated?.client_id ?? null,
    before: store as Record<string, unknown>,
    after: updated as Record<string, unknown>,
    fieldDiffs: capFieldDiffs(
      buildFieldDiffs(store as Record<string, unknown>, updated as Record<string, unknown>)
    ),
    metadata: { module: "sites" },
    req,
  });

  return res.status(200).json({ store: updated });
}