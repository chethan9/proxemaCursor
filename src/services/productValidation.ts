import { ProductFormState, Variation, ProductAttribute, compositeVariationKey } from "@/services/productEditService";
import { supabase } from "@/integrations/supabase/client";

export type ValidationError = { field: string; message: string };
export type ValidationResult = { ok: boolean; errors: ValidationError[] };

function trim(s: string | undefined | null): string {
  return (s ?? "").trim();
}

function isPositivePriceString(s: string | undefined | null): boolean {
  const t = trim(s);
  if (!t) return false;
  if (!/^\d+(\.\d+)?$/.test(t)) return false;
  const n = parseFloat(t);
  return !Number.isNaN(n) && n > 0;
}

function isValidPriceString(s: string | undefined | null): boolean {
  const t = trim(s);
  if (!t) return true;
  return /^\d+(\.\d+)?$/.test(t);
}

function clampNonNeg(n: number | null | undefined): number | null {
  if (n == null) return null;
  if (Number.isNaN(n)) return null;
  return n < 0 ? 0 : n;
}

function normalizeStockCoupling(
  form: { manage_stock: boolean; stock_quantity: number | null; stock_status: "instock" | "outofstock" | "onbackorder" }
): { manage_stock: boolean; stock_quantity: number | null; stock_status: "instock" | "outofstock" | "onbackorder" } {
  let { manage_stock, stock_quantity, stock_status } = form;
  stock_quantity = clampNonNeg(stock_quantity);
  // Rule: if stock_quantity provided → manage_stock auto-true
  if (stock_quantity != null && !manage_stock) manage_stock = true;
  if (manage_stock) {
    if (stock_quantity == null) stock_quantity = 0;
    // qty=0 → outofstock; qty>0 → instock (unless onbackorder preserved explicitly)
    if (stock_quantity === 0) stock_status = "outofstock";
    else if (stock_status !== "onbackorder") stock_status = "instock";
  } else {
    // manage_stock off → omit qty; status defaults to instock unless onbackorder
    stock_quantity = null;
    if (stock_status !== "onbackorder") stock_status = "instock";
  }
  return { manage_stock, stock_quantity, stock_status };
}

export function normalizeProductForm(form: ProductFormState): ProductFormState {
  const trimmed: ProductFormState = {
    ...form,
    name: trim(form.name),
    sku: trim(form.sku),
    slug: trim(form.slug),
    regular_price: trim(form.regular_price),
    sale_price: trim(form.sale_price),
    type: form.type || "simple",
    attributes: form.attributes.map((a) => ({
      ...a,
      name: trim(a.name),
      options: Array.from(
        new Set(a.options.map((o) => trim(o)).filter(Boolean))
      ),
    })),
    variations: form.variations.map((v) => ({
      ...v,
      sku: trim(v.sku),
      regular_price: trim(v.regular_price),
      sale_price: trim(v.sale_price),
      attributes: v.attributes.map((va) => ({
        name: trim(va.name),
        option: trim(va.option),
      })),
    })),
  };

  // Parent stock coupling (only meaningful for simple products)
  if (trimmed.type === "simple") {
    const coupled = normalizeStockCoupling({
      manage_stock: trimmed.manage_stock,
      stock_quantity: trimmed.stock_quantity,
      stock_status: trimmed.stock_status,
    });
    trimmed.manage_stock = coupled.manage_stock;
    trimmed.stock_quantity = coupled.stock_quantity;
    trimmed.stock_status = coupled.stock_status;
  } else {
    // Variable parent: price must be empty, stock handled per-variation
    trimmed.regular_price = "";
    trimmed.sale_price = "";
  }

  // Per-variation coupling
  trimmed.variations = trimmed.variations.map((v) => {
    const coupled = normalizeStockCoupling({
      manage_stock: v.manage_stock,
      stock_quantity: v.stock_quantity,
      stock_status: v.stock_status,
    });
    return {
      ...v,
      manage_stock: coupled.manage_stock,
      stock_quantity: coupled.stock_quantity,
      stock_status: coupled.stock_status,
    };
  });

  return trimmed;
}

