import type { TemplateRow, TemplateType } from "@/lib/templates/document";

/** Platform invoice sample used when no explicit default is stored. */
export const MAIN_INVOICE_SAMPLE_NAME = "Main Invoice";

/**
 * Single rule for “which template prints first” across orders, bulk print, and menus.
 * 1) Row flagged `is_default_for_type` (sample or custom)
 * 2) Invoice: “Main Invoice” sample by name
 * 3) First custom template for this client
 * 4) First sample of this type
 * 5) First row of this type
 */
export function resolveDefaultTemplateForPrint(
  templates: TemplateRow[],
  type: TemplateType,
  clientId: string | null | undefined,
): TemplateRow | null {
  const list = templates.filter((t) => t.type === type);
  if (!list.length) return null;

  const marked = list.find((t) => t.is_default_for_type);
  if (marked) return marked;

  if (type === "invoice") {
    const main = list.find(
      (t) =>
        t.is_sample &&
        typeof t.name === "string" &&
        t.name.trim().toLowerCase() === MAIN_INVOICE_SAMPLE_NAME.toLowerCase(),
    );
    if (main) return main;
  }

  if (clientId) {
    const custom = list.find((t) => !t.is_sample && t.client_id === clientId);
    if (custom) return custom;
  }

  const sample = list.find((t) => t.is_sample);
  if (sample) return sample;

  return list[0] ?? null;
}
