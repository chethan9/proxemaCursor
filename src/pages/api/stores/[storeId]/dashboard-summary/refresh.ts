import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/admin";

/**
 * Recomputes dashboard_summary snapshots for the store (background work).
 * Requires authenticated user with access to the store.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { storeId } = req.query;
  if (typeof storeId !== "string") return res.status(400).json({ error: "Invalid storeId" });

  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "") ?? "";
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return res.status(500).json({ error: "Server misconfigured" });

  const { data: authUser, error: authErr } = await supabaseAdmin.auth.getUser(token);
  if (authErr || !authUser.user) return res.status(401).json({ error: "Unauthorized" });

  const userClient = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: canAccess, error: accessErr } = await userClient.rpc("user_can_access_store", {
    p_store_id: storeId,
  });
  if (accessErr || !canAccess) return res.status(403).json({ error: "Forbidden" });

  const { error } = await supabaseAdmin.rpc("refresh_dashboard_summaries_for_store", {
    p_store_id: storeId,
  });
  if (error) {
    console.error("[dashboard-summary/refresh]", error);
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ ok: true });
}
