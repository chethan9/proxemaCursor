import type { ProductSortField } from "@/services/productService";

export type CatalogColumnKey =
  | "image" | "id" | "wooId" | "name" | "slug" | "sku" | "type" | "status" | "permalink" | "parent_id"
  | "price" | "regular_price" | "sale_price"
  | "stock" | "stock_status" | "manage_stock"
  | "tax_status" | "tax_class" | "shipping_required"
  | "category" | "brands" | "attributes" | "images_count"
  | "short_desc" | "description"
  | "date_created" | "date_modified" | "sales" | "created" | "updated";

/** Columns available in explorer + CSV/PDF/XLSX export (shared labels). */
export const PRODUCT_CATALOG_COLUMNS: { key: CatalogColumnKey; label: string; group: string; sortable?: ProductSortField }[] = [
  { key: "image", label: "Image", group: "Basic" },
  { key: "id", label: "ID", group: "Basic" },
  { key: "wooId", label: "Woo ID", group: "Basic" },
  { key: "name", label: "Product name", group: "Basic", sortable: "name" },
  { key: "slug", label: "Slug", group: "Basic" },
  { key: "sku", label: "SKU", group: "Basic" },
  { key: "type", label: "Type", group: "Basic" },
  { key: "status", label: "Status", group: "Basic" },
  { key: "permalink", label: "Permalink", group: "Basic" },
  { key: "parent_id", label: "Parent ID", group: "Basic" },
  { key: "price", label: "Price", group: "Pricing", sortable: "price" },
  { key: "regular_price", label: "Regular price", group: "Pricing" },
  { key: "sale_price", label: "Sale price", group: "Pricing" },
  { key: "stock", label: "Stock qty", group: "Inventory", sortable: "stock_quantity" },
  { key: "stock_status", label: "Stock status", group: "Inventory" },
  { key: "manage_stock", label: "Manage stock", group: "Inventory" },
  { key: "tax_status", label: "Tax status", group: "Tax & Shipping" },
  { key: "tax_class", label: "Tax class", group: "Tax & Shipping" },
  { key: "shipping_required", label: "Shipping required", group: "Tax & Shipping" },
  { key: "category", label: "Categories", group: "Taxonomy" },
  { key: "brands", label: "Brands", group: "Taxonomy" },
  { key: "attributes", label: "Attributes", group: "Taxonomy" },
  { key: "images_count", label: "Images count", group: "Taxonomy" },
  { key: "short_desc", label: "Short description", group: "Content" },
  { key: "description", label: "Description", group: "Content" },
  { key: "date_created", label: "Date created (Woo)", group: "Dates" },
  { key: "date_modified", label: "Date modified (Woo)", group: "Dates" },
  { key: "sales", label: "Last synced", group: "Dates", sortable: "synced_at" },
  { key: "created", label: "Created at (DB)", group: "Dates", sortable: "created_at" },
  { key: "updated", label: "Updated at (DB)", group: "Dates", sortable: "updated_at" },
];

export const EXPORT_META_HEADERS = [
  "Row kind",
  "Parent WooCommerce ID",
  "Variation WooCommerce ID",
  "Variation options",
] as const;
