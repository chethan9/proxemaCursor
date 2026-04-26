import type { TemplateType } from "./document";

export interface VariableDef {
  path: string;
  label: string;
  example: string;
  group: string;
}

const STORE_VARS: VariableDef[] = [
  { path: "store.name", label: "Store name", example: "Beam Shop", group: "Store" },
  { path: "store.email", label: "Store email", example: "hello@beamshop.com", group: "Store" },
  { path: "store.phone", label: "Store phone", example: "+965 555 1234", group: "Store" },
  { path: "store.address", label: "Store address", example: "Salem Mubarak St, Salmiya, Kuwait", group: "Store" },
  { path: "store.logo", label: "Store logo URL", example: "https://...", group: "Store" },
];

const ORDER_BASE: VariableDef[] = [
  { path: "order.number", label: "Order number", example: "#7264", group: "Order" },
  { path: "order.date", label: "Order date", example: "Apr 26, 2026", group: "Order" },
  { path: "order.status", label: "Order status", example: "Completed", group: "Order" },
  { path: "order.currency", label: "Currency", example: "KWD", group: "Order" },
  { path: "order.notes", label: "Customer notes", example: "Leave at door", group: "Order" },
];

const CUSTOMER_VARS: VariableDef[] = [
  { path: "order.customer.name", label: "Customer name", example: "Mohammed Alaskar", group: "Customer" },
  { path: "order.customer.email", label: "Customer email", example: "m@example.com", group: "Customer" },
  { path: "order.customer.phone", label: "Customer phone", example: "0540914183", group: "Customer" },
];

const ADDRESS_VARS = (prefix: "billing" | "shipping"): VariableDef[] => [
  { path: `order.${prefix}.first_name`, label: `${prefix} first name`, example: "Mohammed", group: prefix === "billing" ? "Billing" : "Shipping" },
  { path: `order.${prefix}.last_name`, label: `${prefix} last name`, example: "Alaskar", group: prefix === "billing" ? "Billing" : "Shipping" },
  { path: `order.${prefix}.address_1`, label: `${prefix} address line 1`, example: "House, Riyadh-Alkharj", group: prefix === "billing" ? "Billing" : "Shipping" },
  { path: `order.${prefix}.city`, label: `${prefix} city`, example: "Riyadh", group: prefix === "billing" ? "Billing" : "Shipping" },
  { path: `order.${prefix}.postcode`, label: `${prefix} postal code`, example: "12345", group: prefix === "billing" ? "Billing" : "Shipping" },
  { path: `order.${prefix}.country`, label: `${prefix} country`, example: "SA", group: prefix === "billing" ? "Billing" : "Shipping" },
];

const TOTALS_VARS: VariableDef[] = [
  { path: "order.totals.subtotal", label: "Subtotal", example: "44.00", group: "Totals" },
  { path: "order.totals.shipping", label: "Shipping", example: "8.50", group: "Totals" },
  { path: "order.totals.tax", label: "Tax", example: "0.00", group: "Totals" },
  { path: "order.totals.discount", label: "Discount", example: "0.00", group: "Totals" },
  { path: "order.totals.total", label: "Total", example: "52.50", group: "Totals" },
];

const PAYMENT_VARS: VariableDef[] = [
  { path: "order.payment.method", label: "Payment method", example: "MyFatoorah - Cards", group: "Payment" },
];

export const INVOICE_CATALOG: VariableDef[] = [
  ...STORE_VARS,
  ...ORDER_BASE,
  ...CUSTOMER_VARS,
  ...ADDRESS_VARS("billing"),
  ...ADDRESS_VARS("shipping"),
  ...TOTALS_VARS,
  ...PAYMENT_VARS,
];

export const PICKSLIP_CATALOG: VariableDef[] = [
  ...STORE_VARS,
  { path: "order.number", label: "Order number", example: "#7264", group: "Order" },
  { path: "order.date", label: "Order date", example: "Apr 26, 2026", group: "Order" },
  { path: "order.notes", label: "Customer notes", example: "Leave at door", group: "Order" },
  ...CUSTOMER_VARS,
  ...ADDRESS_VARS("shipping"),
];

export function getVariableCatalog(type: TemplateType): VariableDef[] {
  switch (type) {
    case "invoice": return INVOICE_CATALOG;
    case "pickslip": return PICKSLIP_CATALOG;
  }
}