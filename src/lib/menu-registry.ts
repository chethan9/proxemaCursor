import {
  LayoutDashboard, Users, Store, RefreshCw, Webhook, Activity, Key,
  Settings as SettingsIcon, Shield, UserCog, Package, ShoppingCart, Tag,
  FolderTree, BarChart3, Database, Bell, CreditCard, Palette, User, FileText,
  Globe, Lock, Mail, Search, Filter, Calendar, Clock, Home, Folder, Ticket,
  Layers, Code2, Terminal, Wrench, Receipt, DollarSign, Sparkles, Compass,
  Download, Award,
  type LucideIcon,
} from "lucide-react";
import { PERMISSIONS, type Permission } from "@/lib/permissions";

export type MenuRegistryItem = {
  id: string;
  defaultLabel: string;
  defaultIcon: string;
  href: string;
  defaultGroup: string;
  defaultOrder: number;
  permission?: Permission;
  superAdminOnly?: boolean;
};

export type SiteMenuRegistryItem = {
  id: string;
  defaultLabel: string;
  defaultIcon: string;
  path: string;
  defaultGroup: string;
  defaultOrder: number;
  permission?: Permission;
};

export const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard, Users, Store, RefreshCw, Webhook, Activity, Key,
  Settings: SettingsIcon, Shield, UserCog, Package, ShoppingCart, Tag,
  FolderTree, BarChart3, Database, Bell, CreditCard, Palette, User, FileText,
  Globe, Lock, Mail, Search, Filter, Calendar, Clock, Home, Folder, Ticket,
  Layers, Code2, Terminal, Wrench, Receipt, DollarSign, Sparkles, Compass,
  Download, Award,
};

export function resolveIcon(name: string): LucideIcon {
  return ICON_MAP[name] || LayoutDashboard;
}

export const ICON_NAMES = Object.keys(ICON_MAP);

export const GROUP_ICONS: Record<string, string> = {
  "Overview": "LayoutDashboard",
  "Management": "Users",
  "Stores": "Store",
  "Developer": "Code2",
  "Billing": "CreditCard",
  "Administration": "Shield",
  "System": "Settings",
};

