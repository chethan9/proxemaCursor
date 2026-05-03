import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { assertStoreAccess } from "@/lib/assert-store-access";

const CUSTOMER_LIST_SELECT =
  "id,store_id,woo_id,email,first_name,last_name,username,role,billing,shipping,avatar_url,orders_count,total_spent,date_created,synced_at,created_at";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const { storeId } = req.query;
  if (typeof storeId !== "string") return res.status(400).json({ error: "Invalid storeId" });

  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  const { data: userRes } = await supabaseAdmin.auth.getUser(token);
  if (!userRes.user) return res.status(401).json({ error: "Unauthorized" });

  const access = await assertStoreAccess(userRes.user.id, storeId);
  if (access.allowed === false) {
    return res.status(access.status).json({ error: access.message });
  }

  const page = Number.parseInt((req.query.page as string) || "0", 10);
  const pageSize = Number.parseInt((req.query.pageSize as string) || "100", 10);
  const includeCount = String(req.query.includeCount || "") === "true";
  const search = (req.query.search as string) || "";
  const sortFieldRaw = (req.query.sortField as string) || "date_created";
  const sortDirectionRaw = ((req.query.sortDirection as string) || "desc").toLowerCase();
  const sortDirection = sortDirectionRaw === "asc" ? "asc" : "desc";
  const sortField = sortFieldRaw === "name" ? "first_name" : sortFieldRaw;

  let q = includeCount
    ? supabaseAdmin.from("customers").select(CUSTOMER_LIST_SELECT, { count: "exact" }).eq("store_id", storeId)
    : supabaseAdmin.from("customers").select(CUSTOMER_LIST_SELECT).eq("store_id", storeId);

  if (search.trim()) {
    const s = search.trim().startsWith("@") ? search.trim().slice(1) : search.trim();
    q = q.or(`first_name.ilike.%${s}%,last_name.ilike.%${s}%,email.ilike.%${s}%,username.ilike.%${s}%,billing->>phone.ilike.%${s}%,billing->>city.ilike.%${s}%`);
  }

  const roleFilter = (req.query.roleFilter as string) || "all";
  if (roleFilter !== "all") {
    if (roleFilter === "guest") q = q.is("woo_id", null);
    else q = q.eq("role", roleFilter);
  }
  const country = req.query.country as string | undefined;
  const city = req.query.city as string | undefined;
  const state = req.query.state as string | undefined;
  const minOrders = Number.parseInt((req.query.minOrders as string) || "0", 10);
  const minSpent = Number.parseFloat((req.query.minSpent as string) || "0");
  if (country && country !== "all") q = q.eq("billing->>country", country);
  if (city) q = q.ilike("billing->>city", `%${city}%`);
  if (state) q = q.ilike("billing->>state", `%${state}%`);
  if (Number.isFinite(minOrders) && minOrders > 0) q = q.gte("orders_count", minOrders);
  if (Number.isFinite(minSpent) && minSpent > 0) q = q.gte("total_spent", minSpent);

  q = q.order(sortField, { ascending: sortDirection === "asc", nullsFirst: false });
  q = q.range(page * pageSize, (page + 1) * pageSize - 1);

  const { data, count, error } = await q;
  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ data: data || [], count: count || 0 });
}

