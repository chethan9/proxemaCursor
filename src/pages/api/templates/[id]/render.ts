import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { renderTemplateHtml } from "@/lib/templates/render-html";
import { renderHtmlToPdf } from "@/lib/templates/render-pdf";
import { resolveOrderContext, getSampleContext } from "@/lib/templates/resolve-order";
import { getReportSampleContext, resolveReportContext } from "@/lib/templates/resolve-report";
import { renderPdfFilename } from "@/lib/templates/render-filename";
import type { TemplateConfig } from "@/lib/templates/document";

export const config = { api: { bodyParser: { sizeLimit: "1mb" }, responseLimit: false } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const templateId = req.query.id as string;
  const format = (req.query.format as string) || "pdf";
  const orderId = (req.query.order_id as string) || "";
  const storeId = (req.query.store_id as string) || "";
  const sampleParam = req.query.sample === "1";
  const from = (req.query.from as string) || "";
  const to = (req.query.to as string) || "";

  try {
    const { data: tpl, error: tplErr } = await supabaseAdmin
      .from("templates")
      .select("id, name, type, current_version_id")
      .eq("id", templateId)
      .maybeSingle();
    if (tplErr || !tpl) return res.status(404).json({ error: "Template not found" });
    if (!tpl.current_version_id) return res.status(400).json({ error: "Template has no published version" });

    const { data: ver, error: verErr } = await supabaseAdmin
      .from("template_versions")
      .select("id, document")
      .eq("id", tpl.current_version_id)
      .maybeSingle();
    if (verErr || !ver) return res.status(404).json({ error: "Template version not found" });

    const cfg = ver.document as unknown as TemplateConfig;
    const html = typeof cfg?.html === "string" ? cfg.html : "";
    if (!html) return res.status(400).json({ error: "Template has no HTML content" });

    const meta = { name: tpl.name as string, type: tpl.type as string };
    const tplType = tpl.type as string;

    let context: unknown;
    if (sampleParam) {
      context = tplType === "report" ? getReportSampleContext(meta) : getSampleContext(meta);
    } else if (tplType === "report") {
      context = storeId
        ? await resolveReportContext(supabaseAdmin, storeId, { from: from || undefined, to: to || undefined })
        : getReportSampleContext(meta);
    } else if (storeId && orderId) {
      context = await resolveOrderContext(supabaseAdmin, storeId, orderId, meta);
    } else {
      context = getSampleContext(meta);
    }

    if (!context) return res.status(400).json({ error: "Unable to build template context" });

    // Prevent CDN/browser caching of live invoices/reports — identical URLs would otherwise show stale PDFs.
    if (!sampleParam) {
      res.setHeader("Cache-Control", "private, no-store, no-cache, must-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
    }

    let rendered: string;
    try {
      rendered = await renderTemplateHtml(html, context as unknown as Record<string, unknown>);
    } catch (e) {
      const err = e as Error & { renderError?: { message: string; line?: number; column?: number }; status?: number };
      return res.status(err.status ?? 500).json({ error: err.message, detail: err.renderError });
    }

    const entityKey = orderId || storeId || "sample";

    if (format === "html") {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.status(200).send(rendered);
      void logRender(templateId, ver.id as string, "html", entityKey);
      return;
    }

    const buffer = await renderHtmlToPdf(rendered);
    const filename = renderPdfFilename(
      cfg.filenamePattern,
      context as Record<string, unknown>,
      tpl.name as string,
      entityKey,
      tpl.type as string,
    );
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
    res.status(200).send(buffer);
    void logRender(templateId, ver.id as string, "pdf", entityKey);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Render failed";
    console.error("[template-render]", e);
    res.status(500).json({ error: msg });
  }
}

async function logRender(templateId: string, versionId: string, fmt: string, entityId: string) {
  try {
    await supabaseAdmin.from("template_renders").insert({
      template_id: templateId,
      version_id: versionId,
      output_format: fmt,
      entity_type: entityId && entityId !== "sample" ? "order" : "sample",
      entity_id: entityId && entityId !== "sample" ? entityId : null,
    });
  } catch {
    /* non-fatal */
  }
}