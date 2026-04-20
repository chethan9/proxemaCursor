import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/admin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // Verify caller is super admin via their JWT
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return res.status(401).json({ error: "Unauthorized" });
  const token = authHeader.slice(7);
  const supaUser = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
  const { data: userData, error: userErr } = await supaUser.auth.getUser();
  if (userErr || !userData.user) return res.status(401).json({ error: "Invalid session" });
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .maybeSingle();
  if (!profile || profile.role !== "super_admin") return res.status(403).json({ error: "Forbidden" });

  const {
    type, title, body, cta_label, cta_url, image_url, lottie_url,
    priority, expires_at, metadata,
    targeting, target_user_ids, target_client_id, target_role,
  } = req.body || {};

  if (!type || !title) return res.status(400).json({ error: "type and title required" });
  if (!["broadcast", "users", "client", "role"].includes(targeting)) {
    return res.status(400).json({ error: "Invalid targeting" });
  }

  const groupId = `grp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  let targetDescription = "All users";

  // Resolve target user IDs
  let userIds: (string | null)[] = [];
  if (targeting === "broadcast") {
    userIds = [null]; // Single broadcast row with user_id = null
    targetDescription = "All users (broadcast)";
  } else if (targeting === "users") {
    if (!Array.isArray(target_user_ids) || target_user_ids.length === 0) {
      return res.status(400).json({ error: "target_user_ids required" });
    }
    userIds = target_user_ids;
    targetDescription = `${target_user_ids.length} specific user${target_user_ids.length === 1 ? "" : "s"}`;
  } else if (targeting === "client") {
    if (!target_client_id) return res.status(400).json({ error: "target_client_id required" });
    const { data: clientUsers } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("client_id", target_client_id)
      .eq("is_active", true);
    userIds = (clientUsers || []).map((u) => u.id);
    const { data: client } = await supabaseAdmin.from("clients").select("name").eq("id", target_client_id).maybeSingle();
    targetDescription = `Client: ${client?.name || "Unknown"} (${userIds.length} users)`;
    if (userIds.length === 0) return res.status(400).json({ error: "No users in this client" });
  } else if (targeting === "role") {
    if (!target_role) return res.status(400).json({ error: "target_role required" });
    const { data: roleUsers } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("role", target_role)
      .eq("is_active", true);
    userIds = (roleUsers || []).map((u) => u.id);
    targetDescription = `Role: ${target_role} (${userIds.length} users)`;
    if (userIds.length === 0) return res.status(400).json({ error: "No users with this role" });
  }

  const enrichedMeta = { ...(metadata || {}), group_id: groupId, targeting, target_description: targetDescription };
  const rows = userIds.map((uid) => ({
    user_id: uid,
    type,
    title,
    body: body || null,
    cta_label: cta_label || null,
    cta_url: cta_url || null,
    image_url: image_url || null,
    lottie_url: lottie_url || null,
    priority: typeof priority === "number" ? priority : 50,
    metadata: enrichedMeta,
    expires_at: expires_at || null,
  }));

  const { error: insertErr } = await supabaseAdmin.from("user_notifications").insert(rows);
  if (insertErr) return res.status(500).json({ error: insertErr.message });

  return res.status(200).json({ success: true, count: rows.length, group_id: groupId });
}