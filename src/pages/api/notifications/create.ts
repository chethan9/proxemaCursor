import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin as supabase } from "@/integrations/supabase/admin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const adminKey = req.headers["x-admin-key"];
  if (adminKey !== process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const { user_id, type, title, body, cta_label, cta_url, image_url, lottie_url, priority, metadata, expires_at } = req.body || {};
  if (!type || !title) return res.status(400).json({ error: "type and title are required" });
  const { data, error } = await supabase
    .from("user_notifications")
    .insert({
      user_id: user_id || null,
      type,
      title,
      body: body || null,
      cta_label: cta_label || null,
      cta_url: cta_url || null,
      image_url: image_url || null,
      lottie_url: lottie_url || null,
      priority: typeof priority === "number" ? priority : 50,
      metadata: metadata || {},
      expires_at: expires_at || null,
    })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ success: true, notification: data });
}