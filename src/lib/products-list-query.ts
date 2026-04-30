import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProductSortField, SortDirection } from "@/services/productService";

export type CategoryFilterMeta = {
  wooId?: number;
  name: string;
  slug?: string;
};

/** Shared with client list + server export: resolve category row for JSON containment filter. */
export async function getCategoryFilterMeta(
  client: SupabaseClient,
  storeId: string,
  categoryName: string
): Promise<CategoryFilterMeta> {
  const { data } = await client
    .from("categories")
    .select("woo_id,name,slug")
    .eq("store_id", storeId)
    .ilike("name", categoryName)
    .limit(1)
    .maybeSingle();
  return {
    wooId: typeof data?.woo_id === "number" ? data.woo_id : undefined,
    name: (data?.name as string) || categoryName,
    slug: (data?.slug as string) || undefined,
  };
}

export type ProductCatalogListFilters = {
  search?: string;
  statusFilter?: string;
  excludeOutOfStock?: boolean;
  stockStatusFilter?: string;
  priceMin?: number;
  priceMax?: number;
  /** JSON string for `categories` @> containment, or null to skip */
  categoryContainsJson?: string | null;
};

/**
 * Apply catalog list predicates (parent products only, not pending delete).
 * Caller must chain `.from("products").select(...).eq("store_id", storeId)` first.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyProductCatalogFilters(query: any, f: ProductCatalogListFilters): any {
  const typePredicates = ["type.is.null", "type.neq.variation"];
  const pendingPredicates = ["pending_action.is.null", "pending_action.neq.delete"];
  if (f.search && f.search.trim()) {
    const s = f.search.trim();
    const searchFields = ["name", "sku"];
    const clauses: string[] = [];
    for (const t of typePredicates) {
      for (const p of pendingPredicates) {
        for (const field of searchFields) {
          clauses.push(`and(${t},${p},${field}.ilike.%${s}%)`);
        }
      }
    }
    query = query.or(clauses.join(","));
  } else {
    const clauses: string[] = [];
    for (const t of typePredicates) {
      for (const p of pendingPredicates) clauses.push(`and(${t},${p})`);
    }
    query = query.or(clauses.join(","));
  }
  if (f.statusFilter && f.statusFilter !== "all") query = query.eq("status", f.statusFilter);
  if (f.stockStatusFilter && f.stockStatusFilter !== "all") query = query.eq("stock_status", f.stockStatusFilter);
  if (f.excludeOutOfStock) query = query.neq("stock_status", "outofstock");
  if (f.categoryContainsJson) {
    query = query.contains("categories", f.categoryContainsJson);
  }
  if (f.priceMin !== undefined && !Number.isNaN(f.priceMin)) query = query.gte("price", String(f.priceMin));
  if (f.priceMax !== undefined && !Number.isNaN(f.priceMax)) query = query.lte("price", String(f.priceMax));
  return query;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyProductCatalogOrder(query: any, sortField: ProductSortField, sortDirection: SortDirection): any {
  if (sortField === "woo_date_created") {
    return query.order("raw_data->>date_created", { ascending: sortDirection === "asc", nullsFirst: false });
  }
  return query.order(sortField, { ascending: sortDirection === "asc", nullsFirst: false });
}
