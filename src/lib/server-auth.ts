import type { NextApiRequest } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";

export interface ResolvedUser {
  userId: string;
  email: string | null;
  clientId: string | null;
  role: string | null;
}

export async function resolveUserFromRequest(req: NextApiRequest): Promise<ResolvedUser | null> {
  const auth = req.headers.authorization;
  const tokenFromHeader = auth?.startsWith("Bearer ") ? auth.slice(7) : "";
  const tokenFromQuery =
    typeof req.query.access_token === "string" ? req.query.access_token.trim() : "";
  const token = tokenFromHeader || tokenFromQuery;
  if (!token) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return null;

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("client_id, role, email")
    .eq("id", data.user.id)
    .maybeSingle();

  return {
    userId: data.user.id,
    email: data.user.email || profile?.email || null,
    clientId: profile?.client_id ?? null,
    role: profile?.role ?? null,
  };
}

export function isAdminRole(role: string | null | undefined): boolean {
  return role === "super_admin" || role === "admin";
}
