import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/integrations/supabase/client";
import { authenticateRequest, logApiRequest } from "@/lib/api-auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const start = Date.now();
  const auth = await authenticateRequest(req);
  if (!auth.valid) return res.status(401).json({ error: auth.error });
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { data, error } = await supabase
      .from("stores")
      .select("id, name, url, status, last_sync_at, next_sync_at, sync_interval, created_at")
      .eq("client_id", auth.clientId!)
      .order("created_at", { ascending: false });
    if (error) throw error;

    await logApiRequest(auth.tokenId, auth.clientId, req, 200, Date.now() - start);
    return res.status(200).json({ data: data || [], total: data?.length || 0 });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : "Server error" });
  }
}