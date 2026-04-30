/** Categories used by the Grapes BlockManager.
 * Tab "Elements" shows ELEMENT_CATEGORY only (atomic building blocks).
 * Tab "Blocks" shows everything in BLOCK_PANEL_CATEGORIES (data-bound,
 * composed sections that read from the rendering context).
 */
export const ELEMENT_CATEGORY = "Basic";

export const SITE_CATEGORY = "Site";
export const ORDER_CATEGORY = "Order";
export const LAYOUT_CATEGORY = "Layout";
export const REPORT_CATEGORY = "Reports";
export const HELPERS_CATEGORY = "Handlebars";

export const BLOCK_PANEL_CATEGORIES = [
  SITE_CATEGORY,
  ORDER_CATEGORY,
  LAYOUT_CATEGORY,
  REPORT_CATEGORY,
  HELPERS_CATEGORY,
] as const;

export type PaletteTab = "elements" | "blocks";

export function blockMatchesPaletteTab(category: string | undefined, tab: PaletteTab): boolean {
  const c = category ?? "";
  if (tab === "elements") return c === ELEMENT_CATEGORY;
  return (BLOCK_PANEL_CATEGORIES as readonly string[]).includes(c);
}
