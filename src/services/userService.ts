import { supabase } from "@/integrations/supabase/client";

async function postAuthLog(action: string, metadata?: Record<string, unknown>) {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;
    await fetch("/api/auth/log-event", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action, metadata: metadata || {} }),
    });
  } catch {}
}

export interface UserProfile {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string;
  client_id: string | null;
  is_active: boolean;
  created_at: string;
}

export async function listUsers(): Promise<UserProfile[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, client_id, is_active, created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as UserProfile[]) || [];
}

export async function updateUserRole(userId: string, role: string) {
  const { error } = await supabase.from("profiles").update({ role }).eq("id", userId);
  if (error) throw error;
  void postAuthLog("auth.role_change", { user_id: userId, role });
}

export async function updateUserClient(userId: string, clientId: string | null) {
  const { error } = await supabase.from("profiles").update({ client_id: clientId }).eq("id", userId);
  if (error) throw error;
}

export async function updateUserActive(userId: string, isActive: boolean) {
  const { error } = await supabase.from("profiles").update({ is_active: isActive }).eq("id", userId);
  if (error) throw error;
}

export async function updateUserName(userId: string, fullName: string) {
  const { error } = await supabase.from("profiles").update({ full_name: fullName }).eq("id", userId);
  if (error) throw error;
}

export interface RoleRow {
  id: string;
  name: string;
  description: string | null;
  permissions: string[];
  is_system: boolean;
  created_at: string;
}

export async function listRoles(): Promise<RoleRow[]> {
  const { data, error } = await supabase
    .from("roles")
    .select("id, name, description, permissions, is_system, created_at")
    .order("is_system", { ascending: false })
    .order("name");
  if (error) throw error;
  return (data as RoleRow[]) || [];
}

export async function createRole(name: string, description: string, permissions: string[]) {
  const { error } = await supabase.from("roles").insert({ name, description, permissions, is_system: false });
  if (error) throw error;
}

export async function updateRole(id: string, updates: { description?: string; permissions?: string[] }) {
  const { error } = await supabase.from("roles").update(updates).eq("id", id);
  if (error) throw error;
}

export async function deleteRole(id: string) {
  const { error } = await supabase.from("roles").delete().eq("id", id);
  if (error) throw error;
}