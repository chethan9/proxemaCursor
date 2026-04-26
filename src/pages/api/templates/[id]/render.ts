import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { renderTemplateHtml } from "@/lib/templates/render-html";
import { renderHtmlToPdf } from "@/lib/templates/render-pdf";
import { resolveOrderContext, getSampleContext } from "@/lib/templates/resolve-order";
import type { TemplateConfig } from "@/lib/templates/document";

export const config = { api: { bodyParser: { sizeLimit: "1mb" }, responseLimit: false } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const templateId = req.query.id as string;
  const format = (req.query.format as string) || "pdf";
  const orderId = (req.query.order_id as string) || "";
  const storeId = (req.query.store_id as string) || "";
  const useSample = req.query.sample === "1" || (!orderId && !storeId);

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
    const context = useSample
      ? getSampleContext(meta)
      : storeId && orderId
      ? await resolveOrderContext(supabaseAdmin, storeId, orderId, meta)
      : null;

    if (!context) return res.status(400).json({ error: "Provide store_id+order_id or sample=1" });

    let rendered: string;
    try {
      rendered = await renderTemplateHtml(html, context as unknown as Record<string, unknown>);
    } catch (e) {
      const err = e as Error & { renderError?: { message: string; line?: number; column?: number }; status?: number };
      return res.status(err.status ?? 500).json({ error: err.message, detail: err.renderError });
    }

    if (format === "html") {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.status(200).send(rendered);
      void logRender(templateId, ver.id as string, "html", orderId);
      return;
    }

    const buffer = await renderHtmlToPdf(rendered);
    const filename = `${(tpl.name as string).replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${orderId || "sample"}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
    res.status(200).send(buffer);
    void logRender(templateId, ver.id as string, "pdf", orderId);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Render failed";
    console.error("[template-render]", e);
    res.status(500).json({ error: msg });
  }
}

async function logRender(templateId: string, versionId: string, fmt: string, orderId: string) {
  try {
    await supabaseAdmin.from("template_renders").insert({
      template_id: templateId,
      version_id: versionId,
      output_format: fmt,
      entity_type: orderId ? "order" : "sample",
      entity_id: orderId || null,
    });
  } catch {
    /* non-fatal */
  }
}