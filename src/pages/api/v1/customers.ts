import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin as supabase } from "@/integrations/supabase/admin";
import { authenticateRequest, logApiRequest } from "@/lib/api-auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const start = Date.now();
  const auth = await authenticateRequest(req);
  if (!auth.valid) return res.status(401).json({ error: auth.error });
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { store_id, limit = "50", offset = "0", search } = req.query;
    const { data: stores } = await supabase.from("stores").select("id").eq("client_id", auth.clientId!);
    const storeIds = stores?.map(s => s.id) || [];
    if (storeIds.length === 0) return res.status(200).json({ data: [], total: 0 });

    let query = supabase.from("customers").select("*", { count: "exact" }).in("store_id", storeIds);
    if (store_id && typeof store_id === "string" && storeIds.includes(store_id)) query = query.eq("store_id", store_id);
    if (search && typeof search === "string") query = query.or(`email.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%`);

    const limitNum = Math.min(parseInt(limit as string) || 50, 200);
    const offsetNum = parseInt(offset as string) || 0;
    const { data, count, error } = await query.range(offsetNum, offsetNum + limitNum - 1).order("synced_at", { ascending: false });
    if (error) throw error;

    await logApiRequest(auth.tokenId, auth.clientId, req, 200, Date.now() - start);
    return res.status(200).json({ data: data || [], total: count || 0, limit: limitNum, offset: offsetNum });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : "Server error" });
  }
}