import { supabase } from "@/integrations/supabase/client";

export type LatestInvoicePrintByOrder = Record<string, { rendered_at: string }>;

export async function getLatestInvoicePrintByOrderIds(
  orderIds: string[],
  invoiceTemplateIds: string[],
): Promise<LatestInvoicePrintByOrder> {
  if (!orderIds.length || !invoiceTemplateIds.length) return {};

  const { data, error } = await supabase
    .from("template_renders")
    .select("entity_id, rendered_at, template_id")
    .eq("entity_type", "order")
    .eq("output_format", "pdf")
    .in("entity_id", orderIds)
    .in("template_id", invoiceTemplateIds)
    .order("rendered_at", { ascending: false })
    .limit(Math.max(100, orderIds.length * 8));

  if (error) throw error;

  const latest: LatestInvoicePrintByOrder = {};
  for (const row of data ?? []) {
    const entityId = typeof row.entity_id === "string" ? row.entity_id : "";
    if (!entityId || latest[entityId]) continue;
    latest[entityId] = { rendered_at: row.rendered_at };
  }
  return latest;
}
