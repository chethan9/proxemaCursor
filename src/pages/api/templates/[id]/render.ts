import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { renderTemplatePdf } from "@/lib/templates/render-pdf";
import { renderDocumentToHtml } from "@/lib/templates/render-html";
import { resolveOrderData } from "@/lib/templates/resolve-order";
import { sampleInvoiceData } from "@/lib/templates/sample-data";
import { defaultStyles } from "@/lib/templates/document";
import type { TemplateDocument, DocumentStyles } from "@/lib/templates/document";

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
      .select("id, name, type, current_version_id, client_id, is_sample")
      .eq("id", templateId)
      .maybeSingle();
    if (tplErr || !tpl) return res.status(404).json({ error: "Template not found" });
    if (!tpl.current_version_id) return res.status(400).json({ error: "Template has no published version" });

    const { data: ver, error: verErr } = await supabaseAdmin
      .from("template_versions")
      .select("id, document, styles")
      .eq("id", tpl.current_version_id)
      .maybeSingle();
    if (verErr || !ver) return res.status(404).json({ error: "Template version not found" });

    const doc = ver.document as unknown as TemplateDocument;
    const styles = (ver.styles as unknown as DocumentStyles) || defaultStyles();

    let data: Record<string, unknown>;
    if (useSample) {
      data = sampleInvoiceData as unknown as Record<string, unknown>;
    } else if (storeId && orderId) {
      data = (await resolveOrderData(supabaseAdmin, storeId, orderId)) as unknown as Record<string, unknown>;
    } else {
      return res.status(400).json({ error: "Provide store_id+order_id or sample=1" });
    }

    if (format === "html") {
      const html = renderDocumentToHtml(doc, data, styles);
      const wrapped = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${tpl.name}</title></head><body style="margin:0;background:#f3f4f6;padding:24px;"><div style="max-width:800px;margin:0 auto;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,0.1);">${html}</div></body></html>`;
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.status(200).send(wrapped);
      void logRender(templateId, ver.id, "html", orderId);
      return;
    }

    const buffer = await renderTemplatePdf(doc, styles, data);
    const filename = `${tpl.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${orderId || "sample"}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
    res.status(200).send(buffer);
    void logRender(templateId, ver.id, "pdf", orderId);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Render failed";
    console.error("[template-render]", e);
    res.status(500).json({ error: msg });
  }
}

async function logRender(templateId: string, versionId: string, format: string, orderId: string) {
  try {
    await supabaseAdmin.from("template_renders").insert({
      template_id: templateId,
      version_id: versionId,
      output_format: format,
      entity_type: orderId ? "order" : "sample",
      entity_id: orderId || null,
    });
  } catch {
    /* non-fatal */
  }
}