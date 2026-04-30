import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { isAdminRole, resolveUserFromRequest } from "@/lib/server-auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const me = await resolveUserFromRequest(req);
  if (!me) return res.status(401).json({ error: "Unauthorized" });
  if (!isAdminRole(me.role)) return res.status(403).json({ error: "Forbidden" });

  const status = String(req.query.status || "pending");
  const validStatuses = new Set(["pending", "approved", "rejected", "paid", "canceled", "all"]);
  if (!validStatuses.has(status)) return res.status(400).json({ error: "Invalid status" });

  let query = supabaseAdmin
    .from("referral_payout_requests")
    .select(`*, clients:referrer_client_id ( id, name )`)
    .order("created_at", { ascending: false })
    .limit(200);
  if (status !== "all") query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ data: data || [] });
}
