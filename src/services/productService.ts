import { supabase } from "@/integrations/supabase/client";

export interface ProductRow {
  id: string;
  store_id: string;
  woo_id: number | null;
  name: string | null;
  slug: string | null;
  sku: string | null;
  price: string | number | null;
  regular_price: string | number | null;
  sale_price: string | number | null;
  stock_quantity: number | null;
  stock_status: string | null;
  status: string | null;
  type: string | null;
  description: string | null;
  short_description: string | null;
  categories: unknown;
  images: unknown;
  attributes: unknown;
  raw_data: Record<string, unknown> | null;
  synced_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export type ProductSortField = "name" | "created_at" | "updated_at" | "synced_at" | "price" | "stock_quantity" | "woo_date_created";
export type SortDirection = "asc" | "desc";

export interface FetchProductsOptions {
  storeId: string;
  page: number;
  pageSize?: number;
  search?: string;
  sortField?: ProductSortField;
  sortDirection?: SortDirection;
  statusFilter?: string;
  excludeOutOfStock?: boolean;
  categoryFilter?: string;
  stockStatusFilter?: string;
  priceMin?: number;
  priceMax?: number;
  useLive?: boolean;
}

function wooProductToRow(p: Record<string, unknown>, storeId: string): ProductRow {
  return {
    id: `live-${p.id}`,
    store_id: storeId,
    woo_id: (p.id as number) ?? null,
    name: (p.name as string) ?? null,
    slug: (p.slug as string) ?? null,
    sku: (p.sku as string) ?? null,
    price: (p.price as string) ?? null,
    regular_price: (p.regular_price as string) ?? null,
    sale_price: (p.sale_price as string) ?? null,
    stock_quantity: (p.stock_quantity as number) ?? null,
    stock_status: (p.stock_status as string) ?? null,
    status: (p.status as string) ?? null,
    type: (p.type as string) ?? null,
    description: (p.description as string) ?? null,
    short_description: (p.short_description as string) ?? null,
    categories: p.categories,
    images: p.images,
    attributes: p.attributes,
    raw_data: p,
    synced_at: null,
    created_at: (p.date_created as string) ?? null,
    updated_at: (p.date_modified as string) ?? null,
  };
}

export async function fetchProducts(opts: FetchProductsOptions): Promise<{ data: ProductRow[]; count: number; live?: boolean }> {
  const { storeId, page, pageSize = 50, search, sortField = "woo_date_created", sortDirection = "desc", statusFilter, excludeOutOfStock, categoryFilter, stockStatusFilter, priceMin, priceMax, useLive } = opts;

  if (useLive) {
    const qs = new URLSearchParams();
    qs.set("page", String(page + 1));
    qs.set("per_page", String(pageSize));
    if (search) qs.set("search", search);
    if (statusFilter && statusFilter !== "all") qs.set("status", statusFilter);
    if (stockStatusFilter && stockStatusFilter !== "all") qs.set("stock_status", stockStatusFilter);
    if (priceMin !== undefined) qs.set("min_price", String(priceMin));
    if (priceMax !== undefined) qs.set("max_price", String(priceMax));
    const orderMap: Record<string, string> = { name: "title", price: "price", woo_date_created: "date", created_at: "date", updated_at: "modified" };
    qs.set("orderby", orderMap[sortField] || "date");
    qs.set("order", sortDirection);
    const res = await fetch(`/api/stores/${storeId}/live/products?${qs.toString()}`);
    if (!res.ok) throw new Error(`Live fetch failed (${res.status})`);
    const json = await res.json();
    return { data: (json.data as Record<string, unknown>[]).map((p) => wooProductToRow(p, storeId)), count: json.count, live: true };
  }

  let query = supabase.from("products").select("*", { count: "exact" }).eq("store_id", storeId);
  if (search && search.trim()) {
    const s = search.trim();
    query = query.or(`name.ilike.%${s}%,sku.ilike.%${s}%`);
  }
  if (statusFilter && statusFilter !== "all") query = query.eq("status", statusFilter);
  if (stockStatusFilter && stockStatusFilter !== "all") query = query.eq("stock_status", stockStatusFilter);
  if (excludeOutOfStock) query = query.neq("stock_status", "outofstock");
  if (categoryFilter) query = query.ilike("categories::text", `%"name":"${categoryFilter}"%`);
  if (priceMin !== undefined && !isNaN(priceMin)) query = query.gte("price", String(priceMin));
  if (priceMax !== undefined && !isNaN(priceMax)) query = query.lte("price", String(priceMax));
  if (sortField === "woo_date_created") {
    query = query.order("raw_data->>date_created", { ascending: sortDirection === "asc", nullsFirst: false });
  } else {
    query = query.order(sortField, { ascending: sortDirection === "asc", nullsFirst: false });
  }
  query = query.range(page * pageSize, (page + 1) * pageSize - 1);
  const { data, error, count } = await query;
  if (error) throw error;
  return { data: (data || []) as unknown as ProductRow[], count: count || 0 };
}

export function getProductThumbnail(images: unknown): string | null {
  if (!Array.isArray(images) || images.length === 0) return null;
  const first = images[0] as { src?: string };
  return first?.src || null;
}

export function getCategoryNames(categories: unknown): string {
  if (!Array.isArray(categories) || categories.length === 0) return "";
  return (categories as { name?: string }[]).map((c) => c.name || "").filter(Boolean).join(", ");
}

export async function updateProduct(id: string, updates: Record<string, unknown>): Promise<ProductRow> {
  const { data: product, error: fetchErr } = await supabase.from("products").select("store_id").eq("id", id).single();
  if (fetchErr || !product) throw fetchErr || new Error("Product not found");
  const res = await fetch(`/api/stores/${product.store_id}/products/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.error || `Update failed (${res.status})`);
  }
  return (await res.json()) as ProductRow;
}

export async function getOrFetchProductByWooId(storeId: string, wooId: number): Promise<ProductRow | null> {
  const { data: existing } = await supabase.from("products").select("*").eq("store_id", storeId).eq("woo_id", wooId).maybeSingle();
  if (existing) return existing as unknown as ProductRow;
  const res = await fetch(`/api/stores/${storeId}/products/by-woo/${wooId}`);
  if (!res.ok) return null;
  return (await res.json()) as ProductRow;
}