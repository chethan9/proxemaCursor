import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import {
  buildMetabaseEmbedPayload,
  getMetabaseEmbeddingSecret,
  mergeEmbedParams,
  signMetabaseEmbedJwt,
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

function slugifyFilename(title: string): string {
  const s = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "");
  return s || "report";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const storeId = typeof req.query.storeId === "string" ? req.query.storeId : "";
  const reportId = typeof req.query.reportId === "string" ? req.query.reportId : "";
  if (!storeId || !reportId) return res.status(400).json({ error: "Missing storeId or reportId" });

  const authHeader = req.headers.authorization;
  const tokenFromQuery =
    typeof req.query.access_token === "string" ? req.query.access_token.trim() : "";
  const tokenFromHeader = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : "";
  const token = tokenFromHeader || tokenFromQuery;
  if (!token) return res.status(401).json({ error: "Not authenticated" });

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
    return res.status(400).json({ error: "CSV export is only available for Metabase reports" });
  }
  if (row.embed_resource_type !== "question") {
    return res.status(400).json({
      error: "CSV export applies to individual questions. Open the report and export from Metabase, or use a question tile.",
    });
  }

  const siteUrl = row.metabase_site_url?.trim();
  const resourceId = row.embed_resource_id;
  if (!siteUrl || resourceId === null || resourceId === undefined) {
    return res.status(500).json({ error: "Report is missing Metabase embed configuration" });
  }

  const locked = row.locked_params as Record<string, unknown> | null;
  const params = mergeEmbedParams(locked, storeId);
  const expiresInSeconds = Number(process.env.METABASE_EMBED_TTL_SECONDS ?? "600") || 600;

  const payload = buildMetabaseEmbedPayload({
    resourceType: "question",
    resourceId: Number(resourceId),
    params,
    expiresInSeconds,
  });

  const jwt = signMetabaseEmbedJwt(payload, secret);
  const origin = new URL(siteUrl).origin;
  const csvUrl = `${origin}/api/embed/card/${jwt}/query/csv`;

  const upstream = await fetch(csvUrl, { method: "GET", redirect: "follow" });
  if (!upstream.ok) {
    const errText = await upstream.text().catch(() => "");
    return res.status(502).json({
      error: `Metabase CSV export failed (${upstream.status})`,
      detail: errText.slice(0, 500),
    });
  }

  const filename = `${slugifyFilename(row.title)}.csv`;
  res.setHeader("Content-Type", upstream.headers.get("content-type") || "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

  const buf = Buffer.from(await upstream.arrayBuffer());
  return res.status(200).send(buf);
}
