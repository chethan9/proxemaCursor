import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { site_url, user_login, password, state, rejected } = req.query;

  console.log("[wp-callback] incoming query:", {
    hasState: !!state,
    hasSiteUrl: !!site_url,
    hasUserLogin: !!user_login,
    hasPassword: !!password,
    rejected: !!rejected,
    method: req.method,
  });

  const rawState = typeof state === "string" ? state : null;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL
    || process.env.NEXT_PUBLIC_SITE_URL
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

  if (!rawState) {
    console.error("[wp-callback] missing state param");
    return res.redirect(302, `${baseUrl}/projects?error=missing_state`);
  }

  const [storeId, encodedReturnTo] = rawState.split("|");
  let returnTo: string | null = null;
  if (encodedReturnTo) {
    try { returnTo = decodeURIComponent(encodedReturnTo); } catch { returnTo = null; }
  }

  console.log("[wp-callback] parsed state:", { storeId, returnTo });

  const buildRedirect = (status: string) => {
    if (returnTo && returnTo.startsWith("/")) {
      const sep = returnTo.includes("?") ? "&" : "?";
      return `${baseUrl}${returnTo}${sep}wp=${status}&store=${storeId}`;
    }
    return `${baseUrl}/sites/connect/${storeId}?success=1&wp=${status}`;
  };

  if (rejected) {
    console.log("[wp-callback] user rejected authorization");
    return res.redirect(302, buildRedirect("rejected"));
  }

  if (!site_url || !user_login || !password) {
    console.error("[wp-callback] missing required fields from WordPress");
    return res.redirect(302, buildRedirect("missing"));
  }

  if (!storeId || storeId.length < 10) {
    console.error("[wp-callback] invalid storeId in state:", storeId);
    return res.redirect(302, `${baseUrl}/projects?error=invalid_store`);
  }

  console.log("[wp-callback] updating store", storeId, "with wp_username:", user_login);

  const { data: updated, error } = await supabaseAdmin
    .from("stores")
    .update({
      wp_username: String(user_login),
      wp_app_password: String(password),
      updated_at: new Date().toISOString(),
    })
    .eq("id", storeId)
    .select("id, wp_username")
    .maybeSingle();

  if (error) {
    console.error("[wp-callback] DB update failed:", error);
    return res.redirect(302, buildRedirect("error"));
  }

  if (!updated) {
    console.error("[wp-callback] store not found:", storeId);
    return res.redirect(302, buildRedirect("notfound"));
  }

  console.log("[wp-callback] SUCCESS — wp_username saved:", updated.wp_username, "for store:", updated.id);

  // Eager sync: kick off full sync pipeline while user is still on the "connecting…" screen.
  const protocol = (req.headers["x-forwarded-proto"] as string) || "https";
  const host = req.headers.host;
  if (host) {
    const base = `${protocol}://${host}`;
    fetch(`${base}/api/stores/${storeId}/sync-start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_initial: false }),
    }).catch((e) => console.error("[wp-callback] eager sync trigger failed:", e));
  }

  return res.redirect(302, buildRedirect("ok"));
}