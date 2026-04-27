import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/helpers";

type BrandRow = Database["public"]["Tables"]["brands"]["Row"];

export type BrandSortField = "name" | "count" | "created_at";
export type BrandSortDirection = "asc" | "desc";

export async function fetchBrands(
  storeId: string,
  search: string,
  page: number,
  pageSize: number,
  sortField: BrandSortField = "name",
  sortDirection: BrandSortDirection = "asc",
): Promise<{ data: BrandRow[]; count: number }> {
  let q = supabase.from("brands").select("*", { count: "exact" }).eq("store_id", storeId);
  if (search && search.trim()) {
    const s = search.trim();
    q = q.or(`name.ilike.%${s}%,slug.ilike.%${s}%`);
  }
  q = q.order(sortField, { ascending: sortDirection === "asc", nullsFirst: false });
  q = q.range(page * pageSize, (page + 1) * pageSize - 1);
  const { data, count, error } = await q;
  if (error) throw error;
  return { data: (data || []) as BrandRow[], count: count || 0 };
}

export async function fetchAllBrands(storeId: string): Promise<BrandRow[]> {
  const { data, error } = await supabase
    .from("brands")
    .select("*")
    .eq("store_id", storeId)
    .order("name", { ascending: true });
  if (error) throw error;
  return (data || []) as BrandRow[];
}