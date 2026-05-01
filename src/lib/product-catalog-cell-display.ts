import type { CatalogColumnKey } from "@/lib/product-catalog-columns";

/** Strip HTML for plain-text preview in the products table. */
export function stripHtmlForTablePreview(html: string): string {
  return html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

export function ellipsisText(raw: string, maxLen: number): string {
  const s = raw.replace(/\s+/g, " ").trim();
  if (!s) return "";
  if (s.length <= maxLen) return s;
  if (maxLen <= 1) return "…";
  return `${s.slice(0, maxLen - 1)}…`;
}

/**
 * Max characters shown in the products **table** list view (exports keep full values).
 * Tuned so rows stay one line high and the table does not overflow horizontally.
 */
export const PRODUCT_TABLE_CELL_MAX_CHARS: Partial<Record<CatalogColumnKey, number>> = {
  id: 36,
  wooId: 14,
  name: 52,
  slug: 36,
  sku: 28,
  type: 18,
  status: 14,
  permalink: 44,
  parent_id: 12,
  price: 18,
  regular_price: 18,
  sale_price: 18,
  stock: 12,
  stock_status: 18,
  manage_stock: 10,
  tax_status: 14,
  tax_class: 20,
  shipping_required: 10,
  category: 72,
  brands: 56,
  attributes: 96,
  images_count: 8,
  short_desc: 96,
  description: 120,
  date_created: 22,
  date_modified: 22,
  sales: 24,
  created: 22,
  updated: 22,
};

/** Responsive hiding for dense product table (mirrors Orders “de-prioritize wide columns”). */
export function productsColumnDensityClass(key: CatalogColumnKey): string {
  switch (key) {
    case "slug":
    case "permalink":
    case "tax_class":
    case "attributes":
      return "hidden xl:table-cell";
    case "short_desc":
    case "description":
      return "hidden 2xl:table-cell";
    default:
      return "";
  }
}

/** Tailwind max-width per column so `truncate` can take effect. */
export const PRODUCT_TABLE_CELL_MAX_WIDTH: Partial<Record<CatalogColumnKey, string>> = {
  id: "max-w-[9rem]",
  wooId: "max-w-[5.5rem]",
  name: "max-w-[min(14rem,28vw)]",
  slug: "max-w-[9rem]",
  sku: "max-w-[6.5rem]",
  type: "max-w-[8rem]",
  status: "max-w-[7rem]",
  permalink: "max-w-[12rem]",
  parent_id: "max-w-[6rem]",
  price: "max-w-[7rem]",
  regular_price: "max-w-[7rem]",
  sale_price: "max-w-[7rem]",
  stock: "max-w-[6rem]",
  stock_status: "max-w-[8rem]",
  manage_stock: "max-w-[8rem]",
  tax_status: "max-w-[8rem]",
  tax_class: "max-w-[9rem]",
  shipping_required: "max-w-[8rem]",
  category: "max-w-[min(15rem,30vw)]",
  brands: "max-w-[min(13rem,26vw)]",
  attributes: "max-w-[min(14rem,28vw)]",
  images_count: "max-w-[6rem]",
  short_desc: "max-w-[min(18rem,34vw)]",
  description: "max-w-[min(20rem,36vw)]",
  date_created: "max-w-[10rem]",
  date_modified: "max-w-[10rem]",
  sales: "max-w-[11rem]",
  created: "max-w-[11rem]",
  updated: "max-w-[11rem]",
};

const SANS_KEYS = new Set<CatalogColumnKey>([
  "name",
  "category",
  "brands",
  "short_desc",
  "description",
  "status",
  "type",
  "stock_status",
]);

export function catalogCellTextClass(key: CatalogColumnKey): string {
  const base = SANS_KEYS.has(key) ? "text-xs block truncate" : "text-xs font-mono block truncate";
  return key === "status" ? `${base} font-medium` : base;
}

export function catalogCellClass(key: CatalogColumnKey): string {
  const w = PRODUCT_TABLE_CELL_MAX_WIDTH[key] ?? "max-w-[11rem]";
  const d = productsColumnDensityClass(key);
  return [w, "min-w-0 align-top", d].filter(Boolean).join(" ");
}

const DEFAULT_MAX = 44;

export function catalogCellDisplay(key: CatalogColumnKey, raw: string): { text: string; title?: string } {
  const max = PRODUCT_TABLE_CELL_MAX_CHARS[key] ?? DEFAULT_MAX;
  const full = raw.replace(/\s+/g, " ").trim();
  if (!full) return { text: "—" };
  const shortened = ellipsisText(full, max);
  return {
    text: shortened,
    title: full.length > max ? full : undefined,
  };
}
