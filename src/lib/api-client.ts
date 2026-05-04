import { supabase } from "@/integrations/supabase/client";

/**
 * Returns Authorization header for the current Supabase session (client-side).
 * API routes that use `resolveUserFromRequest` / `getUser(token)` require this.
 */
export async function getBearerAuthHeaders(options?: { json?: boolean }): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  const h: Record<string, string> = {};
  if (session?.access_token) {
    h.Authorization = `Bearer ${session.access_token}`;
  }
  if (options?.json) {
    h["Content-Type"] = "application/json";
  }
  return h;
}

/** fetch() with Bearer token merged into init.headers when present. */
export async function authorizedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const auth = await getBearerAuthHeaders();
  const merged = new Headers(init?.headers);
  if (auth.Authorization && !merged.has("Authorization")) {
    merged.set("Authorization", auth.Authorization);
  }
  return fetch(input, { ...init, headers: merged });
}
