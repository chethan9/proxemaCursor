import { MENU_REGISTRY, SITE_MENU_REGISTRY } from "@/lib/menu-registry";
import { PERMISSIONS } from "@/lib/permissions";

/**
 * Account-level settings pages under `/settings/*` (sidebar + related screens).
 */
const ACCOUNT_SETTINGS_PAGES: { label: string; href: string }[] = [
  { label: "Profile & account", href: "/settings/profile" },
  { label: "Theme", href: "/settings/theme" },
  { label: "Branding", href: "/settings/branding" },
  { label: "Menu editor", href: "/settings/menu-editor" },
  { label: "Users", href: "/settings/users" },
  { label: "Roles", href: "/settings/roles" },
  { label: "Translations", href: "/settings/translations" },
  { label: "Plans & subscription", href: "/settings/plans" },
  { label: "Subscriptions", href: "/settings/subscriptions" },
  { label: "Payment methods", href: "/settings/payment-methods" },
  { label: "AI credits", href: "/settings/ai-credits" },
  { label: "My activity", href: "/settings/my-activity" },
];

function permissionLabel(p?: string): string {
  if (!p) return "all authenticated users (unless super-admin-only)";
  const entry = Object.entries(PERMISSIONS).find(([, v]) => v === p);
  return entry ? `permission: ${entry[1]}` : `permission: ${p}`;
}

/**
 * Compact text injected into the assistant system prompt so answers stay aligned with real routes.
 * When `activeStoreId` is set, store paths use that UUID literally so the model never emits `{storeId}` placeholders.
 */
export function buildSaasKnowledgeText(activeStoreId?: string | null): string {
  const globalLines = MENU_REGISTRY.map((item) => {
    const access = item.superAdminOnly
      ? "super_admin only"
      : permissionLabel(item.permission);
    return `- ${item.defaultLabel}: path ${item.href} (${item.defaultGroup}) — ${access}`;
  });

  const siteLines = SITE_MENU_REGISTRY.map((item) => {
    const access = permissionLabel(item.permission);
    const path = activeStoreId
      ? `/sites/${activeStoreId}${item.path}`
      : `/sites/{storeId}${item.path}`;
    return `- ${item.defaultLabel}: ${path} (${item.defaultGroup}) — ${access}`;
  });

  const siteHeading = activeStoreId
    ? "## Store-scoped navigation (active store — use these paths verbatim in Markdown links)"
    : "## Store-scoped navigation (replace {storeId} with the active store UUID when no store is open in the UI)";

  const accountSettingsLines = ACCOUNT_SETTINGS_PAGES.map(
    (p) => `- ${p.label}: ${p.href} — account / organization settings (not store-specific)`,
  );

  const storeSettingsLine = activeStoreId
    ? `- **Store configuration** (sync schedule, WooCommerce connection, logos, preferences): [\`/sites/${activeStoreId}/settings\`](/sites/${activeStoreId}/settings) — also labeled **Configuration** in the store sidebar (Manage group).`
    : `- **Store configuration** (sync, credentials, logos): open a store first, then go to **Manage → Configuration** or \`/sites/{storeId}/settings\`.`;

  return [
    "## Global app navigation (account-level sidebar)",
    ...globalLines,
    "",
    "## Account settings & preferences (`/settings/...`)",
    "Use these when the user asks about profile, theme, users, roles, billing prefs, AI credits, translations, or menu customization.",
    ...accountSettingsLines,
    "",
    "## Store configuration (per WooCommerce site)",
    storeSettingsLine,
    "",
    siteHeading,
    ...siteLines,
    "",
    "Super admins may access admin-only routes. Other users only see items allowed by their role and permissions.",
  ].join("\n");
}
