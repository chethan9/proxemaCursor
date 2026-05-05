import { ProductAttribute, Variation, compositeVariationKey } from "@/services/productEditService";

export type { Variation };

export function generateMatrix(attrs: ProductAttribute[]): Variation[] {
  const forVar = attrs.filter((a) => a.variation && a.options.length > 0);
  if (forVar.length === 0) return [];
  let combos: string[][] = [[]];
  for (const a of forVar) {
    const next: string[][] = [];
    for (const combo of combos) {
      for (const opt of a.options) next.push([...combo, opt]);
    }
    combos = next;
  }
  return combos.map((combo) => {
    const attributes = forVar.map((a, i) => ({ name: a.name, option: combo[i] }));
    return {
      key: compositeVariationKey(attributes),
      attributes,
      regular_price: "",
      sale_price: "",
      sku: "",
      stock_quantity: null,
      stock_status: "instock",
      manage_stock: false,
      weight: "",
      dimensions: { length: "", width: "", height: "" },
      description: "",
      image: null,
      gallery: [],
      enabled: true,
      virtual: false,
      downloadable: false,
      tax_class: "",
    };
  });
}

export function mergeVariations(fresh: Variation[], existing: Variation[]): Variation[] {
  const existingMap = new Map(existing.map((v) => [v.key, v]));
  return fresh.map((v) => existingMap.get(v.key) || v);
}

/** Same name+option pairs when trimmed (case-insensitive). */
export function attributesAreSubset(
  small: { name: string; option: string }[],
  large: { name: string; option: string }[],
): boolean {
  if (small.length > large.length) return false;
  return small.every((sa) =>
    large.some(
      (lb) =>
        lb.name.trim().toLowerCase() === sa.name.trim().toLowerCase() &&
        lb.option.trim().toLowerCase() === sa.option.trim().toLowerCase(),
    ),
  );
}

function variationDataScore(v: Variation): number {
  const p = parseFloat(v.regular_price || "0");
  if (Number.isFinite(p) && p > 0) return 3;
  if ((v.sku || "").trim()) return 2;
  if (v.image?.src) return 1;
  return 0;
}

/**
 * Merge Woo/local variation rows into the new attribute matrix:
 * - Exact key match → keep row (ids, prices, images).
 * - **Extension** (new attribute dimension): copy economics from the closest parent row (subset of attrs).
 * - **Collapse** (removed dimension): fold multiple rows into one, prefer row with price/SKU when tied.
 */
export function mergeVariationsExtended(fresh: Variation[], existing: Variation[]): Variation[] {
  const existingMap = new Map(existing.map((v) => [v.key, v]));

  return fresh.map((fr) => {
    const exact = existingMap.get(fr.key);
    if (exact) {
      return { ...exact, key: fr.key, attributes: fr.attributes };
    }

    const frA = fr.attributes;

    // Extension: fewer dims on an existing row, values ⊆ fresh → inherit pricing/media
    let bestExt: Variation | null = null;
    let bestExtLen = -1;
    let bestExtScore = -1;
    for (const ev of existing) {
      if (!ev.attributes?.length) continue;
      if (ev.attributes.length >= frA.length) continue;
      if (!attributesAreSubset(ev.attributes, frA)) continue;
      const len = ev.attributes.length;
      const sc = variationDataScore(ev);
      if (len > bestExtLen || (len === bestExtLen && sc > bestExtScore)) {
        bestExtLen = len;
        bestExtScore = sc;
        bestExt = ev;
      }
    }
    if (bestExt) {
      return {
        ...fr,
        id: undefined,
        regular_price: bestExt.regular_price,
        sale_price: bestExt.sale_price,
        sku: bestExt.sku,
        image: bestExt.image,
        gallery: bestExt.gallery ?? [],
        manage_stock: bestExt.manage_stock,
        stock_quantity: bestExt.stock_quantity,
        stock_status: bestExt.stock_status,
        weight: bestExt.weight,
        dimensions: bestExt.dimensions ? { ...bestExt.dimensions } : fr.dimensions,
        description: bestExt.description,
        enabled: bestExt.enabled,
        virtual: bestExt.virtual,
        downloadable: bestExt.downloadable,
        tax_class: bestExt.tax_class,
      };
    }

    // Collapse: fresh ⊆ existing → pick most specific superseding row
    let bestCol: Variation | null = null;
    let bestColLen = -1;
    let bestColScore = -1;
    for (const ev of existing) {
      if (!ev.attributes?.length) continue;
      if (frA.length >= ev.attributes.length) continue;
      if (!attributesAreSubset(frA, ev.attributes)) continue;
      const len = ev.attributes.length;
      const sc = variationDataScore(ev);
      if (len > bestColLen || (len === bestColLen && sc > bestColScore)) {
        bestColLen = len;
        bestColScore = sc;
        bestCol = ev;
      }
    }
    if (bestCol) {
      return {
        ...fr,
        id: bestCol.id,
        regular_price: bestCol.regular_price,
        sale_price: bestCol.sale_price,
        sku: bestCol.sku,
        image: bestCol.image,
        gallery: bestCol.gallery ?? [],
        manage_stock: bestCol.manage_stock,
        stock_quantity: bestCol.stock_quantity,
        stock_status: bestCol.stock_status,
        weight: bestCol.weight,
        dimensions: bestCol.dimensions ? { ...bestCol.dimensions } : fr.dimensions,
        description: bestCol.description,
        enabled: bestCol.enabled,
        virtual: bestCol.virtual,
        downloadable: bestCol.downloadable,
        tax_class: bestCol.tax_class,
      };
    }

    return fr;
  });
}

export function variationLabel(v: Variation): string {
  if (!v.attributes?.length) return "—";
  return v.attributes.map((a) => a.option).join(" / ");
}

/** Canonical key for duplicate detection (sorted attrs + lowercased). */
export function variationAttributeComboKey(v: Variation): string {
  if (!v.attributes?.length) return "";
  return compositeVariationKey(v.attributes).toLowerCase();
}