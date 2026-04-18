import { Package, ShoppingCart, Users, Tag, Ticket, Layers } from "lucide-react";

export const SYNC_ASPECTS = [
  { id: "products", label: "Products", icon: Package, color: "text-blue-500" },
  { id: "orders", label: "Orders", icon: ShoppingCart, color: "text-green-500" },
  { id: "customers", label: "Customers", icon: Users, color: "text-purple-500" },
  { id: "categories", label: "Categories", icon: Layers, color: "text-orange-500" },
  { id: "tags", label: "Tags", icon: Tag, color: "text-cyan-500" },
  { id: "coupons", label: "Coupons", icon: Ticket, color: "text-pink-500" },
] as const;

export const SYNC_INTERVALS = [
  { value: "0", label: "Manual only" },
  { value: "15", label: "Every 15 minutes" },
  { value: "30", label: "Every 30 minutes" },
  { value: "60", label: "Every hour" },
  { value: "360", label: "Every 6 hours" },
  { value: "720", label: "Every 12 hours" },
  { value: "1440", label: "Every 24 hours" },
];

export const ENTITY_TYPE_FILTERS = [
  { value: "all", label: "All" },
  { value: "product", label: "Products" },
  { value: "order", label: "Orders" },
  { value: "customer", label: "Customers" },
  { value: "category", label: "Categories" },
  { value: "coupon", label: "Coupons" },
];