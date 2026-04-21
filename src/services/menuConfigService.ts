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
  displayMode?: "inline" | "panel";
  children?: MenuNode[];
}

export type RoleKey = "super_admin" | "admin" | "user";

export async function getMenuConfig(role: string): Promise<MenuNode[]> {
  const { data, error } = await supabase
    .from("menu_configs")
    .select("config")
    .eq("role", role)
    .is("site_id", null)
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
    .is("site_id", null)
    .maybeSingle();
  const payload = {
    role,
    scope: "global",
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
  const { error } = await supabase.from("menu_configs").delete().eq("role", role).is("site_id", null);
  if (error) throw error;
}

export async function getSiteMenuConfig(role: string, siteId: string | null): Promise<MenuNode[]> {
  let query = supabase.from("menu_configs").select("config").eq("role", role).eq("scope", "site");
  query = siteId ? query.eq("site_id", siteId) : query.is("site_id", null);
  const { data, error } = await query.maybeSingle();
  if (error) { console.error("getSiteMenuConfig", error); return []; }
  const cfg = data?.config as unknown;
  return Array.isArray(cfg) ? (cfg as MenuNode[]) : [];
}

export async function saveSiteMenuConfig(role: string, siteId: string | null, config: MenuNode[]): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  let findQ = supabase.from("menu_configs").select("id").eq("role", role).eq("scope", "site");
  findQ = siteId ? findQ.eq("site_id", siteId) : findQ.is("site_id", null);
  const { data: existing } = await findQ.maybeSingle();
  const payload = {
    role,
    scope: "site",
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
  let query = supabase.from("menu_configs").delete().eq("role", role).eq("scope", "site");
  query = siteId ? query.eq("site_id", siteId) : query.is("site_id", null);
  const { error } = await query;
  if (error) throw error;
}