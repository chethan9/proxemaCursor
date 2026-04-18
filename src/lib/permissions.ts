export const PERMISSIONS = {
  ALL: "*",
  // Clients
  CLIENTS_VIEW: "clients.view",
  CLIENTS_MANAGE: "clients.manage",
  // Sites
  SITES_VIEW: "sites.view",
  SITES_MANAGE: "sites.manage",
  SITES_SYNC: "sites.sync",
  // Sync
  SYNC_VIEW: "sync.view",
  SYNC_RUN: "sync.run",
  // Webhooks
  WEBHOOKS_VIEW: "webhooks.view",
  WEBHOOKS_MANAGE: "webhooks.manage",
  // API
  API_VIEW: "api.view",
  API_MANAGE: "api.manage",
  // Users
  USERS_VIEW: "users.view",
  USERS_MANAGE: "users.manage",
  // Roles
  ROLES_VIEW: "roles.view",
  ROLES_MANAGE: "roles.manage",
  // Settings
  SETTINGS_VIEW: "settings.view",
  SETTINGS_MANAGE: "settings.manage",
  // Super admin only
  SUPER_ADMIN: "super.admin",
} as const;

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];

export function hasPermission(userPermissions: string[] | null | undefined, required: Permission): boolean {
  if (!userPermissions || userPermissions.length === 0) return false;
  if (userPermissions.includes("*")) return true;
  return userPermissions.includes(required);
}

export function hasAnyPermission(userPermissions: string[] | null | undefined, required: Permission[]): boolean {
  return required.some((p) => hasPermission(userPermissions, p));
}