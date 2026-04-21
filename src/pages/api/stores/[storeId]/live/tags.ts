import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { wooLiveFetch } from "@/lib/woo-live-fetch";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const { storeId } = req.query;
  if (typeof storeId !== "string") return res.status(400).json({ error: "Invalid storeId" });

  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  const { data: userRes } = await supabaseAdmin.auth.getUser(token);
  if (!userRes.user) return res.status(401).json({ error: "Unauthorized" });

  const { data: store } = await supabaseAdmin.from("stores").select("id").eq("id", storeId).maybeSingle();
  if (!store) return res.status(404).json({ error: "Store not found" });

  try {
    const page = parseInt((req.query.page as string) || "1", 10);
    const perPage = parseInt((req.query.per_page as string) || "50", 10);
    const result = await wooLiveFetch<Record<string, unknown>>(storeId, "products/tags", {
      page,
      per_page: perPage,
      search: req.query.search as string | undefined,
      orderby: "name",
      order: "asc",
    });
    return res.status(200).json({ data: result.data, count: result.total });
  } catch (err) {
    return res.status(502).json({ error: err instanceof Error ? err.message : "Fetch failed" });
  }
}