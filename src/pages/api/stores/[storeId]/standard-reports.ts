import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import type { Database } from "@/integrations/supabase/database.types";

export type StandardReportPublicRow = Pick<
  Database["public"]["Tables"]["standard_reports"]["Row"],
  | "id"
  | "title"
  | "description"
  | "dashboard_url"
  | "sort_order"
  | "icon"
  | "report_group"
  | "provider"
  | "embed_resource_type"
  | "embed_resource_id"
>;

type StoreAccess = { allowed: true } | { allowed: false; status: number; message: string };

async function assertStoreAccess(userId: string, storeId: string): Promise<StoreAccess> {
  const { data: profile } = await supabaseAdmin.from("profiles").select("role, client_id").eq("id", userId).single();
  if (!profile) return { allowed: false, status: 403, message: "Profile not found" };
  const { data: store } = await supabaseAdmin.from("stores").select("id, client_id").eq("id", storeId).single();
  if (!store) return { allowed: false, status: 404, message: "Store not found" };
  const isSuperAdmin = profile.role === "super_admin";
  if (!isSuperAdmin && store.client_id !== profile.client_id) {
    return { allowed: false, status: 403, message: "Forbidden" };
  }
  return { allowed: true };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<StandardReportPublicRow[] | { error: string }>
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const storeId = typeof req.query.storeId === "string" ? req.query.storeId : "";
  if (!storeId) return res.status(400).json({ error: "Missing storeId" });

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return res.status(401).json({ error: "Not authenticated" });
  const token = authHeader.slice(7);
  const { data: userRes, error: userErr } = await supabaseAdmin.auth.getUser(token);
  if (userErr || !userRes.user) return res.status(401).json({ error: "Invalid token" });

  const gate = await assertStoreAccess(userRes.user.id, storeId);
  if (gate.allowed === false) {
    return res.status(gate.status).json({ error: gate.message });
  }

  const { data, error } = await supabaseAdmin
    .from("standard_reports")
    .select(
      "id, title, description, dashboard_url, sort_order, icon, report_group, provider, embed_resource_type, embed_resource_id"
    )
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("title", { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json(data ?? []);
}
