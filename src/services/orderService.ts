import { supabase } from "@/integrations/supabase/client";
import { authorizedFetch, getBearerAuthHeaders } from "@/lib/api-client";
import type { Database } from "@/integrations/supabase/helpers";
import { normalizeSelectFilter, normalizeSearch } from "@/lib/normalize-explorer-filters";
import { normalizeWooDate } from "@/lib/woo-date";

export type OrderRow = Database["public"]["Tables"]["orders"]["Row"] & {
  refunds?: unknown;
  meta_data?: unknown;
  subtotal?: string | null;
};
export type OrderSortField = "date_created" | "total" | "order_number" | "synced_at" | "created_at" | "status";
export type SortDirection = "asc" | "desc";

/** Columns for list/grid queries — omits heavy JSON blobs; expanded rows use `fetchOrderById`. */
export const ORDER_LIST_SELECT =
  "id, store_id, woo_id, order_number, status, currency, total, subtotal, total_tax, shipping_total, discount_total, payment_method, payment_method_title, customer_id, billing, line_items, date_created, date_modified, synced_at, created_at, pending_action, pending_job_id, pending_at";

export const ORDER_FULL_SELECT =
  "id, store_id, woo_id, order_number, status, currency, total, subtotal, total_tax, shipping_total, discount_total, payment_method, payment_method_title, customer_id, billing, shipping, line_items, shipping_lines, fee_lines, coupon_lines, date_created, date_modified, synced_at, created_at, pending_action, pending_job_id, pending_at";

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
  dateFrom?: string;
  dateTo?: string;
  useLive?: boolean;
  /** Supabase only: list omits shipping / shipping_lines / fee_lines / coupon_lines to shrink payloads. */
  listProjection?: "list" | "full";
}

