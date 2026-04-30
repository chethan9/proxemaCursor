import { getCategoryNames } from "@/services/productService";
import type { ProductRow } from "@/services/productService";
import type { CatalogColumnKey } from "@/lib/product-catalog-columns";

export type ExportRowKind = "simple" | "variation" | "parent_only";

export type ProductVariationForExport = {
  woo_id: number;
  woo_parent_id: number;
  sku: string | null;
  regular_price: number | null;
  sale_price: number | null;
  price: number | null;
  stock_quantity: number | null;
  stock_status: string | null;
  manage_stock: boolean | null;
  attributes: unknown;
};

function numOrStr(n: number | null | undefined, fallback: string | number | null | undefined): string {
  if (n != null && Number.isFinite(n)) return String(n);
  if (fallback == null) return "";
  return String(fallback);
}

function formatVariationOptions(attrs: unknown): string {
  if (!Array.isArray(attrs)) return "";
  return (attrs as { name?: string; option?: string }[])
    .map((a) => `${(a.name || "").trim()}: ${(a.option || "").trim()}`.trim())
    .filter(Boolean)
    .join(" | ");
}

function stripHtml(s: string, max: number): string {
  return s.replace(/<[^>]+>/g, "").slice(0, max);
}

/**
 * Display name: parent + variation options when a variation row is present.
 */
export function buildExportDisplayName(parent: ProductRow, variation: ProductVariationForExport | null): string {
  const base = (parent.name || "").trim();
  if (!variation) return base;
  const opts = formatVariationOptions(variation.attributes);
  if (!opts) return base;
  return base ? `${base} — ${opts}` : opts;
}

export function getMetaCells(
  kind: ExportRowKind,
  parentWooId: number | null,
  variationWooId: number | null,
  variationOptions: string
): string[] {
  return [kind, parentWooId != null ? String(parentWooId) : "", variationWooId != null ? String(variationWooId) : "", variationOptions];
}

export function getCatalogCellValue(
  key: CatalogColumnKey,
  parent: ProductRow,
  variation: ProductVariationForExport | null
): string | number {
  const raw = parent.raw_data || {};
  const useVar = variation != null;

  switch (key) {
    case "id":
      return parent.id;
    case "name":
      return buildExportDisplayName(parent, variation);
    case "status":
      return parent.status || "";
    case "sku":
      return useVar ? (variation!.sku || "") : (parent.sku || "");
    case "price":
      return useVar ? numOrStr(variation!.price, "") : String(parent.price ?? "");
    case "regular_price":
      return useVar ? numOrStr(variation!.regular_price, "") : String(parent.regular_price ?? "");
    case "sale_price":
      return useVar ? numOrStr(variation!.sale_price, "") : String(parent.sale_price ?? "");
    case "stock":
      return useVar ? (variation!.stock_quantity ?? "") : (parent.stock_quantity ?? "");
    case "stock_status":
      return useVar ? (variation!.stock_status || "") : (parent.stock_status || "");
    case "manage_stock":
      return useVar ? String(!!variation!.manage_stock) : String((raw.manage_stock as boolean | string) ?? "");
    case "category":
      return getCategoryNames(parent.categories);
    case "type":
      return useVar ? "variation" : (parent.type || "");
    case "slug":
      return parent.slug || "";
    case "wooId":
      return useVar ? variation!.woo_id : (parent.woo_id ?? "");
    case "parent_id":
      return (raw.parent_id as number) ?? "";
    case "permalink":
      return (raw.permalink as string) || "";
    case "tax_status":
      return (raw.tax_status as string) || "";
    case "tax_class":
      return (raw.tax_class as string) || "";
    case "shipping_required":
      return String((raw.shipping_required as boolean) ?? "");
    case "images_count":
      return Array.isArray(parent.images) ? parent.images.length : 0;
    case "short_desc":
      return stripHtml(parent.short_description || "", 200);
    case "description":
      return stripHtml(parent.description || "", 500);
    case "attributes":
      return useVar ? JSON.stringify(variation!.attributes || []) : JSON.stringify(parent.attributes || []);
    case "date_created":
      return (raw.date_created as string) || "";
    case "date_modified":
      return (raw.date_modified as string) || "";
    case "sales":
      return parent.synced_at || "";
    case "created":
      return parent.created_at || "";
    case "updated":
      return parent.updated_at || "";
    case "brands":
      return JSON.stringify(parent.brands || []);
    case "image":
      return "";
    default:
      return "";
  }
}

export function rowToCellStrings(
  keys: CatalogColumnKey[],
  parent: ProductRow,
  variation: ProductVariationForExport | null,
  meta: ExportRowKind,
): string[] {
  const opts = variation ? formatVariationOptions(variation.attributes) : "";
  const metaCells = getMetaCells(meta, parent.woo_id, variation?.woo_id ?? null, opts);
  const dataCells = keys.map((k) => {
    const v = getCatalogCellValue(k, parent, variation);
    return typeof v === "number" ? String(v) : v;
  });
  return [...metaCells, ...dataCells];
}
