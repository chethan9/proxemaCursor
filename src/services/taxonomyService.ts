import { supabase } from "@/integrations/supabase/client";
import { authorizedFetch } from "@/lib/api-client";
import type { Database } from "@/integrations/supabase/helpers";

type CategoryRow = Database["public"]["Tables"]["categories"]["Row"];
type TagRow = Database["public"]["Tables"]["tags"]["Row"];
type BrandRow = Database["public"]["Tables"]["brands"]["Row"];

export type TaxonomySortField = "name" | "count" | "created_at";
export type TaxonomySortDirection = "asc" | "desc";

export async function fetchCategories(
  storeId: string,
  search: string,
  page: number,
  pageSize: number,
  sortField: TaxonomySortField = "name",
  sortDirection: TaxonomySortDirection = "asc",
): Promise<{ data: CategoryRow[]; count: number }> {
  let q = supabase.from("categories").select("*", { count: "exact" }).eq("store_id", storeId);
  if (search && search.trim()) {
    const s = search.trim();
    q = q.or(`name.ilike.%${s}%,slug.ilike.%${s}%`);
  }
  q = q.order(sortField, { ascending: sortDirection === "asc", nullsFirst: false });
  q = q.range(page * pageSize, (page + 1) * pageSize - 1);
  const { data, count, error } = await q;
  if (error) throw error;
  return { data: (data || []) as CategoryRow[], count: count || 0 };
}

export async function fetchAllCategories(storeId: string): Promise<CategoryRow[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("store_id", storeId)
    .order("name", { ascending: true });
  if (error) throw error;
  return (data || []) as CategoryRow[];
}

export async function fetchAllTags(storeId: string): Promise<TagRow[]> {
  const { data, error } = await supabase
    .from("tags")
    .select("*")
    .eq("store_id", storeId)
    .order("name", { ascending: true });
  if (error) throw error;
  return (data || []) as TagRow[];
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

export async function fetchTags(
  storeId: string,
  search: string,
  page: number,
  pageSize: number,
  sortField: TaxonomySortField = "name",
  sortDirection: TaxonomySortDirection = "asc",
): Promise<{ data: TagRow[]; count: number }> {
  let q = supabase.from("tags").select("*", { count: "exact" }).eq("store_id", storeId);
  if (search && search.trim()) {
    const s = search.trim();
    q = q.or(`name.ilike.%${s}%,slug.ilike.%${s}%`);
  }
  q = q.order(sortField, { ascending: sortDirection === "asc", nullsFirst: false });
  q = q.range(page * pageSize, (page + 1) * pageSize - 1);
  const { data, count, error } = await q;
  if (error) throw error;
  return { data: (data || []) as TagRow[], count: count || 0 };
}

export async function fetchBrands(
  storeId: string,
  search: string,
  page: number,
  pageSize: number,
  sortField: TaxonomySortField = "name",
  sortDirection: TaxonomySortDirection = "asc",
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

export async function createCategory(storeId: string, payload: { name: string; slug?: string; description?: string; parent?: number }): Promise<void> {
  const res = await authorizedFetch(`/api/stores/${storeId}/categories/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Create failed" }));
    throw new Error(err.error || "Create failed");
  }
}

export async function createTag(storeId: string, payload: { name: string; slug?: string; description?: string }): Promise<void> {
  const res = await authorizedFetch(`/api/stores/${storeId}/tags/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Create failed" }));
    throw new Error(err.error || "Create failed");
  }
}

export async function createBrand(storeId: string, payload: { name: string; slug?: string; description?: string }): Promise<void> {
  const res = await authorizedFetch(`/api/stores/${storeId}/brands/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Create failed" }));
    throw new Error(err.error || "Create failed");
  }
}

export async function updateCategory(
  storeId: string,
  categoryId: string,
  patch: { name?: string; slug?: string; description?: string; parent?: number; menu_order?: number },
) {
  const res = await authorizedFetch(`/api/stores/${storeId}/categories/${categoryId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Update failed" }));
    throw new Error(err.message || err.error || "Update failed");
  }
  return res.json();
}

export async function deleteCategory(storeId: string, categoryId: string) {
  const res = await authorizedFetch(`/api/stores/${storeId}/categories/${categoryId}`, { method: "DELETE" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Delete failed" }));
    throw new Error(err.message || err.error || "Delete failed");
  }
}

export async function updateTag(storeId: string, tagId: string, patch: { name?: string; slug?: string; description?: string }) {
  const res = await authorizedFetch(`/api/stores/${storeId}/tags/${tagId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Update failed" }));
    throw new Error(err.message || err.error || "Update failed");
  }
  return res.json();
}

export async function deleteTag(storeId: string, tagId: string) {
  const res = await authorizedFetch(`/api/stores/${storeId}/tags/${tagId}`, { method: "DELETE" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Delete failed" }));
    throw new Error(err.message || err.error || "Delete failed");
  }
}

export async function updateBrand(storeId: string, brandId: string, patch: { name?: string; slug?: string; description?: string }) {
  const res = await authorizedFetch(`/api/stores/${storeId}/brands/${brandId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Update failed" }));
    throw new Error(err.message || err.error || "Update failed");
  }
  return res.json();
}

export async function deleteBrand(storeId: string, brandId: string) {
  const res = await authorizedFetch(`/api/stores/${storeId}/brands/${brandId}`, { method: "DELETE" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Delete failed" }));
    throw new Error(err.message || err.error || "Delete failed");
  }
}