export function validateVariation(
  v: Variation,
  parentAttrs: ProductAttribute[]
): ValidationError[] {
  const errs: ValidationError[] = [];
  if (v.enabled === false) return errs;
  if (!isPositivePriceString(v.regular_price)) {
    errs.push({ field: `variation:${v.key}:regular_price`, message: "Variation price required (> 0)" });
  }
  if (!v.attributes || v.attributes.length === 0) {
    errs.push({ field: `variation:${v.key}:attributes`, message: "Variation must have at least one attribute" });
  }
  const variationParentAttrs = parentAttrs.filter((a) => a.variation);
  const parentNames = new Set(variationParentAttrs.map((a) => a.name.toLowerCase()));
  for (const va of v.attributes) {
    if (!parentNames.has(va.name.toLowerCase())) {
      errs.push({
        field: `variation:${v.key}:attributes`,
        message: `Attribute "${va.name}" not defined on parent`,
      });
    }
  }
  if (v.manage_stock && v.stock_quantity != null && v.stock_quantity < 0) {
    errs.push({ field: `variation:${v.key}:stock_quantity`, message: "Stock quantity cannot be negative" });
  }
  const reg = parseFloat(v.regular_price || "0");
  const sale = parseFloat(v.sale_price || "0");
  if (reg > 0 && sale > 0 && sale >= reg) {
    errs.push({ field: `variation:${v.key}:sale_price`, message: "Sale price must be less than regular price" });
  }
  return errs;
}

export function validateProductForm(form: ProductFormState): ValidationResult {
  const errors: ValidationError[] = [];
  const name = trim(form.name);
  if (!name) errors.push({ field: "name", message: "Product name is required" });

  if (!form.type) errors.push({ field: "type", message: "Product type is required" });

  const publishing = form.status === "publish";

  if (form.type === "simple") {
    if (publishing && !isPositivePriceString(form.regular_price)) {
      errors.push({ field: "regular_price", message: "Regular price is required and must be greater than 0" });
    }
    if (form.manage_stock) {
      if (form.stock_quantity == null) {
        errors.push({ field: "stock_quantity", message: "Stock quantity is required when tracking stock" });
      } else if (form.stock_quantity < 0) {
        errors.push({ field: "stock_quantity", message: "Stock quantity cannot be negative" });
      }
    }
  } else if (form.type === "variable") {
    const variationAttrs = form.attributes.filter((a) => a.variation && a.options.length > 0);
    if (variationAttrs.length === 0) {
      errors.push({ field: "attributes", message: "Variable products need at least one attribute marked for variations" });
    }
    if (!form.variations || form.variations.length === 0) {
      errors.push({ field: "variations", message: "At least one variation is required" });
    } else {
      // duplicate combo detection
      const seen = new Map<string, number>();
      form.variations.forEach((v, idx) => {
        if (v.enabled === false) return;
        const key = compositeVariationKey(
          [...v.attributes].sort((a, b) => a.name.localeCompare(b.name))
        ).toLowerCase();
        if (seen.has(key)) {
          errors.push({
            field: `variation:${v.key}:duplicate`,
            message: `Duplicate attribute combination (also at row ${seen.get(key)! + 1})`,
          });
        } else {
          seen.set(key, idx);
        }
      });
      // per-variation errors (only when publishing)
      if (publishing) {
        for (const v of form.variations) {
          errors.push(...validateVariation(v, form.attributes));
        }
      }
    }
  }

  for (const img of form.images) {
    if (!img.id && !trim(img.src)) {
      errors.push({ field: "images", message: "Image requires either a media ID or valid src URL" });
      break;
    }
  }

  return { ok: errors.length === 0, errors };
}

export async function checkSkuUniqueness(
  storeId: string,
  sku: string,
  excludeProductId?: string,
  excludeVariationWooId?: number
): Promise<{ unique: boolean; conflict?: { entity: "product" | "variation"; name: string; id: string } }> {
  const trimmed = trim(sku);
  if (!trimmed) return { unique: true };

  const prodQuery = supabase
    .from("products")
    .select("id,name,sku")
    .eq("store_id", storeId)
    .eq("sku", trimmed)
    .limit(1);
  if (excludeProductId) prodQuery.neq("id", excludeProductId);
  const { data: prods } = await prodQuery;
  if (prods && prods.length > 0) {
    return {
      unique: false,
      conflict: { entity: "product", name: prods[0].name || trimmed, id: prods[0].id },
    };
  }

  let varQuery = supabase
    .from("product_variations")
    .select("id,sku,product_id,woo_id")
    .eq("store_id", storeId)
    .eq("sku", trimmed)
    .limit(1);
  if (excludeVariationWooId) varQuery = varQuery.neq("woo_id", excludeVariationWooId);
  const { data: vars } = await varQuery;
  if (vars && vars.length > 0) {
    return {
      unique: false,
      conflict: { entity: "variation", name: `Variation ${vars[0].sku}`, id: vars[0].id },
    };
  }

  return { unique: true };
}

