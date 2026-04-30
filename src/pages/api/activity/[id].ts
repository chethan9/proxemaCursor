import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/admin";

/**
 * GET single activity row + field-level diffs (RLS applies).
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { id } = req.query;
  if (typeof id !== "string") {
    return res.status(400).json({ error: "id required" });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing authorization" });
  }
  const token = authHeader.slice(7);

  const authClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: userRes, error: userErr } = await authClient.auth.getUser();
  if (userErr || !userRes.user) {
    return res.status(401).json({ error: "Invalid session" });
  }

  const { data: logRow, error: logErr } = await authClient.from("activity_log").select("*").eq("id", id).maybeSingle();
  if (logErr) {
    return res.status(500).json({ error: logErr.message });
  }
  if (!logRow) {
    return res.status(404).json({ error: "Not found" });
  }

  const { data: diffs, error: diffErr } = await authClient
    .from("activity_diff_items")
    .select("id,field_path,before_value,after_value,created_at")
    .eq("activity_log_id", id)
    .order("field_path", { ascending: true });

  if (diffErr) {
    return res.status(500).json({ error: diffErr.message });
  }

  const { data: prof } = await supabaseAdmin.from("profiles").select("role, client_id").eq("id", userRes.user.id).maybeSingle();
  const isSuper = prof?.role === "super_admin";

  return res.status(200).json({
    activity: logRow,
    fieldDiffs: diffs ?? [],
    _meta: { viewer_is_super_admin: isSuper },
  });
}
