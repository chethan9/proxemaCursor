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
    tax_status: "taxable",
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
  };
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
  const res = await fetch(`/api/stores/${storeId}/products/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(formToWooPayload(form)),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.error || `Create failed (${res.status})`);
  }
  return res.json();
}

export async function updateProduct(storeId: string, productId: string, form: ProductFormState) {
  const res = await fetch(`/api/stores/${storeId}/products/${productId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(formToWooPayload(form)),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.error || `Update failed (${res.status})`);
  }
  return res.json();
}