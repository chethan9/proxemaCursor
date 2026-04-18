import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type OrderRow = Database["public"]["Tables"]["orders"]["Row"];
export type OrderSortField = "date_created" | "total" | "order_number" | "synced_at" | "created_at";
export type SortDirection = "asc" | "desc";

export interface FetchOrdersOptions {
  storeId: string;
  page: number;
  pageSize?: number;
  search?: string;
  sortField?: OrderSortField;
  sortDirection?: SortDirection;
  statusFilter?: string;
  paymentMethodFilter?: string;
  totalMin?: number;
  totalMax?: number;
}

export async function fetchOrders({
  storeId,
  page,
  pageSize = 50,
  search,
  sortField = "date_created",
  sortDirection = "desc",
  statusFilter,
  paymentMethodFilter,
  totalMin,
  totalMax,
}: FetchOrdersOptions): Promise<{ data: OrderRow[]; count: number }> {
  let query = supabase
    .from("orders")
    .select("*", { count: "exact" })
    .eq("store_id", storeId);

  if (search && search.trim()) {
    const s = search.trim();
    query = query.or(`order_number.ilike.%${s}%,billing->>email.ilike.%${s}%,billing->>first_name.ilike.%${s}%,billing->>last_name.ilike.%${s}%`);
  }

  if (statusFilter && statusFilter !== "all") {
    query = query.eq("status", statusFilter);
  }

  if (paymentMethodFilter && paymentMethodFilter !== "all") {
    query = query.eq("payment_method", paymentMethodFilter);
  }

  if (totalMin !== undefined && !isNaN(totalMin)) {
    query = query.gte("total", String(totalMin));
  }
  if (totalMax !== undefined && !isNaN(totalMax)) {
    query = query.lte("total", String(totalMax));
  }

  query = query.order(sortField, { ascending: sortDirection === "asc", nullsFirst: false });
  query = query.range(page * pageSize, (page + 1) * pageSize - 1);

  const { data, count, error } = await query;
  if (error) throw error;
  return { data: (data || []) as OrderRow[], count: count || 0 };
}

export function getCustomerName(billing: unknown): string {
  if (!billing || typeof billing !== "object") return "—";
  const b = billing as { first_name?: string; last_name?: string; email?: string };
  const name = [b.first_name, b.last_name].filter(Boolean).join(" ").trim();
  return name || b.email || "—";
}

export function getCustomerEmail(billing: unknown): string {
  if (!billing || typeof billing !== "object") return "";
  return (billing as { email?: string }).email || "";
}

export function getItemCount(lineItems: unknown): number {
  if (!Array.isArray(lineItems)) return 0;
  return lineItems.reduce((sum: number, item: unknown) => {
    const qty = (item as { quantity?: number })?.quantity || 0;
    return sum + qty;
  }, 0);
}