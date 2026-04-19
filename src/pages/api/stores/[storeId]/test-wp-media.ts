import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { storeId: storeIdRaw } = req.query;
  const storeId = Array.isArray(storeIdRaw) ? storeIdRaw[0] : storeIdRaw;
  const { username, password } = (req.body || {}) as { username?: string; password?: string };

  if (!storeId) return res.status(400).json({ ok: false, message: "Missing store id" });

  const { data: store, error } = await supabaseAdmin
    .from("stores")
    .select("id, url, wp_username, wp_app_password")
    .eq("id", storeId)
    .maybeSingle();

  if (error || !store) return res.status(404).json({ ok: false, message: "Store not found" });

  const user = username || store.wp_username;
  const pass = password || store.wp_app_password;

  if (!user || !pass) {
    return res.status(400).json({ ok: false, message: "Missing WP credentials" });
  }

  const baseUrl = store.url.replace(/\/$/, "");
  const authHeader = "Basic " + Buffer.from(`${user}:${pass}`).toString("base64");

  try {
    const r = await fetch(`${baseUrl}/wp-json/wp/v2/media?per_page=1`, {
      headers: { Authorization: authHeader },
    });
    if (!r.ok) {
      const text = await r.text().catch(() => "");
      return res.status(200).json({
        ok: false,
        status: r.status,
        message: r.status === 401 ? "Invalid username or application password" : `HTTP ${r.status}: ${text.slice(0, 200)}`,
      });
    }

    if (username && password) {
      await supabaseAdmin
        .from("stores")
        .update({ wp_username: user, wp_app_password: pass, updated_at: new Date().toISOString() })
        .eq("id", storeId);
    }

    return res.status(200).json({ ok: true, status: 200, message: "Credentials valid" });
  } catch (e) {
    return res.status(200).json({ ok: false, message: e instanceof Error ? e.message : "Network error" });
  }
}