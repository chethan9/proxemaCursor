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