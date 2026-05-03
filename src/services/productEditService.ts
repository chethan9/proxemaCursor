import type { ProductImageMirrorUrlsMap } from "@/lib/product-image-urls";

export type ProductAttribute = {
  id?: number;
  name: string;
  slug?: string;
  options: string[];
  variation: boolean;
  visible: boolean;
};

export type Variation = {
  id?: number;
  key: string;
  attributes: { name: string; option: string }[];
  regular_price: string;
  sale_price: string;
  sku: string;
  stock_quantity: number | null;
  stock_status: "instock" | "outofstock" | "onbackorder";
  manage_stock: boolean;
  weight: string;
  dimensions: { length: string; width: string; height: string };
  description: string;
  image: { id?: number; src: string; alt?: string } | null;
  gallery?: { id?: number; src: string; alt?: string }[];
  enabled?: boolean;
  virtual?: boolean;
  downloadable?: boolean;
  tax_class?: string;
};

export type ProductFormState = {
  name: string;
  description: string;
  short_description?: string;
  slug?: string;
  status: "publish" | "draft" | "pending" | "private";
  type: "simple" | "variable";
  regular_price: string;
  sale_price: string;
  tax_status?: "taxable" | "none";
  tax_class?: string;
  manage_stock: boolean;
  stock_quantity: number | null;
  stock_status: "instock" | "outofstock" | "onbackorder";
  sold_individually?: boolean;
  weight?: string;
  dimensions?: { length: string; width: string; height: string };
  sku?: string;
  categories: { id: number; name?: string }[];
  tags: { id?: number; name: string }[];
  brands?: { id: number; name?: string }[];
  images: { id?: number; src: string; alt?: string }[];
  attributes: ProductAttribute[];
  variations: Variation[];
  deletedVariationIds?: number[];
  meta_data?: { key: string; value: unknown }[];
  default_attributes?: { id?: number; name: string; option: string }[];
  /** Cloudflare Images variant URLs from DB (preview acceleration; not sent to Woo). */
  image_mirror_urls?: ProductImageMirrorUrlsMap;
};

export function emptyProductForm(): ProductFormState {
  return {
    name: "",
    description: "",
    short_description: "",
    status: "publish",
    type: "simple",
    regular_price: "",
    sale_price: "",
    tax_status: "none",
    tax_class: "",
    manage_stock: false,
    stock_quantity: null,
    stock_status: "instock",
    sold_individually: false,
    weight: "",
    dimensions: { length: "", width: "", height: "" },
    sku: "",
    categories: [],
    tags: [],
    brands: [],
    images: [],
    attributes: [],
    variations: [],
    deletedVariationIds: [],
    default_attributes: [],
  };
}

/**
 * Match a Woo variation/default attribute row to the parent attribute definition.
 * Woo often sends global attrs as `pa_*` slugs or uses attribute id while the editor stores human-readable names.
 */
export function resolveAttrRowToParent(
  row: { id?: number; name: string },
  parentAttributes: ProductAttribute[],
): ProductAttribute | undefined {
  const varDims = parentAttributes.filter((a) => a.variation);
  if (typeof row.id === "number" && row.id > 0) {
    const byId = varDims.find((p) => p.id === row.id);
    if (byId) return byId;
  }
  const rn = row.name.trim().toLowerCase();
  const exact = varDims.find((p) => p.name.trim().toLowerCase() === rn);
  if (exact) return exact;
  const slug = rn.startsWith("pa_") ? rn.slice(3) : rn;
  return varDims.find((p) => {
    const pn = p.name.trim().toLowerCase().replace(/\s+/g, "-");
    const ps = (p.slug || "").trim().toLowerCase();
    return pn === slug || ps === rn || ps.replace(/^pa_/, "") === slug || pn.replace(/^pa_/, "") === slug;
  });
}

function defaultAttributeTuplesEqual(
  a: { id?: number; name: string; option: string }[],
  b: { id?: number; name: string; option: string }[],
  parents: ProductAttribute[],
): boolean {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return false;
  const key = (d: { id?: number; name: string; option: string }) => {
    const pa = resolveAttrRowToParent(d, parents);
    const pk = pa ? `p:${String(pa.id ?? pa.name).toLowerCase()}` : `n:${d.name.trim().toLowerCase()}`;
    return `${pk}=${d.option.trim().toLowerCase()}`;
  };
  const sa = new Set(a.map(key));
  const sb = new Set(b.map(key));
  if (sa.size !== sb.size) return false;
  for (const x of sa) if (!sb.has(x)) return false;
  return true;
}

