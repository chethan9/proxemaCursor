import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return res.status(401).json({ error: "Unauthorized" });
  const token = authHeader.slice(7);
  const { data: ud, error: ue } = await supabaseAdmin.auth.getUser(token);
  if (ue || !ud.user) return res.status(401).json({ error: "Unauthorized" });

  const tab = (req.query.tab as string) || "attempts";
  const gateway = req.query.gateway as string | undefined;
  const limit = Math.min(parseInt((req.query.limit as string) || "50", 10), 200);

  let q = supabaseAdmin
    .from("activity_log")
    .select("id, action, entity_type, entity_id, actor_email, actor_type, client_id, metadata, created_at")
    .eq("entity_type", "payment_gateway")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (tab === "attempts") {
    q = q.like("action", "%.charge.%");
  } else if (tab === "webhooks") {
    q = q.like("action", "%.webhook.%");
  } else if (tab === "errors") {
    q = q.or("action.like.%.failed,action.like.%.invalid,action.like.%.error");
  }

  if (gateway && gateway !== "all") {
    q = q.like("action", `${gateway}.%`);
  }

  const { data, error } = await q;
  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json({ items: data || [] });
}
