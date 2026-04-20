import { ProductAttribute, Variation, compositeVariationKey } from "@/services/productEditService";

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

export function variationLabel(v: Variation): string {
  return v.attributes.map((a) => a.option).join(" / ");
}