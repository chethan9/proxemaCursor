import {
  MENU_REGISTRY, DEFAULT_GROUPS, SITE_MENU_REGISTRY, SITE_MENU_DEFAULT_GROUPS,
  type MenuRegistryItem, type SiteMenuRegistryItem,
} from "@/lib/menu-registry";
import type { MenuNode } from "@/services/menuConfigService";
import type { Permission } from "@/lib/permissions";

export interface ResolvedMenuNode {
  id: string;
  type: "item" | "group";
  label: string;
  icon: string;
  iconColor?: string | null;
  href?: string;
  permission?: Permission;
  superAdminOnly?: boolean;
  children?: ResolvedMenuNode[];
}

function registryMap(): Map<string, MenuRegistryItem> {
  const m = new Map<string, MenuRegistryItem>();
  MENU_REGISTRY.forEach((r) => m.set(r.id, r));
  return m;
}

function siteRegistryMap(): Map<string, SiteMenuRegistryItem> {
  const m = new Map<string, SiteMenuRegistryItem>();
  SITE_MENU_REGISTRY.forEach((r) => m.set(r.id, r));
  return m;
}

function collectIdsFromTree(nodes: MenuNode[], set: Set<string>) {
  for (const n of nodes) {
    if (n.type === "item") set.add(n.id);
    if (n.children) collectIdsFromTree(n.children, set);
  }
}

export function buildDefaultTree(): MenuNode[] {
  const groups = new Map<string, MenuNode>();
  for (const g of DEFAULT_GROUPS) {
    groups.set(g, { id: `group-${g.toLowerCase()}`, type: "group", label: g, icon: "Folder", children: [] });
  }
  const sorted = [...MENU_REGISTRY].sort((a, b) => a.defaultOrder - b.defaultOrder);
  for (const r of sorted) {
    const g = groups.get(r.defaultGroup);
    if (g) g.children!.push({ id: r.id, type: "item", label: r.defaultLabel, icon: r.defaultIcon, hidden: false });
  }
  return Array.from(groups.values()).filter((g) => (g.children?.length ?? 0) > 0);
}

export function buildDefaultSiteTree(): MenuNode[] {
  const groups = new Map<string, MenuNode>();
  for (const g of SITE_MENU_DEFAULT_GROUPS) {
    groups.set(g, { id: `sitegroup-${g.toLowerCase()}`, type: "group", label: g, icon: "Folder", children: [] });
  }
  const sorted = [...SITE_MENU_REGISTRY].sort((a, b) => a.defaultOrder - b.defaultOrder);
  for (const r of sorted) {
    const g = groups.get(r.defaultGroup);
    if (g) g.children!.push({ id: r.id, type: "item", label: r.defaultLabel, icon: r.defaultIcon, hidden: false });
  }
  return Array.from(groups.values()).filter((g) => (g.children?.length ?? 0) > 0);
}

function mergeGeneric(config: MenuNode[], registryIds: Set<string>, defaults: MenuNode[]) {
  const source = config.length > 0 ? config : defaults;
  const prune = (nodes: MenuNode[]): MenuNode[] =>
    nodes
      .map((n) => {
        if (n.type === "item") return registryIds.has(n.id) ? { ...n } : null;
        const children = n.children ? prune(n.children) : [];
        return { ...n, children };
      })
      .filter((n): n is MenuNode => n !== null);
  const pruned = prune(source);
  const existing = new Set<string>();
  collectIdsFromTree(pruned, existing);
  const unassigned: string[] = [];
  registryIds.forEach((id) => { if (!existing.has(id)) unassigned.push(id); });
  return { pruned, unassigned };
}

export function mergeMenu(config: MenuNode[]): { tree: MenuNode[]; unassignedIds: string[] } {
  const reg = registryMap();
  const ids = new Set(MENU_REGISTRY.map((r) => r.id));
  const { pruned, unassigned } = mergeGeneric(config, ids, buildDefaultTree());
  if (unassigned.length > 0) {
    const grp: MenuNode = {
      id: "group-unassigned", type: "group", label: "Unassigned (new)", icon: "Folder",
      children: unassigned.map((id) => {
        const r = reg.get(id)!;
        return { id, type: "item", label: r.defaultLabel, icon: r.defaultIcon, hidden: false };
      }),
    };
    const idx = pruned.findIndex((n) => n.id === "group-unassigned");
    if (idx >= 0) pruned[idx] = grp; else pruned.push(grp);
  }
  return { tree: pruned, unassignedIds: unassigned };
}

export function mergeSiteMenu(config: MenuNode[]): { tree: MenuNode[]; unassignedIds: string[] } {
  const reg = siteRegistryMap();
  const ids = new Set(SITE_MENU_REGISTRY.map((r) => r.id));
  const { pruned, unassigned } = mergeGeneric(config, ids, buildDefaultSiteTree());
  if (unassigned.length > 0) {
    const grp: MenuNode = {
      id: "sitegroup-unassigned", type: "group", label: "Unassigned (new)", icon: "Folder",
      children: unassigned.map((id) => {
        const r = reg.get(id)!;
        return { id, type: "item", label: r.defaultLabel, icon: r.defaultIcon, hidden: false };
      }),
    };
    const idx = pruned.findIndex((n) => n.id === "sitegroup-unassigned");
    if (idx >= 0) pruned[idx] = grp; else pruned.push(grp);
  }
  return { tree: pruned, unassignedIds: unassigned };
}

export function resolveForSidebar(
  tree: MenuNode[],
  can: (p: Permission) => boolean,
  isSuperAdmin: boolean
): ResolvedMenuNode[] {
  const reg = registryMap();
  const resolve = (nodes: MenuNode[], depth: number): ResolvedMenuNode[] => {
    const out: ResolvedMenuNode[] = [];
    for (const n of nodes) {
      if (n.hidden) continue;
      if (n.type === "item") {
        const r = reg.get(n.id); if (!r) continue;
        if (r.superAdminOnly && !isSuperAdmin) continue;
        if (r.permission && !can(r.permission)) continue;
        out.push({ id: n.id, type: "item", label: n.label, icon: n.icon, iconColor: n.iconColor, href: r.href, permission: r.permission, superAdminOnly: r.superAdminOnly });
      } else {
        const children = depth < 1 ? resolve(n.children || [], depth + 1) : [];
        if (children.length === 0) continue;
        out.push({ id: n.id, type: "group", label: n.label, icon: n.icon, iconColor: n.iconColor, children });
      }
    }
    return out;
  };
  return resolve(tree, 0);
}

export function resolveForSiteSidebar(
  tree: MenuNode[],
  siteId: string,
  can: (p: Permission) => boolean
): ResolvedMenuNode[] {
  const reg = siteRegistryMap();
  const resolve = (nodes: MenuNode[], depth: number): ResolvedMenuNode[] => {
    const out: ResolvedMenuNode[] = [];
    for (const n of nodes) {
      if (n.hidden) continue;
      if (n.type === "item") {
        const r = reg.get(n.id); if (!r) continue;
        if (r.permission && !can(r.permission)) continue;
        out.push({ id: n.id, type: "item", label: n.label, icon: n.icon, iconColor: n.iconColor, href: `/sites/${siteId}${r.path}`, permission: r.permission });
      } else {
        const children = depth < 1 ? resolve(n.children || [], depth + 1) : [];
        if (children.length === 0) continue;
        out.push({ id: n.id, type: "group", label: n.label, icon: n.icon, iconColor: n.iconColor, children });
      }
    }
    return out;
  };
  return resolve(tree, 0);
}