function priceStr(s: string | undefined | null): string {
  const t = trim(s);
  if (!t) return "";
  const n = parseFloat(t);
  if (Number.isNaN(n)) return "";
  return n < 0 ? "0" : String(n);
}

export function buildWooPayload(formRaw: ProductFormState): Record<string, unknown> {
  const form = normalizeProductForm(formRaw);

  const payload: Record<string, unknown> = {
    name: form.name,
    type: form.type,
    status: form.status,
    description: form.description,
    short_description: form.short_description || "",
    sku: form.sku || "",
    manage_stock: form.manage_stock,
    stock_status: form.stock_status,
    sold_individually: !!form.sold_individually,
    tax_status: form.tax_status || "taxable",
    tax_class: form.tax_class || "",
    categories: form.categories.map((c) => ({ id: c.id })),
    tags: form.tags.map((t) => (t.id ? { id: t.id } : { name: t.name })),
    images: form.images.map((img) => (img.id ? { id: img.id } : { src: img.src, alt: img.alt || "" })),
    attributes: form.attributes.map((a) => {
      const base: Record<string, unknown> = {
        name: a.name,
        options: a.options,
        variation: a.variation,
        visible: a.visible,
      };
      if (a.id && a.id > 0) base.id = a.id;
      return base;
    }),
  };

  if (form.type === "simple") {
    const rp = priceStr(form.regular_price);
    if (rp) payload.regular_price = rp;
    const sp = priceStr(form.sale_price);
    if (sp) payload.sale_price = sp;
    if (form.manage_stock && form.stock_quantity != null) {
      payload.stock_quantity = Math.max(0, form.stock_quantity);
    }
  }
  // For variable: no regular_price / sale_price / stock_quantity at parent level

  if (form.weight) payload.weight = priceStr(form.weight);
  if (form.dimensions && (form.dimensions.length || form.dimensions.width || form.dimensions.height)) {
    payload.dimensions = {
      length: priceStr(form.dimensions.length),
      width: priceStr(form.dimensions.width),
      height: priceStr(form.dimensions.height),
    };
  }
  if (form.brands && form.brands.length) payload.brands = form.brands.map((b) => ({ id: b.id }));
  if (form.meta_data) payload.meta_data = form.meta_data;

  if (form.type === "variable" && form.variations.length > 0) {
    payload.variations = form.variations.map((v) => {
      const vp: Record<string, unknown> = {
        id: v.id,
        regular_price: priceStr(v.regular_price),
        sale_price: priceStr(v.sale_price),
        sku: v.sku,
        manage_stock: v.manage_stock,
        stock_status: v.stock_status,
        weight: priceStr(v.weight),
        dimensions: {
          length: priceStr(v.dimensions.length),
          width: priceStr(v.dimensions.width),
          height: priceStr(v.dimensions.height),
        },
        description: v.description,
        image: v.image,
        gallery: v.gallery || [],
        enabled: v.enabled !== false,
        virtual: !!v.virtual,
        downloadable: !!v.downloadable,
        tax_class: v.tax_class || "",
        attributes: v.attributes,
      };
      if (v.manage_stock && v.stock_quantity != null) {
        vp.stock_quantity = Math.max(0, v.stock_quantity);
      }
      return vp;
    });
  }

  if (form.deletedVariationIds && form.deletedVariationIds.length) {
    payload.deleted_variation_ids = form.deletedVariationIds;
  }

  return payload;
}

export function friendlySkuError(message: string): string {
  if (!message) return "";
  if (/product_invalid_sku|duplicate.*sku|sku.*already|already.*sku/i.test(message)) {
    return "This SKU is already used by another product or variation. Please choose a unique SKU.";
  }
  return message;
}