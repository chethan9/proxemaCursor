import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { renderTemplateHtml } from "@/lib/templates/render-html";
import { renderHtmlToPdf } from "@/lib/templates/render-pdf";
import { resolveOrderData } from "@/lib/templates/resolve-order";
import type { JSONContent } from "@tiptap/core";

const sampleInvoiceData = {
  order: {
    number: "1024",
    date: "May 22, 2024",
    total: "$88.80",
    subtotal: "$78.00",
    shipping: "$8.00",
    tax: "$7.80",
    discount: "-$5.00",
    currency: "USD",
    items: [
      { name: "Cap", sku: "woo-cap", quantity: 2, price: "$18.00", total: "$36.00" },
      { name: "Hoodie", sku: "woo-hoodie", quantity: 1, price: "$42.00", total: "$42.00" },
    ],
    billing: { first_name: "John", last_name: "Doe", address_1: "123 Street Name", address_2: "Apartment 4B", city: "New York", state: "NY", postcode: "10001", country: "United States" },
    shipping_address: { first_name: "John", last_name: "Doe", address_1: "456 Park Avenue", address_2: "Apartment 4B", city: "New York", state: "NY", postcode: "10001", country: "United States" },
  },
  customer: { name: "John Doe", email: "john@example.com" },
  store: { name: "Proxema", email: "support@proxema.com" },
};

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

    const document = ver.document as unknown as JSONContent;

    let data: Record<string, unknown>;
    if (useSample) {
      data = sampleInvoiceData as unknown as Record<string, unknown>;
    } else if (storeId && orderId) {
      data = (await resolveOrderData(supabaseAdmin, storeId, orderId)) as unknown as Record<string, unknown>;
    } else {
      return res.status(400).json({ error: "Provide store_id+order_id or sample=1" });
    }

    const html = await renderTemplateHtml(document, data);

    if (format === "html") {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.status(200).send(html);
      void logRender(templateId, ver.id, "html", orderId);
      return;
    }

    const buffer = await renderHtmlToPdf(html);
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