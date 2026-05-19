import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { supabaseAdmin as supabase } from "@/integrations/supabase/admin";
import { authenticateRequest, logApiRequest } from "@/lib/api-auth";

function firstQuery(v: string | string[] | undefined): string | undefined {
  if (v === undefined) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

const productsQuerySchema = z.object({
  store_id: z.string().uuid().optional(),
  limit: z.coerce.number().min(1).max(200).optional(),
  offset: z.coerce.number().min(0).optional(),
  search: z.string().max(500).optional(),
  status: z.string().max(64).optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const start = Date.now();
  const auth = await authenticateRequest(req);
  
  if (!auth.valid) {
    await logApiRequest(undefined, undefined, req, 401, Date.now() - start);
    return res.status(401).json({ error: auth.error });
  }

  if (req.method !== "GET") {
    await logApiRequest(auth.tokenId, auth.clientId, req, 405, Date.now() - start);
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const parsed = productsQuerySchema.safeParse({
      store_id: firstQuery(req.query.store_id),
      limit: firstQuery(req.query.limit),
      offset: firstQuery(req.query.offset),
      search: firstQuery(req.query.search),
      status: firstQuery(req.query.status),
    });
    if (!parsed.success) {
      await logApiRequest(auth.tokenId, auth.clientId, req, 400, Date.now() - start);
      return res.status(400).json({ error: "Invalid query parameters", details: parsed.error.flatten() });
    }
    const { store_id, limit = 50, offset = 0, search, status } = parsed.data;
    
    // Get stores owned by this client
    const { data: stores } = await supabase.from("stores").select("id").eq("client_id", auth.clientId!);
    const storeIds = stores?.map(s => s.id) || [];
    
    if (storeIds.length === 0) {
      await logApiRequest(auth.tokenId, auth.clientId, req, 200, Date.now() - start);
      return res.status(200).json({ data: [], total: 0 });
    }

    let query = supabase
      .from("products")
      .select("*", { count: "exact" })
      .in("store_id", storeIds)
      .or("type.is.null,type.neq.variation");
    
    if (store_id && typeof store_id === "string") {
      if (!storeIds.includes(store_id)) {
        await logApiRequest(auth.tokenId, auth.clientId, req, 403, Date.now() - start);
        return res.status(403).json({ error: "Store does not belong to client" });
      }
      query = query.eq("store_id", store_id);
    }
    if (search && typeof search === "string") query = query.ilike("name", `%${search}%`);
    if (status && typeof status === "string") query = query.eq("status", status);
    
    const limitNum = limit;
    const offsetNum = offset;
    
    const { data, count, error } = await query.range(offsetNum, offsetNum + limitNum - 1).order("synced_at", { ascending: false });
    
    if (error) throw error;
    
    await logApiRequest(auth.tokenId, auth.clientId, req, 200, Date.now() - start);
    return res.status(200).json({ data: data || [], total: count || 0, limit: limitNum, offset: offsetNum });
  } catch (error) {
    await logApiRequest(auth.tokenId, auth.clientId, req, 500, Date.now() - start);
    return res.status(500).json({ error: error instanceof Error ? error.message : "Server error" });
  }
}