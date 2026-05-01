import type { ProductFormState } from "@/services/productEditService";

/** Matches AdvancedShell tab keys */
export type ProductEditTabKey = "basic" | "pricing" | "inventory" | "variants";

/** Stable JSON snapshot of fields owned by each advanced tab (for dirty detection). */
export function sliceFormForTab(form: ProductFormState, tab: ProductEditTabKey): string {
  switch (tab) {
    case "basic":
      return JSON.stringify({
        name: form.name,
        description: form.description,
        short_description: form.short_description ?? "",
        slug: form.slug ?? "",
        images: form.images,
        categories: form.categories,
        brands: form.brands ?? [],
        tags: form.tags,
        attributes: form.attributes,
        default_attributes: form.default_attributes ?? [],
      });
    case "pricing":
      return JSON.stringify({
        regular_price: form.regular_price,
        sale_price: form.sale_price,
        tax_status: form.tax_status,
        tax_class: form.tax_class ?? "",
      });
    case "inventory":
      return JSON.stringify({
        regular_price: form.regular_price,
        sale_price: form.sale_price,
        tax_status: form.tax_status,
        tax_class: form.tax_class ?? "",
        manage_stock: form.manage_stock,
        stock_quantity: form.stock_quantity,
        stock_status: form.stock_status,
        sold_individually: form.sold_individually ?? false,
        sku: form.sku ?? "",
        weight: form.weight ?? "",
        dimensions: form.dimensions ?? { length: "", width: "", height: "" },
      });
    case "variants":
      return JSON.stringify({
        type: form.type,
        attributes: form.attributes,
        default_attributes: form.default_attributes ?? [],
        variations: form.variations,
        deletedVariationIds: form.deletedVariationIds ?? [],
      });
    default:
      return "";
  }
}

export function isTabDirty(
  baseline: ProductFormState | null,
  form: ProductFormState,
  tab: ProductEditTabKey,
): boolean {
  if (!baseline) return false;
  return sliceFormForTab(form, tab) !== sliceFormForTab(baseline, tab);
}
