import { supabase } from "@/integrations/supabase/client";

export interface ProductRow {
  id: string;
  store_id: string;
  woo_id: number;
  name: string | null;
  slug: string | null;
  sku: string | null;
  status: string | null;
  type: string | null;
  price: string | null;
  regular_price: string | null;
  sale_price: string | null;
  stock_status: string | null;
  stock_quantity: number | null;
  categories: unknown;
  tags: unknown;
  images: unknown;
  featured: boolean | null;
  total_sales: number | null;
  date_created: string | null;
  date_modified: string | null;
  raw_data: unknown;
}

export type ProductSortField = "name" | "date_created" | "date_modified" | "price" | "stock_quantity" | "total_sales";
export type SortDirection = "asc" | "desc";

export interface FetchProductsOptions {
  storeId: string;
  page: number;
  pageSize?: number;
  search?: string;
  sortField?: ProductSortField;
  sortDirection?: SortDirection;
  statusFilter?: string;
}

export async function fetchProducts({
  storeId,
  page,
  pageSize = 50,
  search,
  sortField = "date_created",
  sortDirection = "desc",
  statusFilter,
}: FetchProductsOptions): Promise<{ data: ProductRow[]; count: number }> {
  let query = supabase
    .from("products")
    .select("*", { count: "exact" })
    .eq("store_id", storeId);

  if (search && search.trim()) {
    const s = search.trim();
    query = query.or(`name.ilike.%${s}%,sku.ilike.%${s}%`);
  }

  if (statusFilter && statusFilter !== "all") {
    query = query.eq("status", statusFilter);
  }

  query = query.order(sortField, { ascending: sortDirection === "asc", nullsFirst: false });
  query = query.range(page * pageSize, (page + 1) * pageSize - 1);

  const { data, error, count } = await query;
  if (error) {
    console.error("[productService] fetch error:", error);
    throw error;
  }
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