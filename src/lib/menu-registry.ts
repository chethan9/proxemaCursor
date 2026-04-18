import {
  LayoutDashboard,
  Users,
  Store,
  RefreshCw,
  Webhook,
  Activity,
  Key,
  Settings as SettingsIcon,
  Shield,
  UserCog,
  Package,
  ShoppingCart,
  Tag,
  FolderTree,
  BarChart3,
  Database,
  Bell,
  CreditCard,
  Palette,
  User,
  FileText,
  Globe,
  Lock,
  Mail,
  Search,
  Filter,
  Calendar,
  Clock,
  Home,
  Folder,
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

export const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard,
  Users,
  Store,
  RefreshCw,
  Webhook,
  Activity,
  Key,
  Settings: SettingsIcon,
  Shield,
  UserCog,
  Package,
  ShoppingCart,
  Tag,
  FolderTree,
  BarChart3,
  Database,
  Bell,
  CreditCard,
  Palette,
  User,
  FileText,
  Globe,
  Lock,
  Mail,
  Search,
  Filter,
  Calendar,
  Clock,
  Home,
  Folder,
};

export function resolveIcon(name: string): LucideIcon {
  return ICON_MAP[name] || LayoutDashboard;
}

export const ICON_NAMES = Object.keys(ICON_MAP);

export const MENU_REGISTRY: MenuRegistryItem[] = [
  { id: "dashboard", defaultLabel: "Dashboard", defaultIcon: "LayoutDashboard", href: "/", defaultGroup: "Overview", defaultOrder: 0 },
  { id: "clients", defaultLabel: "Clients", defaultIcon: "Users", href: "/clients", defaultGroup: "Management", defaultOrder: 0, permission: PERMISSIONS.CLIENTS_VIEW },
  { id: "sites", defaultLabel: "Sites", defaultIcon: "Store", href: "/sites", defaultGroup: "Stores", defaultOrder: 0, permission: PERMISSIONS.SITES_VIEW },
  { id: "sync-runs", defaultLabel: "Sync Runs", defaultIcon: "RefreshCw", href: "/sync-runs", defaultGroup: "Operations", defaultOrder: 0, permission: PERMISSIONS.SYNC_VIEW },
  { id: "webhooks", defaultLabel: "Webhooks", defaultIcon: "Webhook", href: "/webhooks", defaultGroup: "Operations", defaultOrder: 1, permission: PERMISSIONS.WEBHOOKS_VIEW },
  { id: "webhooks-activity", defaultLabel: "Activity", defaultIcon: "Activity", href: "/webhooks/activity", defaultGroup: "Operations", defaultOrder: 2, permission: PERMISSIONS.WEBHOOKS_VIEW },
  { id: "api", defaultLabel: "API", defaultIcon: "Key", href: "/api-management", defaultGroup: "Developer", defaultOrder: 0, permission: PERMISSIONS.API_VIEW },
  { id: "users", defaultLabel: "Users", defaultIcon: "UserCog", href: "/settings/users", defaultGroup: "Administration", defaultOrder: 0, permission: PERMISSIONS.USERS_VIEW },
  { id: "roles", defaultLabel: "Roles", defaultIcon: "Shield", href: "/settings/roles", defaultGroup: "Administration", defaultOrder: 1, permission: PERMISSIONS.ROLES_VIEW },
  { id: "settings", defaultLabel: "Settings", defaultIcon: "Settings", href: "/settings", defaultGroup: "System", defaultOrder: 0 },
];

export const DEFAULT_GROUPS = ["Overview", "Management", "Stores", "Operations", "Developer", "Administration", "System"];