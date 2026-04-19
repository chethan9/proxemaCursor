import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { site_url, user_login, password, state, rejected } = req.query;

  const storeId = typeof state === "string" ? state : null;
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

  if (!storeId) {
    return res.redirect(302, `${baseUrl}/projects?error=missing_state`);
  }

  if (rejected) {
    return res.redirect(302, `${baseUrl}/sites/connect/${storeId}?success=1&wp=rejected`);
  }

  if (!site_url || !user_login || !password) {
    return res.redirect(302, `${baseUrl}/sites/connect/${storeId}?success=1&wp=missing`);
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
    return res.redirect(302, `${baseUrl}/sites/connect/${storeId}?success=1&wp=error`);
  }

  console.log("[wp-callback] WP credentials saved for store", storeId);
  return res.redirect(302, `${baseUrl}/sites/connect/${storeId}?success=1&wp=ok`);
}