import type { NextApiRequest, NextApiResponse } from "next";
import { logActivity } from "@/lib/activity-log";

const ALLOWED_ACTIONS = new Set([
  "auth.login",
  "auth.logout",
  "auth.password_reset_requested",
  "auth.password_reset",
  "auth.role_change",
  "auth.user_invite",
]);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { action, entity_type, entity_id, metadata } = req.body || {};
  if (typeof action !== "string" || !ALLOWED_ACTIONS.has(action)) {
    return res.status(400).json({ error: "Invalid or missing action" });
  }

  await logActivity({
    action,
    entityType: typeof entity_type === "string" ? entity_type : "auth",
    entityId: entity_id != null ? String(entity_id) : null,
    metadata: metadata && typeof metadata === "object" ? metadata : undefined,
    req,
  });

  return res.status(200).json({ ok: true });
}