import { supabaseAdmin } from "@/integrations/supabase/admin";

export type StoreAccess = { allowed: true } | { allowed: false; status: number; message: string };

export async function assertStoreAccess(userId: string, storeId: string): Promise<StoreAccess> {
  const { data: profile } = await supabaseAdmin.from("profiles").select("role, client_id").eq("id", userId).single();
  if (!profile) return { allowed: false as const, status: 403, message: "Profile not found" };
  const { data: store } = await supabaseAdmin.from("stores").select("id, client_id").eq("id", storeId).single();
  if (!store) return { allowed: false as const, status: 404, message: "Store not found" };
  const isSuperAdmin = profile.role === "super_admin";
  if (!isSuperAdmin && store.client_id !== profile.client_id) {
    return { allowed: false as const, status: 403, message: "Forbidden" };
  }
  return { allowed: true as const };
}
