import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type CustomerRow = Database["public"]["Tables"]["customers"]["Row"];

export type CustomerSortField = "first_name" | "date_created" | "orders_count" | "total_spent" | "email" | "synced_at";
export type SortDirection = "asc" | "desc";

export interface FetchCustomersOptions {
  storeId: string;
  page: number;
  pageSize?: number;
  search?: string;
  sortField?: CustomerSortField;
  sortDirection?: SortDirection;
  country?: string;
  city?: string;
  state?: string;
  minOrders?: number;
  minSpent?: number;
}

export async function fetchCustomers(opts: FetchCustomersOptions): Promise<{ data: CustomerRow[]; count: number }> {
  const { storeId, page, pageSize = 50, search, sortField = "date_created", sortDirection = "desc", country, city, state, minOrders, minSpent } = opts;
  let q = supabase.from("customers").select("*", { count: "exact" }).eq("store_id", storeId);
  if (search && search.trim()) {
    const s = search.trim();
    q = q.or(`first_name.ilike.%${s}%,last_name.ilike.%${s}%,email.ilike.%${s}%,username.ilike.%${s}%,billing->>phone.ilike.%${s}%,billing->>city.ilike.%${s}%`);
  }
  if (country && country !== "all") q = q.eq("billing->>country", country);
  if (city) q = q.ilike("billing->>city", `%${city}%`);
  if (state) q = q.ilike("billing->>state", `%${state}%`);
  if (minOrders !== undefined && minOrders > 0) q = q.gte("orders_count", minOrders);
  if (minSpent !== undefined && minSpent > 0) q = q.gte("total_spent", minSpent);
  q = q.order(sortField, { ascending: sortDirection === "asc", nullsFirst: false });
  q = q.range(page * pageSize, (page + 1) * pageSize - 1);
  const { data, count, error } = await q;
  if (error) throw error;
  return { data: (data || []) as CustomerRow[], count: count || 0 };
}

export async function fetchCustomerById(id: string): Promise<CustomerRow | null> {
  const { data, error } = await supabase.from("customers").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as CustomerRow | null) ?? null;
}

export async function fetchLastOrdersForCustomer(storeId: string, wooCustomerId: number | null, limit = 3) {
  if (!wooCustomerId) return [];
  const { data, error } = await supabase
    .from("orders")
    .select("id,woo_id,order_number,status,total,currency,date_created,payment_method_title,line_items")
    .eq("store_id", storeId)
    .eq("customer_id", wooCustomerId)
    .order("date_created", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function fetchAllOrdersForCustomer(storeId: string, wooCustomerId: number | null, page = 0, pageSize = 25) {
  if (!wooCustomerId) return { data: [], count: 0 };
  const { data, count, error } = await supabase
    .from("orders")
    .select("id,woo_id,order_number,status,total,currency,date_created,payment_method_title,line_items", { count: "exact" })
    .eq("store_id", storeId)
    .eq("customer_id", wooCustomerId)
    .order("date_created", { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1);
  if (error) throw error;
  return { data: data || [], count: count || 0 };
}

export function getCustomerName(c: { first_name?: string | null; last_name?: string | null; username?: string | null; email?: string | null }): string {
  const name = [c.first_name, c.last_name].filter(Boolean).join(" ").trim();
  return name || c.username || c.email || "—";
}

export function getCustomerInitials(c: { first_name?: string | null; last_name?: string | null; email?: string | null }): string {
  const first = c.first_name?.[0] || "";
  const last = c.last_name?.[0] || "";
  const init = (first + last).trim().toUpperCase();
  if (init) return init;
  return (c.email?.[0] || "?").toUpperCase();
}

export function getCustomerBilling(c: CustomerRow): { city?: string; state?: string; country?: string; phone?: string; address_1?: string; address_2?: string; postcode?: string; first_name?: string; last_name?: string } {
  return (c.billing as Record<string, string> | null) || {};
}

export function getCustomerShipping(c: CustomerRow): { city?: string; state?: string; country?: string; address_1?: string; address_2?: string; postcode?: string; first_name?: string; last_name?: string } {
  return (c.shipping as Record<string, string> | null) || {};
}

export function getAOV(c: CustomerRow): number {
  const total = Number(c.total_spent || 0);
  const n = c.orders_count || 0;
  if (!n) return 0;
  return total / n;
}

export async function updateCustomer(id: string, patch: {
  first_name?: string;
  last_name?: string;
  email?: string;
  username?: string;
  billing?: Record<string, string>;
  shipping?: Record<string, string>;
}): Promise<CustomerRow> {
  const { data: cust, error: e0 } = await supabase.from("customers").select("store_id,woo_id").eq("id", id).single();
  if (e0 || !cust) throw e0 || new Error("Customer not found");
  const res = await fetch(`/api/stores/${cust.store_id}/customers/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.error || `Update failed (${res.status})`);
  }
  return (await res.json()) as CustomerRow;
}

export async function deleteCustomer(id: string): Promise<void> {
  const { data: cust, error: e0 } = await supabase.from("customers").select("store_id").eq("id", id).single();
  if (e0 || !cust) throw e0 || new Error("Customer not found");
  const res = await fetch(`/api/stores/${cust.store_id}/customers/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.error || `Delete failed (${res.status})`);
  }
}

export async function createCustomer(storeId: string, payload: {
  email: string;
  first_name?: string;
  last_name?: string;
  username?: string;
  password?: string;
  billing?: Record<string, string>;
  shipping?: Record<string, string>;
}): Promise<CustomerRow> {
  const res = await fetch(`/api/stores/${storeId}/customers/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.error || `Create failed (${res.status})`);
  }
  return (await res.json()) as CustomerRow;
}