import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { resolveUserFromRequest } from "@/lib/server-auth";
import { isAllowedStandardReportUrl } from "@/lib/standard-report-urls";
import type { Database, Json } from "@/integrations/supabase/database.types";

export type StandardReportRow = Database["public"]["Tables"]["standard_reports"]["Row"];
type StandardReportUpdate = Database["public"]["Tables"]["standard_reports"]["Update"];

export type StandardReportProvider = "metabase" | "link";

type CreateBody = {
  title: string;
  provider?: StandardReportProvider;
  description?: string | null;
  dashboard_url?: string | null;
  metabase_site_url?: string | null;
  embed_resource_type?: "dashboard" | "question" | null;
  embed_resource_id?: number | null;
  locked_params?: Json | Record<string, unknown> | null;
  sort_order?: number;
  is_active?: boolean;
  icon?: string | null;
  report_group?: string | null;
};

type PatchBody = CreateBody & {
  id: string;
};

function validatePayload(input: {
  provider: StandardReportProvider;
  dashboard_url: string | null | undefined;
  metabase_site_url: string | null | undefined;
  embed_resource_type: string | null | undefined;
  embed_resource_id: number | string | null | undefined;
}): { ok: true } | { ok: false; reason: string } {
  if (input.provider === "link") {
    const url = input.dashboard_url?.trim();
    if (!url) return { ok: false, reason: "dashboard_url is required for link reports" };
    return isAllowedStandardReportUrl(url);
  }

  const site = input.metabase_site_url?.trim();
  if (!site) return { ok: false, reason: "metabase_site_url is required for Metabase embeds" };
  const siteCheck = isAllowedStandardReportUrl(site);
  if (siteCheck.ok === false) return siteCheck;

  if (input.embed_resource_type !== "dashboard" && input.embed_resource_type !== "question") {
    return { ok: false, reason: "embed_resource_type must be dashboard or question" };
  }
  const rid = Number(input.embed_resource_id);
  if (!Number.isFinite(rid) || rid <= 0) {
    return { ok: false, reason: "embed_resource_id must be a positive number (Metabase resource id)" };
  }

  if (input.dashboard_url?.trim()) {
    const ref = isAllowedStandardReportUrl(input.dashboard_url.trim());
    if (ref.ok === false) return ref;
  }

  return { ok: true };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const me = await resolveUserFromRequest(req);
  if (!me?.userId || me.role !== "super_admin") {
    return res.status(403).json({ error: "Super admin only" });
  }

  if (req.method === "GET") {
    const { data, error } = await supabaseAdmin
      .from("standard_reports")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("title", { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data ?? []);
  }

  if (req.method === "POST") {
    const body = req.body as Partial<CreateBody>;
    if (!body.title?.trim()) return res.status(400).json({ error: "title is required" });
    const provider = (body.provider ?? "metabase") as StandardReportProvider;
    if (provider !== "metabase" && provider !== "link") {
      return res.status(400).json({ error: "provider must be metabase or link" });
    }

    const locked: Json =
      provider === "link"
        ? ({} as Json)
        : body.locked_params === undefined || body.locked_params === null
          ? ({} as Json)
          : (body.locked_params as Json);

    const v = validatePayload({
      provider,
      dashboard_url: body.dashboard_url,
      metabase_site_url: body.metabase_site_url,
      embed_resource_type: body.embed_resource_type ?? null,
      embed_resource_id: body.embed_resource_id ?? null,
    });
    if (v.ok === false) return res.status(400).json({ error: v.reason });

    const embedIdNum = provider === "metabase" ? Number(body.embed_resource_id) : NaN;
    if (provider === "metabase" && (!Number.isFinite(embedIdNum) || embedIdNum <= 0)) {
      return res.status(400).json({ error: "embed_resource_id must be a positive number" });
    }

    const insertRow: Database["public"]["Tables"]["standard_reports"]["Insert"] = {
      title: body.title.trim(),
      provider,
      description: body.description ?? null,
      dashboard_url:
        provider === "link" ? body.dashboard_url!.trim() : body.dashboard_url?.trim() ?? null,
      metabase_site_url: provider === "metabase" ? body.metabase_site_url!.trim() : null,
      embed_resource_type: provider === "metabase" ? body.embed_resource_type! : null,
      embed_resource_id: provider === "metabase" ? embedIdNum : null,
      locked_params: locked,
      sort_order: body.sort_order ?? 0,
      is_active: body.is_active ?? true,
      icon: body.icon ?? null,
      report_group: body.report_group ?? null,
    };

    const { data, error } = await supabaseAdmin.from("standard_reports").insert(insertRow).select("*").single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json(data);
  }

  if (req.method === "PATCH") {
    const body = req.body as Partial<PatchBody>;
    if (!body.id) return res.status(400).json({ error: "id is required" });

    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from("standard_reports")
      .select("*")
      .eq("id", body.id)
      .single();
    if (fetchErr || !existing) return res.status(404).json({ error: "Report not found" });

    const provider = (body.provider ?? existing.provider) as StandardReportProvider;
    const merged = {
      provider,
      dashboard_url: body.dashboard_url !== undefined ? body.dashboard_url : existing.dashboard_url,
      metabase_site_url:
        body.metabase_site_url !== undefined ? body.metabase_site_url : existing.metabase_site_url,
      embed_resource_type:
        body.embed_resource_type !== undefined ? body.embed_resource_type : existing.embed_resource_type,
      embed_resource_id:
        body.embed_resource_id !== undefined ? body.embed_resource_id : existing.embed_resource_id,
    };

    const v = validatePayload({
      provider,
      dashboard_url: merged.dashboard_url,
      metabase_site_url: merged.metabase_site_url,
      embed_resource_type: merged.embed_resource_type,
      embed_resource_id: merged.embed_resource_id,
    });
    if (v.ok === false) return res.status(400).json({ error: v.reason });

    const patch: StandardReportUpdate = { updated_at: new Date().toISOString() };
    if (body.title !== undefined) patch.title = body.title.trim();
    if (body.provider !== undefined) patch.provider = body.provider;
    if (body.description !== undefined) patch.description = body.description;
    if (body.dashboard_url !== undefined) patch.dashboard_url = body.dashboard_url?.trim() ?? null;
    if (body.metabase_site_url !== undefined) patch.metabase_site_url = body.metabase_site_url?.trim() ?? null;
    if (body.embed_resource_type !== undefined) patch.embed_resource_type = body.embed_resource_type;
    if (body.embed_resource_id !== undefined) patch.embed_resource_id = body.embed_resource_id;
    if (body.locked_params !== undefined)
      patch.locked_params = (body.locked_params ?? {}) as Json;
    if (body.sort_order !== undefined) patch.sort_order = body.sort_order;
    if (body.is_active !== undefined) patch.is_active = body.is_active;
    if (body.icon !== undefined) patch.icon = body.icon;
    if (body.report_group !== undefined) patch.report_group = body.report_group;

    const { data, error } = await supabaseAdmin
      .from("standard_reports")
      .update(patch)
      .eq("id", body.id)
      .select("*")
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  if (req.method === "DELETE") {
    const id = typeof req.query.id === "string" ? req.query.id : "";
    if (!id) return res.status(400).json({ error: "id query param is required" });
    const { error } = await supabaseAdmin.from("standard_reports").delete().eq("id", id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(204).end();
  }

  return res.status(405).json({ error: "Method not allowed" });
}
