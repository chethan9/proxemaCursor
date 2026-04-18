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

export type RoleKey = string;

export async function getMenuConfig(role: string): Promise<MenuNode[]> {
  const { data, error } = await supabase
    .from("menu_configs")
    .select("config")
    .eq("role", role)
    .maybeSingle();
  if (error) { console.error("getMenuConfig", error); return []; }
  const cfg = data?.config as unknown;
  return Array.isArray(cfg) ? (cfg as MenuNode[]) : [];
}

export async function saveMenuConfig(role: string, config: MenuNode[]): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from("menu_configs").upsert({
    role,
    config: config as unknown as Json,
    updated_at: new Date().toISOString(),
    updated_by: user?.id ?? null,
  }, { onConflict: "role" });
  if (error) throw error;
}

export async function resetMenuConfig(role: string): Promise<void> {
  const { error } = await supabase.from("menu_configs").delete().eq("role", role);
  if (error) throw error;
}