export const MENU_REGISTRY: MenuRegistryItem[] = [
  { id: "dashboard", defaultLabel: "Health", defaultIcon: "Activity", href: "/", defaultGroup: "Overview", defaultOrder: 0 },
  { id: "clients", defaultLabel: "Clients", defaultIcon: "Users", href: "/clients", defaultGroup: "Management", defaultOrder: 0, permission: PERMISSIONS.CLIENTS_VIEW, superAdminOnly: true },
  { id: "sites", defaultLabel: "Projects", defaultIcon: "Store", href: "/projects", defaultGroup: "Stores", defaultOrder: 0, permission: PERMISSIONS.SITES_VIEW },
  { id: "explore", defaultLabel: "Explore", defaultIcon: "Compass", href: "/explore", defaultGroup: "Stores", defaultOrder: 1 },
  { id: "templates", defaultLabel: "Templates", defaultIcon: "FileText", href: "/templates", defaultGroup: "Stores", defaultOrder: 2 },
  { id: "sync-runs", defaultLabel: "Sync Runs", defaultIcon: "RefreshCw", href: "/sync-runs", defaultGroup: "Developer", defaultOrder: 0, permission: PERMISSIONS.SYNC_VIEW },
  { id: "webhooks", defaultLabel: "Webhooks", defaultIcon: "Webhook", href: "/webhooks", defaultGroup: "Developer", defaultOrder: 1, permission: PERMISSIONS.WEBHOOKS_VIEW },
  { id: "webhooks-activity", defaultLabel: "Activity", defaultIcon: "Activity", href: "/webhooks/activity", defaultGroup: "Developer", defaultOrder: 2, permission: PERMISSIONS.WEBHOOKS_VIEW },
  { id: "api", defaultLabel: "API", defaultIcon: "Key", href: "/api-management", defaultGroup: "Developer", defaultOrder: 3, permission: PERMISSIONS.API_VIEW },
  { id: "billing", defaultLabel: "Overview", defaultIcon: "Receipt", href: "/billing", defaultGroup: "Billing", defaultOrder: 0 },
  { id: "payment-methods", defaultLabel: "Payment Methods", defaultIcon: "CreditCard", href: "/billing/payment-methods", defaultGroup: "Billing", defaultOrder: 1 },
  { id: "pricing", defaultLabel: "Plans", defaultIcon: "DollarSign", href: "/pricing", defaultGroup: "Billing", defaultOrder: 2 },
  { id: "users", defaultLabel: "Users", defaultIcon: "UserCog", href: "/settings/users", defaultGroup: "Administration", defaultOrder: 0, permission: PERMISSIONS.USERS_VIEW },
  { id: "roles", defaultLabel: "Roles", defaultIcon: "Shield", href: "/settings/roles", defaultGroup: "Administration", defaultOrder: 1, permission: PERMISSIONS.ROLES_VIEW },
  { id: "admin-payment-gateways", defaultLabel: "Payment Gateways", defaultIcon: "CreditCard", href: "/admin/payment-gateways", defaultGroup: "Administration", defaultOrder: 2, superAdminOnly: true },
  { id: "admin-payment-logs", defaultLabel: "Payment Logs", defaultIcon: "Receipt", href: "/admin/payment-logs", defaultGroup: "Administration", defaultOrder: 3, superAdminOnly: true },
  { id: "admin-activity", defaultLabel: "Activity Log", defaultIcon: "Activity", href: "/admin/activity", defaultGroup: "Administration", defaultOrder: 4, superAdminOnly: true },
  { id: "settings", defaultLabel: "Settings", defaultIcon: "Settings", href: "/settings/profile", defaultGroup: "System", defaultOrder: 0 },
];

export const DEFAULT_GROUPS = ["Stores", "Overview", "Management", "Developer", "Billing", "Administration", "System"];

export const SITE_MENU_REGISTRY: SiteMenuRegistryItem[] = [
  { id: "site-home", defaultLabel: "Home", defaultIcon: "Home", path: "/home", defaultGroup: "Main", defaultOrder: 0 },
  { id: "site-orders", defaultLabel: "Orders", defaultIcon: "ShoppingCart", path: "/orders", defaultGroup: "Main", defaultOrder: 1 },
  { id: "site-products", defaultLabel: "Products", defaultIcon: "Package", path: "/products", defaultGroup: "Main", defaultOrder: 2 },
  { id: "site-customers", defaultLabel: "Customers", defaultIcon: "Users", path: "/customers", defaultGroup: "Main", defaultOrder: 3 },
  { id: "site-categories", defaultLabel: "Categories", defaultIcon: "FolderTree", path: "/categories", defaultGroup: "Main", defaultOrder: 4 },
  { id: "site-tags", defaultLabel: "Tags", defaultIcon: "Tag", path: "/tags", defaultGroup: "Main", defaultOrder: 5 },
  { id: "site-brands", defaultLabel: "Brands", defaultIcon: "Award", path: "/brands", defaultGroup: "Main", defaultOrder: 6, permission: "manage_products" as const },
  { id: "site-downloads", defaultLabel: "Downloads", defaultIcon: "Download", path: "/downloads", defaultGroup: "Main", defaultOrder: 7 },
  { id: "site-bulk-jobs", defaultLabel: "Bulk Jobs", defaultIcon: "Layers", path: "/bulk-jobs", defaultGroup: "Manage", defaultOrder: 0 },
  { id: "site-settings", defaultLabel: "Configuration", defaultIcon: "Settings", path: "/settings", defaultGroup: "Manage", defaultOrder: 1 },
];

export const SITE_MENU_DEFAULT_GROUPS = ["Main", "Manage"];