import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type CategoryRow = Database["public"]["Tables"]["categories"]["Row"];
export type TagRow = Database["public"]["Tables"]["tags"]["Row"];

export async function fetchCategories(storeId: string, search: string, page: number, pageSize = 50) {
  let query = supabase.from("categories").select("*", { count: "exact" }).eq("store_id", storeId);
  if (search.trim()) query = query.ilike("name", `%${search.trim()}%`);
  query = query.order("name", { ascending: true }).range(page * pageSize, (page + 1) * pageSize - 1);
  const { data, count, error } = await query;
  if (error) throw error;
  return { data: (data || []) as CategoryRow[], count: count || 0 };
}

export async function fetchTags(storeId: string, search: string, page: number, pageSize = 50) {
  let query = supabase.from("tags").select("*", { count: "exact" }).eq("store_id", storeId);
  if (search.trim()) query = query.ilike("name", `%${search.trim()}%`);
  query = query.order("name", { ascending: true }).range(page * pageSize, (page + 1) * pageSize - 1);
  const { data, count, error } = await query;
  if (error) throw error;
  return { data: (data || []) as TagRow[], count: count || 0 };
}

export async function updateCategory(storeId: string, id: string, updates: Record<string, unknown>): Promise<CategoryRow> {
  const res = await fetch(`/api/stores/${storeId}/categories/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.error || `Update failed (${res.status})`);
  }
  return (await res.json()) as CategoryRow;
}

export async function deleteCategory(storeId: string, id: string): Promise<void> {
  const res = await fetch(`/api/stores/${storeId}/categories/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.error || `Delete failed (${res.status})`);
  }
}

export async function updateTag(storeId: string, id: string, updates: Record<string, unknown>): Promise<TagRow> {
  const res = await fetch(`/api/stores/${storeId}/tags/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.error || `Update failed (${res.status})`);
  }
  return (await res.json()) as TagRow;
}

export async function deleteTag(storeId: string, id: string): Promise<void> {
  const res = await fetch(`/api/stores/${storeId}/tags/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.error || `Delete failed (${res.status})`);
  }
}