function toNumericTotal(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const n = Number.parseFloat(value);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function toSortableText(value: unknown): string {
  if (value == null) return "";
  return String(value);
}

function sortOrdersInMemory(rows: OrderRow[], field: OrderSortField, direction: SortDirection): OrderRow[] {
  const dir = direction === "asc" ? 1 : -1;
  const copy = [...rows];
  copy.sort((a, b) => {
    let cmp = 0;
    if (field === "total") {
      cmp = toNumericTotal(a.total) - toNumericTotal(b.total);
    } else if (field === "order_number") {
      cmp = toSortableText(a.order_number).localeCompare(toSortableText(b.order_number), undefined, { numeric: true });
    } else if (field === "status") {
      cmp = toSortableText(a.status).localeCompare(toSortableText(b.status));
    } else if (field === "synced_at") {
      cmp = toSortableText(a.synced_at).localeCompare(toSortableText(b.synced_at));
    } else if (field === "created_at") {
      cmp = toSortableText(a.created_at).localeCompare(toSortableText(b.created_at));
    } else {
      cmp = toSortableText(a.date_created).localeCompare(toSortableText(b.date_created));
    }
    return cmp * dir;
  });
  return copy;
}

function wooOrderToRow(o: Record<string, unknown>, storeId: string): OrderRow {
  return {
    id: `live-${o.id}`,
    store_id: storeId,
    woo_id: (o.id as number) ?? null,
    order_number: (o.number as string) ?? null,
    status: (o.status as string) ?? null,
    currency: (o.currency as string) ?? null,
    total: (o.total as string) ?? null,
    subtotal: null,
    total_tax: (o.total_tax as string) ?? null,
    shipping_total: (o.shipping_total as string) ?? null,
    discount_total: (o.discount_total as string) ?? null,
    payment_method: (o.payment_method as string) ?? null,
    payment_method_title: (o.payment_method_title as string) ?? null,
    transaction_id: (o.transaction_id as string) ?? null,
    customer_id: (o.customer_id as number) ?? null,
    billing: (o.billing as Record<string, unknown>) ?? null,
    shipping: (o.shipping as Record<string, unknown>) ?? null,
    line_items: o.line_items as unknown as OrderRow["line_items"],
    shipping_lines: o.shipping_lines as unknown as OrderRow["shipping_lines"],
    fee_lines: o.fee_lines as unknown as OrderRow["fee_lines"],
    coupon_lines: o.coupon_lines as unknown as OrderRow["coupon_lines"],
    refunds: o.refunds,
    meta_data: o.meta_data,
    customer_note: (o.customer_note as string) ?? null,
    date_created: normalizeWooDate(o.date_created, o.date_created_gmt),
    date_modified: normalizeWooDate(o.date_modified, o.date_modified_gmt),
    date_paid: normalizeWooDate(o.date_paid, o.date_paid_gmt),
    date_completed: normalizeWooDate(o.date_completed, o.date_completed_gmt),
    raw_data: o,
    synced_at: null,
    created_at: normalizeWooDate(o.date_created, o.date_created_gmt),
    updated_at: normalizeWooDate(o.date_modified, o.date_modified_gmt),
  } as unknown as OrderRow;
}

export async function fetchOrders(opts: FetchOrdersOptions): Promise<{ data: OrderRow[]; count: number; live?: boolean }> {
  const {
    storeId,
    page,
    pageSize = 100,
    search,
    sortField = "date_created",
    sortDirection = "desc",
    statusFilter,
    paymentMethodFilter,
    totalMin,
    totalMax,
    dateFrom,
    dateTo,
    useLive,
    listProjection = "list",
  } = opts;
  const effectiveSearch = normalizeSearch(search);
  const effectiveStatus = normalizeSelectFilter(statusFilter);
  const effectivePayment = normalizeSelectFilter(paymentMethodFilter);

  if (useLive) {
    const qs = new URLSearchParams();
    qs.set("page", String(page + 1));
    qs.set("per_page", String(pageSize));
    if (effectiveSearch) qs.set("search", effectiveSearch);
    if (effectiveStatus) qs.set("status", effectiveStatus);
    if (dateFrom) qs.set("after", dateFrom);
    if (dateTo) qs.set("before", dateTo);
    /** WooCommerce REST order list does not support ordering by status; fall back to date. */
    const effectiveSortField = sortField === "status" ? "date_created" : sortField;
    const orderMap: Record<string, string> = {
      date_created: "date",
      total: "total",
      order_number: "id",
      created_at: "date",
      synced_at: "date",
      status: "date",
    };
    qs.set("orderby", orderMap[effectiveSortField] || "date");
    qs.set("order", sortDirection);
    const headers = await getBearerAuthHeaders();
    const res = await fetch(`/api/stores/${storeId}/live/orders?${qs.toString()}`, { headers });
    if (!res.ok) throw new Error(`Live fetch failed (${res.status})`);
    const json = await res.json();
    return { data: (json.data as Record<string, unknown>[]).map((o) => wooOrderToRow(o, storeId)), count: json.count, live: true };
  }

  const projection = listProjection === "full" ? ORDER_FULL_SELECT : ORDER_LIST_SELECT;
  let query = supabase.from("orders").select(projection, { count: "exact" }).eq("store_id", storeId);
  const pendingPredicates = ["pending_action.is.null", "pending_action.neq.delete"];
  if (effectiveSearch) {
    const s = effectiveSearch;
    const fields = [
      "order_number",
      "billing->>email",
      "billing->>first_name",
      "billing->>last_name",
      "billing->>phone",
      "billing->>address_1",
      "billing->>address_2",
      "billing->>city",
      "billing->>state",
      "billing->>postcode",
    ];
    const clauses: string[] = [];
    for (const p of pendingPredicates) {
      for (const f of fields) clauses.push(`and(${p},${f}.ilike.%${s}%)`);
    }
    query = query.or(clauses.join(","));
  } else {
    query = query.or("pending_action.is.null,pending_action.neq.delete");
  }
  if (effectiveStatus) query = query.eq("status", effectiveStatus);
  if (effectivePayment) query = query.eq("payment_method", effectivePayment);
  if (totalMin !== undefined && !isNaN(totalMin)) query = query.gte("total", String(totalMin));
  if (totalMax !== undefined && !isNaN(totalMax)) query = query.lte("total", String(totalMax));
  if (dateFrom) query = query.gte("date_created", dateFrom);
  if (dateTo) query = query.lte("date_created", dateTo);
  const requiresInMemorySort = sortField !== "date_created";
  const dbSortField: OrderSortField = requiresInMemorySort ? "date_created" : sortField;
  query = query.order(dbSortField, { ascending: sortDirection === "asc", nullsFirst: false });
  query = query.range(page * pageSize, (page + 1) * pageSize - 1);
  const { data, count, error } = await query;
  if (error) throw error;
  const rows = (data ?? []) as unknown as OrderRow[];
  const sorted = requiresInMemorySort ? sortOrdersInMemory(rows, sortField, sortDirection) : rows;
  return { data: sorted, count: count ?? 0 };
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

export function getCustomerPhone(billing: unknown): string {
  if (!billing || typeof billing !== "object") return "";
  return (billing as { phone?: string }).phone || "";
}

export function getBillingFirstName(billing: unknown): string {
  if (!billing || typeof billing !== "object") return "";
  return (billing as { first_name?: string }).first_name || "";
}

export function getBillingLastName(billing: unknown): string {
  if (!billing || typeof billing !== "object") return "";
  return (billing as { last_name?: string }).last_name || "";
}

export function getBillingAddress(billing: unknown): string {
  if (!billing || typeof billing !== "object") return "";
  const b = billing as { address_1?: string; address_2?: string; city?: string; state?: string; postcode?: string; country?: string };
  return [b.address_1, b.address_2, b.city, b.state, b.postcode, b.country].filter(Boolean).join(", ");
}

export function getLineItemsSummary(lineItems: unknown): string {
  if (!Array.isArray(lineItems)) return "";
  return lineItems.map((item: unknown) => {
    const i = item as { name?: string; quantity?: number };
    return `${i.name || "—"} × ${i.quantity ?? 0}`;
  }).join(", ");
}

export function getOrderSource(order: { meta_data?: unknown; raw_data?: unknown }): string {
  const meta = (order.meta_data ?? (order.raw_data as { meta_data?: unknown })?.meta_data) as unknown;
  if (!Array.isArray(meta)) return "";
  const keys = ["_wc_order_attribution_utm_source", "utm_source", "_utm_source", "_wc_order_attribution_source_type"];
  for (const k of keys) {
    const hit = meta.find((m: unknown) => (m as { key?: string })?.key === k);
    if (hit) {
      const val = (hit as { value?: unknown }).value;
      if (typeof val === "string" && val) return val;
    }
  }
  return "";
}

export function getItemCount(lineItems: unknown): number {
  if (!Array.isArray(lineItems)) return 0;
  return lineItems.reduce((sum: number, item: unknown) => sum + ((item as { quantity?: number })?.quantity || 0), 0);
}

export async function updateOrderStatus(id: string, status: string): Promise<OrderRow> {
  const { data: order, error: fetchErr } = await supabase.from("orders").select("store_id").eq("id", id).single();
  if (fetchErr || !order) throw fetchErr || new Error("Order not found");
  const res = await authorizedFetch(`/api/stores/${order.store_id}/orders/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.error || `Update failed (${res.status})`);
  }
  return (await res.json()) as OrderRow;
}

export async function fetchOrderById(storeId: string, orderId: string): Promise<OrderRow | null> {
  const { data, error } = await supabase.from("orders").select("*").eq("store_id", storeId).eq("id", orderId).maybeSingle();
  if (error) throw error;
  return data as OrderRow | null;
}

export async function getOrFetchOrderByWooId(storeId: string, wooId: number): Promise<OrderRow | null> {
  const { data: existing } = await supabase.from("orders").select("*").eq("store_id", storeId).eq("woo_id", wooId).maybeSingle();
  if (existing) return existing as unknown as OrderRow;
  const res = await fetch(`/api/stores/${storeId}/orders/by-woo/${wooId}`);
  if (!res.ok) return null;
  return (await res.json()) as OrderRow;
}