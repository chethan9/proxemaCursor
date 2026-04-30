/** Categories used by the Grapes BlockManager.
 * Tab "Elements" shows ELEMENT_CATEGORY only.
 * Tab "Blocks" shows everything in BLOCK_PANEL_CATEGORIES.
 */
export const ELEMENT_CATEGORY = "Basic";
export const WOO_CATEGORY = "WooCommerce";
export const LAYOUT_CATEGORY = "Layout";
export const REPORT_CATEGORY = "Reports";

export const BLOCK_PANEL_CATEGORIES = [
  WOO_CATEGORY,
  LAYOUT_CATEGORY,
  REPORT_CATEGORY,
] as const;

export type PaletteTab = "elements" | "blocks";

export function blockMatchesPaletteTab(category: string | undefined, tab: PaletteTab): boolean {
  const c = category ?? "";
  if (tab === "elements") return c === ELEMENT_CATEGORY;
  return (BLOCK_PANEL_CATEGORIES as readonly string[]).includes(c);
}
