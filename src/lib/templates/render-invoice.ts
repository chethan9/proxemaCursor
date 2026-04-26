import { renderTemplateHtml } from "./render-html";
import { renderHtmlToPdf } from "./render-pdf";
import { resolveOrderContext } from "./resolve-order";
import type { TemplateConfig } from "./document";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface RenderedInvoice {
  pdf: Buffer;
  orderNumber: string;
  templateName: string;
}

export async function renderInvoicePdfForOrder(
  supabaseAdmin: SupabaseClient,
  opts: { storeId: string; orderId: string; templateId: string },
): Promise<RenderedInvoice> {
  const { data: tpl, error: tplErr } = await supabaseAdmin
    .from("templates")
    .select("id, name, type, current_version_id")
    .eq("id", opts.templateId)
    .maybeSingle();
  if (tplErr) throw tplErr;
  if (!tpl) throw new Error(`Template ${opts.templateId} not found`);
  if (!tpl.current_version_id) throw new Error(`Template ${tpl.name} has no published version`);

  const { data: ver, error: verErr } = await supabaseAdmin
    .from("template_versions")
    .select("id, document")
    .eq("id", tpl.current_version_id)
    .maybeSingle();
  if (verErr) throw verErr;
  if (!ver) throw new Error("Template version missing");

  const cfg = ver.document as unknown as TemplateConfig;
  const html = typeof cfg?.html === "string" ? cfg.html : "";
  if (!html) throw new Error("Template has no HTML content");

  const meta = { name: tpl.name as string, type: tpl.type as string };
  const ctx = await resolveOrderContext(supabaseAdmin, opts.storeId, opts.orderId, meta);
  const rendered = await renderTemplateHtml(html, ctx as unknown as Record<string, unknown>);
  const pdf = await renderHtmlToPdf(rendered);

  const orderObj = (ctx as { order?: { number?: string } }).order;
  const orderNumber = orderObj?.number ?? opts.orderId;

  return { pdf, orderNumber: String(orderNumber), templateName: tpl.name as string };
}