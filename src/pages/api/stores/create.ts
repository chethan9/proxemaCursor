import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/admin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing authorization" });
  }
  const token = authHeader.slice(7);

  const authClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );

  const { data: { user }, error: userErr } = await authClient.auth.getUser();
  if (userErr || !user) {
    return res.status(401).json({ error: "Invalid session" });
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id, role, client_id, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || !profile.is_active) {
    return res.status(403).json({ error: "Account inactive" });
  }

  const { name, url, consumer_key, consumer_secret, client_id, status } = req.body ?? {};

  if (!name || !url) {
    return res.status(400).json({ error: "name and url are required" });
  }

  const isSuperAdmin = profile.role === "super_admin";

  let finalClientId: string | null = client_id || null;
  if (!isSuperAdmin) {
    if (!profile.client_id) {
      return res.status(403).json({ error: "Your account is not assigned to a client. Ask an admin to assign one." });
    }
    if (client_id && client_id !== profile.client_id) {
      return res.status(403).json({ error: "Cannot create store for another client" });
    }
    finalClientId = profile.client_id;
  }

  const { data, error } = await supabaseAdmin
    .from("stores")
    .insert({
      name,
      url,
      consumer_key: consumer_key || null,
      consumer_secret: consumer_secret || null,
      client_id: finalClientId,
      status: status || "pending",
    })
    .select()
    .single();

  if (error) {
    console.error("[api/stores/create] insert failed:", error);
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ store: data });
}