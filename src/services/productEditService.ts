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
  };
}

export function formToWooPayload(form: ProductFormState): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    name: form.name,
    type: form.type,
    status: form.status,
    description: form.description,
    short_description: form.short_description || "",
    regular_price: form.regular_price || "",
    sale_price: form.sale_price || "",
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
  if (form.manage_stock && form.stock_quantity != null) payload.stock_quantity = form.stock_quantity;
  if (form.weight) payload.weight = form.weight;
  if (form.dimensions && (form.dimensions.length || form.dimensions.width || form.dimensions.height)) {
    payload.dimensions = form.dimensions;
  }
  if (form.brands && form.brands.length) payload.brands = form.brands.map((b) => ({ id: b.id }));
  if (form.meta_data) payload.meta_data = form.meta_data;
  if (form.type === "variable" && form.variations.length > 0) {
    payload.variations = form.variations.map((v) => ({
      id: v.id,
      regular_price: v.regular_price,
      sale_price: v.sale_price,
      sku: v.sku,
      manage_stock: v.manage_stock,
      stock_quantity: v.stock_quantity,
      stock_status: v.stock_status,
      weight: v.weight,
      dimensions: v.dimensions,
      description: v.description,
      image: v.image,
      attributes: v.attributes,
    }));
  }
  return payload;
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