export function variationMatchesDefault(
  variation: Variation,
  defaultAttrs: { name: string; option: string }[] | undefined,
  parentAttributes?: ProductAttribute[],
): boolean {
  if (!defaultAttrs || defaultAttrs.length === 0) return false;
  if (variation.attributes.length === 0) return false;

  const varDims = parentAttributes?.filter((a) => a.variation && (a.options?.length ?? 0) > 0) ?? [];
  if (parentAttributes && varDims.length > 0) {
    const expected = defaultAttributesFromVariation(variation, parentAttributes);
    return defaultAttributeTuplesEqual(expected, defaultAttrs, parentAttributes);
  }

  return defaultAttrs.every((d) =>
    variation.attributes.some(
      (va) =>
        va.name.trim().toLowerCase() === d.name.trim().toLowerCase() &&
        va.option.trim().toLowerCase() === d.option.trim().toLowerCase(),
    ),
  );
}

export function defaultAttributesFromVariation(
  v: Variation,
  parentAttributes: ProductAttribute[],
): { id?: number; name: string; option: string }[] {
  const varDims = parentAttributes.filter((a) => a.variation && (a.options?.length ?? 0) > 0);
  if (varDims.length > 0) {
    const out: { id?: number; name: string; option: string }[] = [];
    for (const pa of varDims) {
      const va = v.attributes.find((attr) => {
        const resolved = resolveAttrRowToParent(attr, parentAttributes);
        return resolved?.name === pa.name;
      });
      if (va) {
        out.push({
          ...(typeof pa.id === "number" && pa.id > 0 ? { id: pa.id } : {}),
          name: pa.name,
          option: va.option,
        });
      }
    }
    return out;
  }

  const variableNames = new Set(parentAttributes.filter((a) => a.variation).map((a) => a.name.toLowerCase()));
  const nameToId = new Map<string, number | undefined>();
  parentAttributes.forEach((a) => nameToId.set(a.name.toLowerCase(), a.id));
  return v.attributes
    .filter((a) => variableNames.size === 0 || variableNames.has(a.name.toLowerCase()))
    .map((a) => ({
      ...(nameToId.get(a.name.toLowerCase()) ? { id: nameToId.get(a.name.toLowerCase()) } : {}),
      name: a.name,
      option: a.option,
    }));
}

export function compositeVariationKey(attrs: { name: string; option: string }[]): string {
  return attrs.map((a) => `${a.name}=${a.option}`).join("|");
}

function floorNumStr(v: string | undefined | null): string {
  if (!v) return "";
  const n = parseFloat(v);
  if (Number.isNaN(n)) return "";
  return n < 0 ? "0" : String(n);
}

export function formToWooPayload(form: ProductFormState): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    name: form.name,
    type: form.type,
    status: form.status,
    description: form.description,
    short_description: form.short_description || "",
    regular_price: floorNumStr(form.regular_price),
    sale_price: floorNumStr(form.sale_price),
    sku: form.sku || "",
    manage_stock: form.manage_stock,
    stock_status: form.stock_status,
    sold_individually: !!form.sold_individually,
    tax_status: form.tax_status || "taxable",
    tax_class: form.tax_class || "",
    categories: form.categories.map((c) => ({ id: c.id })),
    tags: form.tags.map((t) => (t.id ? { id: t.id } : { name: t.name })),
    images: form.images.map((img) => (img.id ? { id: img.id } : { src: img.src, alt: img.alt || "" })),
    attributes: form.attributes.map((a) => ({
      id: a.id || 0,
      name: a.name,
      options: a.options,
      variation: a.variation,
      visible: a.visible,
    })),
  };
  if (form.manage_stock && form.stock_quantity != null) payload.stock_quantity = Math.max(0, form.stock_quantity);
  if (form.weight) payload.weight = floorNumStr(form.weight);
  if (form.dimensions && (form.dimensions.length || form.dimensions.width || form.dimensions.height)) {
    payload.dimensions = {
      length: floorNumStr(form.dimensions.length),
      width: floorNumStr(form.dimensions.width),
      height: floorNumStr(form.dimensions.height),
    };
  }
  if (form.brands && form.brands.length) payload.brands = form.brands.map((b) => ({ id: b.id }));
  if (form.meta_data) payload.meta_data = form.meta_data;
  if (form.type === "variable" && form.default_attributes && form.default_attributes.length > 0) {
    payload.default_attributes = form.default_attributes;
  }
  if (form.type === "variable" && form.variations.length > 0) {
    payload.variations = form.variations.map((v) => ({
      id: v.id,
      regular_price: floorNumStr(v.regular_price),
      sale_price: floorNumStr(v.sale_price),
      sku: v.sku,
      manage_stock: v.manage_stock,
      stock_quantity: v.stock_quantity == null ? null : Math.max(0, v.stock_quantity),
      stock_status: v.stock_status,
      weight: floorNumStr(v.weight),
      dimensions: {
        length: floorNumStr(v.dimensions.length),
        width: floorNumStr(v.dimensions.width),
        height: floorNumStr(v.dimensions.height),
      },
      description: v.description,
      image: v.image,
      gallery: v.gallery || [],
      enabled: v.enabled !== false,
      virtual: !!v.virtual,
      downloadable: !!v.downloadable,
      tax_class: v.tax_class || "",
      attributes: v.attributes,
    }));
  }
  if (form.deletedVariationIds && form.deletedVariationIds.length) {
    payload.deleted_variation_ids = form.deletedVariationIds;
  }
  return payload;
}

