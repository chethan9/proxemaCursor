import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { activityToCsv, type ActivityLogEntry } from "@/services/activityLogService";

const MAX_ROWS = 10_000;

/**
 * GET CSV export for activity the caller is allowed to see (RLS when using user token;
 * super_admin uses service role with same filters).
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).end("Method not allowed");
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

  const { data: prof } = await supabaseAdmin.from("profiles").select("role, client_id").eq("id", userRes.user.id).maybeSingle();
  const isSuper = prof?.role === "super_admin";

  const q = req.query;
  const from = typeof q.from === "string" ? q.from : undefined;
  const to = typeof q.to === "string" ? q.to : undefined;
  const action = typeof q.action === "string" ? q.action : undefined;
  const entityType = typeof q.entity_type === "string" ? q.entity_type : undefined;
  const entityId = typeof q.entity_id === "string" ? q.entity_id : undefined;
  const clientId = typeof q.client_id === "string" ? q.client_id : undefined;
  const actorUserId = typeof q.actor_user_id === "string" ? q.actor_user_id : undefined;
  const auditModule = typeof q.module === "string" ? q.module : undefined;
  const search = typeof q.search === "string" ? q.search.trim() : undefined;

  let query = (isSuper ? supabaseAdmin : authClient)
    .from("activity_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(MAX_ROWS);

  if (!isSuper) {
    if (actorUserId && actorUserId !== userRes.user.id) {
      return res.status(403).json({ error: "Forbidden" });
    }
    if (clientId && clientId !== prof?.client_id) {
      return res.status(403).json({ error: "Forbidden" });
    }
  }

  if (actorUserId) query = query.eq("actor_user_id", actorUserId);
  if (action) query = query.eq("action", action);
  if (entityType) query = query.eq("entity_type", entityType);
  if (entityId) query = query.eq("entity_id", entityId);
  if (clientId) query = query.eq("client_id", clientId);
  if (from) query = query.gte("created_at", from);
  if (to) query = query.lte("created_at", to);
  if (auditModule) {
    query = query.filter("metadata->>module", "eq", auditModule);
  }
  if (search) {
    query = query.or(
      `action.ilike.%${search}%,entity_type.ilike.%${search}%,entity_id.ilike.%${search}%,actor_email.ilike.%${search}%`
    );
  }

  const { data, error } = await query;
  if (error) {
    return res.status(500).json({ error: error.message });
  }

  const rows = (data ?? []) as ActivityLogEntry[];
  const csv = activityToCsv(rows);

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="activity-export-${stamp}.csv"`);
  return res.status(200).send(csv);
}
