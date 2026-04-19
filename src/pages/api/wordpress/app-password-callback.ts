import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { site_url, user_login, password, state, rejected } = req.query;

  const rawState = typeof state === "string" ? state : null;
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

  if (!rawState) {
    return res.redirect(302, `${baseUrl}/projects?error=missing_state`);
  }

  // state can be "storeId" or "storeId|encodedReturnTo"
  const [storeId, encodedReturnTo] = rawState.split("|");
  let returnTo: string | null = null;
  if (encodedReturnTo) {
    try { returnTo = decodeURIComponent(encodedReturnTo); } catch { returnTo = null; }
  }

  const buildRedirect = (status: string) => {
    if (returnTo && returnTo.startsWith("/")) {
      const sep = returnTo.includes("?") ? "&" : "?";
      return `${baseUrl}${returnTo}${sep}wp=${status}&store=${storeId}`;
    }
    return `${baseUrl}/sites/connect/${storeId}?success=1&wp=${status}`;
  };

  if (rejected) {
    return res.redirect(302, buildRedirect("rejected"));
  }

  if (!site_url || !user_login || !password) {
    return res.redirect(302, buildRedirect("missing"));
  }

  const { error } = await supabaseAdmin
    .from("stores")
    .update({
      wp_username: String(user_login),
      wp_app_password: String(password),
      updated_at: new Date().toISOString(),
    })
    .eq("id", storeId);

  if (error) {
    console.error("[wp-callback] failed to save credentials:", error);
    return res.redirect(302, buildRedirect("error"));
  }

  console.log("[wp-callback] WP credentials saved for store", storeId);
  return res.redirect(302, buildRedirect("ok"));
}