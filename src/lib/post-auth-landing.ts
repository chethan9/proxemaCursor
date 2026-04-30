import { supabase } from "@/integrations/supabase/client";
import { hasAccess } from "@/lib/subscription-state";

const ALWAYS_ALLOWED_PREFIXES = [
  "/pricing",
  "/billing",
  "/auth",
  "/settings",
  "/admin",
  "/onboarding",
];

function isAllowedWhenLocked(path: string | null | undefined): boolean {
  if (!path) return false;
  return ALWAYS_ALLOWED_PREFIXES.some((p) => path === p || path.startsWith(p + "/") || path.startsWith(p + "?"));
}

async function fetchEnforcement(): Promise<boolean> {
  const { data } = await supabase
    .from("app_settings")
    .select("billing_enforcement_enabled")
    .eq("id", "global")
    .maybeSingle();
  return data?.billing_enforcement_enabled ?? true;
}

async function fetchClientId(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("profiles")
    .select("client_id")
    .eq("id", userId)
    .maybeSingle();
  return (data?.client_id as string | null) ?? null;
}

async function fetchSubscription(clientId: string) {
  const { data } = await supabase
    .from("subscriptions")
    .select("status, current_period_end, grace_period_days")
    .eq("client_id", clientId)
    .neq("status", "canceled")
    .maybeSingle();
  return data;
}

async function resolvePreferredPath(userId: string, fallback = "/projects"): Promise<string> {
  const { data: prof } = await supabase
    .from("profiles")
    .select("default_landing_path")
    .eq("id", userId)
    .maybeSingle();
  const pref = prof?.default_landing_path?.trim();
  if (!pref) return fallback;
  const siteMatch = pref.match(/^\/sites\/([^/?#]+)/);
  if (siteMatch) {
    const siteId = siteMatch[1];
    const { data: site } = await supabase.from("stores").select("id").eq("id", siteId).maybeSingle();
    if (!site) {
      try { await supabase.from("profiles").update({ default_landing_path: null }).eq("id", userId); } catch {}
      return fallback;
    }
  }
  return pref;
}

export async function resolvePostAuthLanding(
  userId: string,
  options: { redirect?: string | null } = {}
): Promise<string> {
  const requested = options.redirect?.trim() || null;

  const enforcementEnabled = await fetchEnforcement();
  if (!enforcementEnabled) {
    if (requested) return requested;
    return resolvePreferredPath(userId);
  }

  const clientId = await fetchClientId(userId);
  if (!clientId) {
    return requested && isAllowedWhenLocked(requested) ? requested : "/settings/profile";
  }

  const sub = await fetchSubscription(clientId);
  const access = hasAccess(sub ?? null);

  if (!access) {
    if (requested && isAllowedWhenLocked(requested)) return requested;
    return "/pricing?app=1";
  }

  if (requested) return requested;
  return resolvePreferredPath(userId);
}
