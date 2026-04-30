import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { logActivity } from "@/lib/activity-log";
import { getClientIdForStore } from "@/lib/audit/log";

/** Allowlisted client-reported events (browser export/print, etc.) */
const ALLOWED = new Set([
  "sites.order.export_csv",
  "sites.product.export_csv",
  "sites.product.export",
  "sites.taxonomy.export_csv",
  "sites.invoice.print_queued",
  "templates.version.saved",
  "sites.product.ai_generate",
  "sites.product.ai_approve",
  "sites.product.ai_reject",
  "sites.product.ai_regenerate",
]);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing authorization" });
  }
  const token = authHeader.slice(7);

  const authClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: userRes, error: userErr } = await authClient.auth.getUser();
  if (userErr || !userRes.user) {
    return res.status(401).json({ error: "Invalid session" });
  }

  const body = req.body || {};
  const action = typeof body.action === "string" ? body.action : "";
  if (!ALLOWED.has(action)) {
    return res.status(400).json({ error: "Invalid action" });
  }

  const entityType = typeof body.entity_type === "string" ? body.entity_type : "app";
  const entityId = body.entity_id != null ? String(body.entity_id) : null;
  const storeId = typeof body.store_id === "string" ? body.store_id : null;
  const metadata =
    body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata) ? (body.metadata as Record<string, unknown>) : {};

  let clientId: string | null = typeof body.client_id === "string" ? body.client_id : null;
  if (!clientId && storeId) {
    clientId = await getClientIdForStore(storeId);
  }
  if (!clientId) {
    const { data: prof } = await authClient.from("profiles").select("client_id").eq("id", userRes.user.id).maybeSingle();
    clientId = (prof?.client_id as string | null) ?? null;
  }

  await logActivity({
    action,
    entityType,
    entityId,
    clientId,
    metadata: {
      ...metadata,
      module: typeof body.module === "string" ? body.module : "sites",
      ...(storeId ? { store_id: storeId } : {}),
    },
    req,
  });

  return res.status(200).json({ ok: true });
}
