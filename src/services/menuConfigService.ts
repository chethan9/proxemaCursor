import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/database.types";

export type MenuNodeType = "item" | "group";

export interface MenuNode {
  id: string;
  type: MenuNodeType;
  label: string;
  icon: string;
  iconColor?: string | null;
  hidden?: boolean;
  children?: MenuNode[];
}

export type RoleKey = "super_admin" | "admin" | "staff" | "readonly";
export type MenuScope = "global" | "site";

export async function getMenuConfig(role: string): Promise<MenuNode[]> {
  const { data, error } = await supabase
    .from("menu_configs")
    .select("config")
    .eq("role", role)
    .eq("scope", "global")
    .maybeSingle();
  if (error) { console.error("getMenuConfig", error); return []; }
  const cfg = data?.config as unknown;
  return Array.isArray(cfg) ? (cfg as MenuNode[]) : [];
}

export async function saveMenuConfig(role: string, config: MenuNode[]): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  const { data: existing } = await supabase
    .from("menu_configs")
    .select("id")
    .eq("role", role)
    .eq("scope", "global")
    .maybeSingle();
  const payload = {
    role,
    scope: "global" as const,
    site_id: null,
    config: config as unknown as Json,
    updated_at: new Date().toISOString(),
    updated_by: user?.id ?? null,
  };
  const { error } = existing
    ? await supabase.from("menu_configs").update(payload).eq("id", existing.id)
    : await supabase.from("menu_configs").insert(payload);
  if (error) throw error;
}

export async function resetMenuConfig(role: string): Promise<void> {
  const { error } = await supabase
    .from("menu_configs")
    .delete()
    .eq("role", role)
    .eq("scope", "global");
  if (error) throw error;
}

// Site-scoped menu config. siteId=null means the default for ALL sites.
export async function getSiteMenuConfigRaw(role: string, siteId: string | null): Promise<MenuNode[]> {
  let query = supabase
    .from("menu_configs")
    .select("config")
    .eq("role", role)
    .eq("scope", "site");
  query = siteId === null ? query.is("site_id", null) : query.eq("site_id", siteId);
  const { data, error } = await query.maybeSingle();
  if (error) { console.error("getSiteMenuConfigRaw", error); return []; }
  const cfg = data?.config as unknown;
  return Array.isArray(cfg) ? (cfg as MenuNode[]) : [];
}

// Resolve for sidebar rendering: per-site override → global-site default → registry defaults
export async function getSiteMenuConfig(role: string, siteId?: string | null): Promise<MenuNode[]> {
  if (siteId) {
    const specific = await getSiteMenuConfigRaw(role, siteId);
    if (specific.length > 0) return specific;
  }
  const fallback = await getSiteMenuConfigRaw(role, null);
  return fallback;
}

export async function saveSiteMenuConfig(role: string, siteId: string | null, config: MenuNode[]): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();

  let existingQuery = supabase
    .from("menu_configs")
    .select("id")
    .eq("role", role)
    .eq("scope", "site");
  existingQuery = siteId === null ? existingQuery.is("site_id", null) : existingQuery.eq("site_id", siteId);
  const { data: existing } = await existingQuery.maybeSingle();

  const payload = {
    role,
    scope: "site" as const,
    site_id: siteId,
    config: config as unknown as Json,
    updated_at: new Date().toISOString(),
    updated_by: user?.id ?? null,
  };
  const { error } = existing
    ? await supabase.from("menu_configs").update(payload).eq("id", existing.id)
    : await supabase.from("menu_configs").insert(payload);
  if (error) throw error;
}

export async function resetSiteMenuConfig(role: string, siteId: string | null): Promise<void> {
  let query = supabase
    .from("menu_configs")
    .delete()
    .eq("role", role)
    .eq("scope", "site");
  query = siteId === null ? query.is("site_id", null) : query.eq("site_id", siteId);
  const { error } = await query;
  if (error) throw error;
}