export async function fetchProductVariations(storeId: string, productId: string): Promise<Variation[]> {
  const res = await fetch(`/api/stores/${storeId}/products/${productId}/variations`);
  if (!res.ok) throw new Error(`Failed to load variations (${res.status})`);
  return res.json();
}

export async function createProduct(storeId: string, form: ProductFormState) {
  const { buildWooPayload, validateProductForm } = await import("@/services/productValidation");
  const validation = validateProductForm(form);
  if (!validation.ok) {
    const e = new Error("Validation failed") as ProductError;
    e.validationErrors = validation.errors.map(({ field, message }) => ({ field, message }));
    throw e;
  }
  const res = await fetch(`/api/stores/${storeId}/products/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildWooPayload(form)),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const e = makeProductError(err, res.status);
    throw e;
  }
  return res.json();
}

export async function updateProduct(storeId: string, productId: string, form: ProductFormState) {
  const { buildWooPayload, validateProductForm } = await import("@/services/productValidation");
  const validation = validateProductForm(form);
  if (!validation.ok) {
    const e = new Error("Validation failed") as ProductError;
    e.validationErrors = validation.errors.map(({ field, message }) => ({ field, message }));
    throw e;
  }
  const res = await fetch(`/api/stores/${storeId}/products/${productId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildWooPayload(form)),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const e = makeProductError(err, res.status);
    throw e;
  }
  return res.json();
}

export type ProductValidationIssue = { field: string; message: string };
export type ProductError = Error & { validationErrors?: ProductValidationIssue[]; status?: number };

function makeProductError(body: Record<string, unknown>, status: number): ProductError {
  const errors = Array.isArray(body.errors) ? (body.errors as ProductValidationIssue[]) : undefined;
  let message = (body.message as string) || (body.error as string) || `Request failed (${status})`;
  const code = body.code as string | undefined;
  const wooStatus = body.woo_status as number | undefined;
  const wooBody = body.woo_body as string | undefined;
  const blockingHint = body.blocking_hint as string | undefined;
  const blockingService = body.blocking_service as string | undefined;
  if (code === "product_invalid_sku" || /sku/i.test(message) && /duplicat|invalid|exists|taken/i.test(message)) {
    message = `SKU already in use. Pick a different SKU or auto-generate one.`;
  }
  if (errors && errors.length > 0 && !body.message) {
    message = errors.map((e) => e.message).slice(0, 3).join(" • ");
    if (errors.length > 3) message += ` (+${errors.length - 3} more)`;
  }
  if (blockingService) {
    message = `${blockingService.toUpperCase()} firewall blocked the request${blockingHint ? `: ${blockingHint}` : ""}`;
  } else if (wooStatus) {
    const detail = wooBody ? ` — ${wooBody.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 200)}` : "";
    if (!message.toLowerCase().includes("woocommerce")) {
      message = `WooCommerce ${wooStatus}${detail || `: ${message}`}`;
    }
  }
  const e = new Error(message) as ProductError;
  e.validationErrors = errors;
  e.status = status;
  return e;
}