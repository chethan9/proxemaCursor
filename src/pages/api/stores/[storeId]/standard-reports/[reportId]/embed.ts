import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import {
  buildMetabaseEmbedIframeUrl,
  buildMetabaseEmbedPayload,
  getMetabaseEmbeddingSecret,
  mergeEmbedParams,
  signMetabaseEmbedJwt,
  type MetabaseEmbedResourceType,
} from "@/lib/metabase-embed";

type StoreAccess = { allowed: true } | { allowed: false; status: number; message: string };

async function assertStoreAccess(userId: string, storeId: string): Promise<StoreAccess> {
  const { data: profile } = await supabaseAdmin.from("profiles").select("role, client_id").eq("id", userId).single();
  if (!profile) return { allowed: false, status: 403, message: "Profile not found" };
  const { data: store } = await supabaseAdmin.from("stores").select("id, client_id").eq("id", storeId).single();
  if (!store) return { allowed: false, status: 404, message: "Store not found" };
  const isSuperAdmin = profile.role === "super_admin";
  if (!isSuperAdmin && store.client_id !== profile.client_id) {
    return { allowed: false, status: 403, message: "Forbidden" };
  }
  return { allowed: true };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ embedUrl: string; expiresAt: number } | { error: string }>
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const storeId = typeof req.query.storeId === "string" ? req.query.storeId : "";
  const reportId = typeof req.query.reportId === "string" ? req.query.reportId : "";
  if (!storeId || !reportId) return res.status(400).json({ error: "Missing storeId or reportId" });

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return res.status(401).json({ error: "Not authenticated" });
  const token = authHeader.slice(7);
  const { data: userRes, error: userErr } = await supabaseAdmin.auth.getUser(token);
  if (userErr || !userRes.user) return res.status(401).json({ error: "Invalid token" });

  const gate = await assertStoreAccess(userRes.user.id, storeId);
  if (gate.allowed === false) {
    return res.status(gate.status).json({ error: gate.message });
  }

  const secret = getMetabaseEmbeddingSecret();
  if (!secret) {
    return res.status(503).json({ error: "METABASE_EMBEDDING_SECRET is not configured on the server" });
  }

  const { data: row, error } = await supabaseAdmin
    .from("standard_reports")
    .select("*")
    .eq("id", reportId)
    .eq("is_active", true)
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });
  if (!row) return res.status(404).json({ error: "Report not found" });
  if (row.provider !== "metabase") {
    return res.status(400).json({ error: "This report is not a Metabase embed" });
  }

  const siteUrl = row.metabase_site_url?.trim();
  const resourceType = row.embed_resource_type as MetabaseEmbedResourceType | null;
  const resourceId = row.embed_resource_id;
  if (!siteUrl || !resourceType || resourceId === null || resourceId === undefined) {
    return res.status(500).json({ error: "Report is missing Metabase embed configuration" });
  }

  const locked = row.locked_params as Record<string, unknown> | null;
  const params = mergeEmbedParams(locked, storeId);
  const expiresInSeconds = Number(process.env.METABASE_EMBED_TTL_SECONDS ?? "600") || 600;

  const payload = buildMetabaseEmbedPayload({
    resourceType,
    resourceId: Number(resourceId),
    params,
    expiresInSeconds,
  });

  const jwt = signMetabaseEmbedJwt(payload, secret);
  const embedUrl = buildMetabaseEmbedIframeUrl({
    metabaseSiteUrl: siteUrl,
    resourceType,
    token: jwt,
  });

  const expSec = payload.exp as number;
  const expiresAt = expSec * 1000;

  return res.status(200).json({ embedUrl, expiresAt });
}
