import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type CategoryRow = Database["public"]["Tables"]["categories"]["Row"];
export type TagRow = Database["public"]["Tables"]["tags"]["Row"];

function wooTermToCategory(t: Record<string, unknown>, storeId: string): CategoryRow {
  return {
    id: `live-${t.id}`,
    store_id: storeId,
    woo_id: (t.id as number) ?? null,
    name: (t.name as string) ?? null,
    slug: (t.slug as string) ?? null,
    parent_id: (t.parent as number) ?? null,
    description: (t.description as string) ?? null,
    display: (t.display as string) ?? null,
    image: t.image as unknown as CategoryRow["image"],
    menu_order: (t.menu_order as number) ?? null,
    count: (t.count as number) ?? null,
    raw_data: t,
    synced_at: null,
    created_at: null,
    updated_at: null,
  } as unknown as CategoryRow;
}

function wooTermToTag(t: Record<string, unknown>, storeId: string): TagRow {
  return {
    id: `live-${t.id}`,
    store_id: storeId,
    woo_id: (t.id as number) ?? null,
    name: (t.name as string) ?? null,
    slug: (t.slug as string) ?? null,
    description: (t.description as string) ?? null,
    count: (t.count as number) ?? null,
    raw_data: t,
    synced_at: null,
    created_at: null,
    updated_at: null,
  } as unknown as TagRow;
}

export async function fetchCategories(storeId: string, search: string, page: number, pageSize = 50, useLive = false) {
  if (useLive) {
    const qs = new URLSearchParams();
    qs.set("page", String(page + 1));
    qs.set("per_page", String(pageSize));
    if (search.trim()) qs.set("search", search.trim());
    const res = await fetch(`/api/stores/${storeId}/live/categories?${qs.toString()}`);
    if (!res.ok) throw new Error(`Live fetch failed (${res.status})`);
    const json = await res.json();
    return { data: (json.data as Record<string, unknown>[]).map((t) => wooTermToCategory(t, storeId)), count: json.count, live: true };
  }
  let query = supabase.from("categories").select("*", { count: "exact" }).eq("store_id", storeId);
  if (search.trim()) query = query.ilike("name", `%${search.trim()}%`);
  query = query.order("name", { ascending: true }).range(page * pageSize, (page + 1) * pageSize - 1);
  const { data, count, error } = await query;
  if (error) throw error;
  return { data: (data || []) as CategoryRow[], count: count || 0 };
}

export async function fetchTags(storeId: string, search: string, page: number, pageSize = 50, useLive = false) {
  if (useLive) {
    const qs = new URLSearchParams();
    qs.set("page", String(page + 1));
    qs.set("per_page", String(pageSize));
    if (search.trim()) qs.set("search", search.trim());
    const res = await fetch(`/api/stores/${storeId}/live/tags?${qs.toString()}`);
    if (!res.ok) throw new Error(`Live fetch failed (${res.status})`);
    const json = await res.json();
    return { data: (json.data as Record<string, unknown>[]).map((t) => wooTermToTag(t, storeId)), count: json.count, live: true };
  }
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