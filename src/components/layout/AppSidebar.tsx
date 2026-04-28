import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "next-i18next";
import { cn } from "@/lib/utils";
import { useBranding } from "@/contexts/BrandingProvider";
import { useAuth } from "@/contexts/AuthProvider";
import { authCleanupCallbacks } from "@/contexts/AuthProvider";
import { PERMISSIONS } from "@/lib/permissions";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useQueryClient } from "@tanstack/react-query";
import { getStore, type StoreWithClient } from "@/services/storeService";
import { getMenuConfig, type RoleKey } from "@/services/menuConfigService";
import { mergeMenu, resolveForSidebar, buildInitialTree, type ResolvedMenuNode } from "@/lib/menu-merge";
import { resolveIcon } from "@/lib/menu-registry";
import { SiteIcon } from "@/components/site/SiteIcon";
import { BrandLogo } from "@/components/BrandLogo";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, Lock, Unlock, MoreHorizontal, Check, ChevronDown, PanelRight, Sun, Moon, Monitor, Globe } from "lucide-react";
import { useTheme } from "next-themes";
import { queryKeys } from "@/lib/query-client";
import { useStores } from "@/hooks/queries/useStores";
import { LOCALES, getLocaleMeta, type LocaleCode } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { logActivity } from "@/lib/activity-log";

let cachedSites: StoreWithClient[] | null = null;
const cachedMenuByRole = new Map<RoleKey, ResolvedMenuNode[]>();

if (typeof window !== "undefined") {
  authCleanupCallbacks.add(() => {
    cachedSites = null;
    cachedMenuByRole.clear();
  });
}

const SIDEBAR_SITE_CAP = 5;

function menuStorageKey(role: RoleKey) {
  return `sidebar-menu-cache:v3:${role}`;
}

function groupExpandKey(id: string) {
  return `sidebar-group-expanded:${id}`;
}

function loadCachedMenu(role: RoleKey): ResolvedMenuNode[] {
  const mem = cachedMenuByRole.get(role);
  if (mem) return mem;
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(menuStorageKey(role));
    if (raw) {
      const parsed = JSON.parse(raw) as ResolvedMenuNode[];
      cachedMenuByRole.set(role, parsed);
      return parsed;
    }
  } catch { /* ignore */ }
  return [];
}

function loadCachedSites(): StoreWithClient[] {
  if (cachedSites) return cachedSites;
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("sidebar-sites-cache");
    if (raw) {
      const parsed = JSON.parse(raw) as StoreWithClient[];
      cachedSites = parsed;
      return parsed;
    }
  } catch { /* ignore */ }
  return [];
}

function roleKeyFor(profileRole: string | undefined, isSuperAdmin: boolean): RoleKey {
  if (isSuperAdmin) return "super_admin";
  if (profileRole === "admin") return "admin";
  return "user";
}

function serialize(tree: ResolvedMenuNode[]): string {
  return JSON.stringify(tree.map(function reduce(n): unknown {
    return { i: n.id, t: n.type, l: n.label, c: n.iconColor, h: n.href, d: n.displayMode, ch: n.children?.map(reduce) };
  }));
}

function extractActiveSiteId(asPath: string): string | null {
  const m = asPath.match(/^\/(?:sites|explore)\/([^/?#]+)/);
  return m ? m[1] : null;
}

export function AppSidebar({ forceCollapsed = false }: { forceCollapsed?: boolean } = {}) {
  const router = useRouter();
  const { brandName, logoUrl } = useBranding();
  const qc = useQueryClient();
  const { theme: currentTheme, setTheme } = useTheme();
  const { i18n, t } = useTranslation("common");
  const prefetchStore = (id: string) => {
    qc.prefetchQuery({ queryKey: queryKeys.store(id), queryFn: () => getStore(id), staleTime: 60_000 });
  };
  const { profile, role, can, isSuperAdmin, signOut, permissions, loading: authLoading, user } = useAuth();
  const [collapsedPref, setCollapsedPref] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("sidebar-collapsed") === "1";
  });
  const [locked, setLocked] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("sidebar-locked") === "1";
  });
  const collapsed = locked ? collapsedPref : (forceCollapsed || collapsedPref);
  const [sites, setSites] = useState<StoreWithClient[]>(() => loadCachedSites());
  const { data: storesData } = useStores();
  const [sitePopoverOpen, setSitePopoverOpen] = useState(false);
  const [groupExpanded, setGroupExpanded] = useState<Record<string, boolean>>({});
  const [activePanelId, setActivePanelId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("sidebar-active-panel");
  });
  const currentRoleKey = roleKeyFor(profile?.role, isSuperAdmin);
  const [menuTree, setMenuTree] = useState<ResolvedMenuNode[]>([]);
  const [menuReady, setMenuReady] = useState<boolean>(false);

  // Clear cached menu/sites when signed-in user changes (prevents flash of previous user's menu)
  useEffect(() => {
    if (!user?.id) return;
    const lastUserKey = "sidebar-last-user-id";
    const lastUserId = typeof window !== "undefined" ? localStorage.getItem(lastUserKey) : null;
    if (lastUserId && lastUserId !== user.id) {
      cachedSites = null;
      cachedMenuByRole.clear();
      if (typeof window !== "undefined") {
        try {
          localStorage.removeItem("sidebar-sites-cache");
          (["super_admin", "admin", "user"] as RoleKey[]).forEach((r) => localStorage.removeItem(menuStorageKey(r)));
        } catch { /* ignore */ }
      }
      setSites([]);
      setMenuTree([]);
      setMenuReady(false);
    }
    if (typeof window !== "undefined") localStorage.setItem(lastUserKey, user.id);
  }, [user?.id]);

  // Hydrate sites from cache only after user.id is confirmed matching
  useEffect(() => {
    if (!user?.id) return;
    if (sites.length > 0) return;
    const lastUserId = typeof window !== "undefined" ? localStorage.getItem("sidebar-last-user-id") : null;
    if (lastUserId === user.id) {
      const cached = loadCachedSites();
      if (cached.length > 0) setSites(cached);
    }
  }, [user?.id, sites.length]);

  useEffect(() => {
    if (!can(PERMISSIONS.SITES_VIEW)) return;
    if (!storesData) return;
    cachedSites = storesData;
    try { localStorage.setItem("sidebar-sites-cache", JSON.stringify(storesData)); } catch { /* ignore */ }
    setSites(storesData);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storesData]);

  useEffect(() => {
    if (authLoading) return;
    if (!user?.id) return;
    const roleKey = currentRoleKey;
    const lastUserId = typeof window !== "undefined" ? localStorage.getItem("sidebar-last-user-id") : null;
    const sameUser = lastUserId === user.id;
    const exactCache = sameUser ? loadCachedMenu(roleKey) : [];
    if (exactCache.length > 0) {
      if (serialize(exactCache) !== serialize(menuTree)) setMenuTree(exactCache);
      setMenuReady(true);
    } else {
      // No cache — build initial tree synchronously so user sees something immediately
      const initial = buildInitialTree(can, isSuperAdmin);
      setMenuTree(initial);
      setMenuReady(true);
    }
    getMenuConfig(roleKey).then((cfg) => {
      const { tree } = mergeMenu(cfg);
      const resolved = resolveForSidebar(tree, can, isSuperAdmin);
      cachedMenuByRole.set(roleKey, resolved);
      try { localStorage.setItem(menuStorageKey(roleKey), JSON.stringify(resolved)); } catch { /* ignore */ }
      setMenuTree((prev) => (serialize(prev) === serialize(resolved) ? prev : resolved));
      setMenuReady(true);
    }).catch(() => { setMenuReady(true); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, currentRoleKey, permissions.join(","), isSuperAdmin, user?.id]);

  // Safety net: never let the skeleton stay visible for more than 2s
  useEffect(() => {
    const t = setTimeout(() => setMenuReady(true), 2000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (activePanelId) localStorage.setItem("sidebar-active-panel", activePanelId);
    else localStorage.removeItem("sidebar-active-panel");
  }, [activePanelId]);

  useEffect(() => {
    let matched: string | null = null;
    for (const n of menuTree) {
      if (n.type === "group" && n.displayMode === "panel") {
        const hasActive = n.children?.some((c) => c.href === router.pathname);
        if (hasActive) { matched = n.id; break; }
      }
    }
    if (matched !== activePanelId) setActivePanelId(matched);
  }, [router.pathname, menuTree, activePanelId]);

  const activeSiteId = useMemo(() => extractActiveSiteId(router.asPath), [router.asPath]);

  // Initialize group-expanded state: auto-expand group containing active route, otherwise use localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    const next: Record<string, boolean> = {};
    for (const node of menuTree) {
      if (node.type !== "group") continue;
      const containsActive = node.children?.some((c) => c.href === router.pathname);
      if (containsActive) {
        next[node.id] = true;
        continue;
      }
      const stored = localStorage.getItem(groupExpandKey(node.id));
      next[node.id] = stored === null ? true : stored === "1";
    }
    setGroupExpanded((prev) => ({ ...next, ...Object.fromEntries(Object.entries(prev).filter(([k]) => !(k in next))) }));
  }, [menuTree, router.pathname]);

  const toggleGroup = (id: string) => {
    setGroupExpanded((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      if (typeof window !== "undefined") localStorage.setItem(groupExpandKey(id), next[id] ? "1" : "0");
      return next;
    });
  };

  const sortedSites = useMemo(() => {
    return [...sites].sort((a, b) => {
      const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
      const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
      return tb - ta;
    });
  }, [sites]);

  const visibleSites = useMemo(() => {
    if (sortedSites.length <= SIDEBAR_SITE_CAP) return sortedSites;
    const top = sortedSites.slice(0, SIDEBAR_SITE_CAP);
    const active = activeSiteId ? sortedSites.find((s) => s.id === activeSiteId) : null;
    if (!active || top.some((s) => s.id === active.id)) return top;
    const withActive = [active, ...top.slice(0, SIDEBAR_SITE_CAP - 1)];
    return [...withActive].sort((a, b) => {
      const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
      const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
      return tb - ta;
    });
  }, [sortedSites, activeSiteId]);

  const overflowCount = Math.max(0, sortedSites.length - visibleSites.length);

  const toggle = () => {
    if (forceCollapsed) return;
    const next = !collapsedPref;
    setCollapsedPref(next);
    if (typeof window !== "undefined") localStorage.setItem("sidebar-collapsed", next ? "1" : "0");
  };

  const toggleLock = () => {
    const next = !locked;
    setLocked(next);
    if (typeof window !== "undefined") localStorage.setItem("sidebar-locked", next ? "1" : "0");
  };

  const isItemActive = (href: string) => {
    if (href === "/settings/profile") return router.pathname.startsWith("/settings");
    return router.pathname === href;
  };

  const tItemLabel = (node: ResolvedMenuNode) => t(`appNav.${node.id}`, { defaultValue: node.label });
  const tGroupLabel = (node: ResolvedMenuNode) => t(`appNavGroups.${node.label}`, { defaultValue: node.label });

  const renderItem = (node: ResolvedMenuNode, indent = false) => {
    if (node.type !== "item" || !node.href) return null;
    const active = isItemActive(node.href);
    const Icon = resolveIcon(node.icon);
    const label = tItemLabel(node);
    const link = (
      <Link
        href={node.href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "group relative flex items-center rounded-md text-[13px] font-medium transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-primary",
          collapsed ? "h-9 w-9 justify-center mx-auto" : cn("gap-2.5 py-1.5", indent ? "pl-7 pr-2.5" : "px-2.5"),
          active
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
        )}
      >
        {active && !collapsed && (
          <span aria-hidden="true" className="absolute left-0 top-1 bottom-1 w-0.5 rounded-r-full bg-sidebar-primary" />
        )}
        <Icon className="h-4 w-4 shrink-0" style={node.iconColor ? { color: node.iconColor } : undefined} aria-hidden="true" />
        {!collapsed && <span className="truncate">{label}</span>}
      </Link>
    );
    return (
      <li key={node.id}>
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>{link}</TooltipTrigger>
            <TooltipContent side="right">{label}</TooltipContent>
          </Tooltip>
        ) : link}
      </li>
    );
  };

  const sitesPopoverContent = (
    <PopoverContent side="right" align="start" sideOffset={8} className="w-72 p-0 z-[100]">
      <Command>
        <CommandInput placeholder="Search sites..." />
        <CommandList>
          <CommandEmpty>No sites found.</CommandEmpty>
          <CommandGroup heading={`${sortedSites.length} site${sortedSites.length === 1 ? "" : "s"}`}>
            {sortedSites.map((site) => {
              const isActive = site.id === activeSiteId;
              return (
                <CommandItem
                  key={site.id}
                  value={`${site.name} ${site.url || ""}`}
                  onSelect={() => {
                    setSitePopoverOpen(false);
                    router.push(`/sites/${site.id}/home`);
                  }}
                  className="gap-2"
                >
                  <SiteIcon site={site} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{site.name}</p>
                    {site.url && <p className="text-[10px] text-muted-foreground truncate">{site.url}</p>}
                  </div>
                  <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", site.status === "connected" ? "bg-success" : "bg-muted-foreground/40")} />
                  {isActive && <Check className="h-3.5 w-3.5 text-primary ml-1" />}
                </CommandItem>
              );
            })}
          </CommandGroup>
        </CommandList>
      </Command>
    </PopoverContent>
  );

  const initials = (profile?.full_name || profile?.email || "?").slice(0, 2).toUpperCase();
  const currentLocaleMeta = getLocaleMeta(i18n.language);

  async function handleLocaleChange(code: LocaleCode) {
    if (code === i18n.language) return;
    await i18n.changeLanguage(code);
    if (typeof document !== "undefined") {
      document.cookie = `NEXT_LOCALE=${code}; path=/; max-age=31536000; SameSite=Lax`;
    }
    if (user?.id) {
      try {
        await supabase.from("profiles").update({ locale: code }).eq("id", user.id);
        await logActivity({ action: "profile.locale_changed", entityType: "profile", entityId: user.id, metadata: { locale: code } });
      } catch { /* non-fatal */ }
    }
  }

  const renderCollapsibleGroup = (node: ResolvedMenuNode) => {
    const children = node.children || [];
    if (children.length === 0) return null;
    const GroupIcon = resolveIcon(node.icon);
    const hasActiveChild = children.some((c) => c.href === router.pathname);
    const isExpanded = !!groupExpanded[node.id];
    const isPanelMode = node.displayMode === "panel";
    const groupLabel = tGroupLabel(node);

    if (isPanelMode && !collapsed) {
      const isOpen = activePanelId === node.id;
      const firstChild = children.find((c) => c.type === "item" && c.href);
      return (
        <div key={node.id} className="mb-2 px-2">
          <button
            type="button"
            onClick={() => {
              if (isOpen) {
                setActivePanelId(null);
              } else if (firstChild?.href) {
                router.push(firstChild.href);
              } else {
                setActivePanelId(node.id);
              }
            }}
            aria-expanded={isOpen}
            className={cn(
              "relative w-full flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors",
              (isOpen || hasActiveChild)
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
            )}
          >
            <GroupIcon className="h-4 w-4 shrink-0" style={node.iconColor ? { color: node.iconColor } : undefined} />
            <span className="truncate flex-1 text-left">{groupLabel}</span>
            <PanelRight className={cn("h-3 w-3 shrink-0 transition-opacity", isOpen ? "opacity-100" : "opacity-50")} />
          </button>
        </div>
      );
    }

    if (collapsed) {
      return (
        <div key={node.id} className="mb-2 px-1.5">
          <Popover>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    aria-label={groupLabel}
                    className={cn(
                      "relative flex items-center justify-center rounded-md h-9 w-9 mx-auto transition-colors",
                      hasActiveChild ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                    )}
                  >
                    <GroupIcon className="h-4 w-4 shrink-0" style={node.iconColor ? { color: node.iconColor } : undefined} />
                  </button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8} className="z-[100]">{groupLabel}</TooltipContent>
            </Tooltip>
            <PopoverContent side="right" align="start" sideOffset={8} className="w-56 p-1 z-[100]">
              <div className="px-2 py-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">{groupLabel}</div>
              <ul className="space-y-0.5">
                {children.map((child) => {
                  if (child.type !== "item" || !child.href) return null;
                  const Icon = resolveIcon(child.icon);
                  const active = isItemActive(child.href);
                  const childLabel = tItemLabel(child);
                  return (
                    <li key={child.id}>
                      <Link
                        href={child.href}
                        className={cn(
                          "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm",
                          active ? "bg-accent text-accent-foreground" : "hover:bg-accent/60"
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" style={child.iconColor ? { color: child.iconColor } : undefined} />
                        <span className="truncate">{childLabel}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </PopoverContent>
          </Popover>
        </div>
      );
    }

    return (
      <div key={node.id} className="mb-2 px-2">
        <button
          type="button"
          onClick={() => toggleGroup(node.id)}
          className={cn(
            "w-full flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors",
            "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
            hasActiveChild && !isExpanded && "text-sidebar-accent-foreground"
          )}
          aria-expanded={isExpanded}
        >
          <GroupIcon className="h-4 w-4 shrink-0" style={node.iconColor ? { color: node.iconColor } : undefined} />
          <span className="truncate flex-1 text-left">{groupLabel}</span>
          <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 transition-transform", !isExpanded && "-rotate-90")} />
        </button>
        {isExpanded && (
          <ul className="mt-0.5 space-y-0.5">
            {children.map((child) => renderItem(child, true))}
          </ul>
        )}
      </div>
    );
  };

  const activePanelNode = useMemo(() => {
    if (!activePanelId) return null;
    for (const n of menuTree) {
      if (n.id === activePanelId && n.type === "group" && n.displayMode === "panel") return n;
    }
    return null;
  }, [activePanelId, menuTree]);

  return (
    <TooltipProvider delayDuration={0}>
      <>
      <aside
        aria-label="Primary navigation"
        className={cn(
          "flex shrink-0 flex-col bg-sidebar text-sidebar-foreground transition-[width] duration-200",
          collapsed ? "w-14" : "w-44"
        )}
      >
        <div className={cn("flex h-12 items-center border-b border-sidebar-border", collapsed ? "justify-center px-0" : "px-3 justify-between")}>
          {collapsed ? (
            <button
              type="button"
              onClick={() => {
                setCollapsedPref(false);
                if (typeof window !== "undefined") localStorage.setItem("sidebar-collapsed", "0");
              }}
              aria-label="Expand sidebar"
              className="flex items-center justify-center rounded-md p-1 hover:bg-sidebar-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-primary"
            >
              <BrandLogo size="sm" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => { if (!locked) toggle(); }}
              aria-label={locked ? "Sidebar locked" : "Collapse sidebar"}
              className={cn(
                "flex items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-primary min-w-0 flex-1 text-left",
                locked && "cursor-default"
              )}
            >
              <BrandLogo size="sm" />
              <span className="font-semibold text-sm truncate">{brandName}</span>
            </button>
          )}
          {!collapsed && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button onClick={toggleLock} aria-label={locked ? "Unlock sidebar" : "Lock sidebar expanded"}
                  className={cn("p-1 rounded-md hover:bg-sidebar-accent/60 ml-1",
                    locked ? "text-sidebar-primary" : "text-sidebar-foreground/60 hover:text-sidebar-foreground")}>
                  {locked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">{locked ? "Unlock sidebar" : "Keep sidebar expanded"}</TooltipContent>
            </Tooltip>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto py-2">
          {(authLoading || !user?.id || !menuReady) ? (
            <div className="px-2 space-y-1">
              {[0,1,2,3,4,5,6].map(i => (
                <div key={i} className={cn("h-8 rounded-md bg-sidebar-accent/30 animate-pulse", collapsed ? "w-9 mx-auto" : "")} />
              ))}
            </div>
          ) : menuTree.map((node) => {
            if (node.type === "item") {
              return (
                <div key={node.id} className={cn("mb-2", collapsed ? "px-1.5" : "px-2")}>
                  <ul><>{renderItem(node)}</></ul>
                </div>
              );
            }
            const isStoresGroup = node.id === "group-stores";
            if (isStoresGroup) {
              return (
                <div key={node.id} className={cn("mb-2", collapsed ? "px-1.5" : "px-2")}>
                  <ul className="space-y-0.5">
                    {node.children?.map((c) => renderItem(c))}
                    {can(PERMISSIONS.SITES_VIEW) && visibleSites.map((site) => {
                      const href = `/sites/${site.id}/home`;
                      const isActive = site.id === activeSiteId;
                      if (collapsed) {
                        return (
                          <li key={site.id}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Link href={href} onMouseEnter={() => prefetchStore(site.id)} className={cn("relative flex items-center justify-center rounded-md h-9 w-9 mx-auto transition-colors",
                                  isActive ? "bg-sidebar-accent" : "hover:bg-sidebar-accent/60")}>
                                  <SiteIcon site={site} size="md" />
                                  <span className={cn("absolute top-0.5 right-0.5 h-1.5 w-1.5 rounded-full ring-1 ring-sidebar",
                                    site.status === "connected" ? "bg-success" : "bg-sidebar-foreground/40")} />
                                </Link>
                              </TooltipTrigger>
                              <TooltipContent side="right" sideOffset={8} className="z-[100]">
                                {site.name}
                              </TooltipContent>
                            </Tooltip>
                          </li>
                        );
                      }
                      return (
                        <li key={site.id}>
                          <Link href={href} onMouseEnter={() => prefetchStore(site.id)} aria-current={isActive ? "page" : undefined} className={cn(
                            "group relative flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors",
                            isActive
                              ? "bg-sidebar-accent text-sidebar-accent-foreground"
                              : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                          )}>
                            {isActive && (
                              <span aria-hidden="true" className="absolute left-0 top-1 bottom-1 w-0.5 rounded-r-full bg-sidebar-primary" />
                            )}
                            <SiteIcon site={site} size="sm" />
                            <span className="truncate">{site.name}</span>
                            <span className={cn("ml-auto h-1.5 w-1.5 rounded-full shrink-0", site.status === "connected" ? "bg-success" : "bg-sidebar-foreground/30")} />
                          </Link>
                        </li>
                      );
                    })}

                    {can(PERMISSIONS.SITES_VIEW) && overflowCount > 0 && (
                      <li>
                        <Popover open={sitePopoverOpen} onOpenChange={setSitePopoverOpen}>
                          {collapsed ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <PopoverTrigger asChild>
                                  <button
                                    type="button"
                                    aria-label={`Show ${overflowCount} more sites`}
                                    className="relative flex items-center justify-center rounded-md h-9 w-9 mx-auto text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                                  >
                                    <MoreHorizontal className="h-4 w-4" />
                                    <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-sidebar-primary text-[9px] font-semibold text-sidebar-primary-foreground flex items-center justify-center ring-1 ring-sidebar">
                                      +{overflowCount}
                                    </span>
                                  </button>
                                </PopoverTrigger>
                              </TooltipTrigger>
                              <TooltipContent side="right" sideOffset={8} className="z-[100]">{overflowCount} more sites</TooltipContent>
                            </Tooltip>
                          ) : (
                            <PopoverTrigger asChild>
                              <button
                                type="button"
                                className="w-full flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium text-sidebar-foreground/60 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground transition-colors"
                              >
                                <MoreHorizontal className="h-4 w-4 shrink-0" />
                                <span className="truncate">+{overflowCount} more site{overflowCount === 1 ? "" : "s"}</span>
                              </button>
                            </PopoverTrigger>
                          )}
                          {sitesPopoverContent}
                        </Popover>
                      </li>
                    )}
                  </ul>
                </div>
              );
            }
            return renderCollapsibleGroup(node);
          })}
        </nav>

        <div className={cn("border-t border-sidebar-border p-2")}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className={cn("w-full flex items-center gap-2 rounded-md p-1.5 hover:bg-sidebar-accent/60 transition-colors", collapsed && "justify-center")}
                aria-label="User menu">
                <Avatar className="h-7 w-7 flex-shrink-0">
                  <AvatarFallback className="bg-sidebar-primary/20 text-sidebar-foreground text-xs">{initials}</AvatarFallback>
                </Avatar>
                {!collapsed && (
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-xs font-medium truncate">{profile?.full_name || profile?.email}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{role?.name || profile?.role}</p>
                  </div>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="end" className="w-56">
              <DropdownMenuLabel>
                <div>
                  <p className="text-sm font-medium">{profile?.full_name || t("userMenu.user", { defaultValue: "User" })}</p>
                  <p className="text-xs text-muted-foreground truncate">{profile?.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <Globe className="h-4 w-4 mr-2" />
                  <span>{t("userMenu.language")}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{currentLocaleMeta.nativeName}</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-52">
                  {LOCALES.map((l) => (
                    <DropdownMenuItem key={l.code} onSelect={() => handleLocaleChange(l.code)}>
                      <span className="flex-1">{l.nativeName}</span>
                      <span className="text-xs text-muted-foreground mr-1">{l.name}</span>
                      {l.code === i18n.language && <Check className="h-3.5 w-3.5" />}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{t("userMenu.theme")}</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => setTheme("light")}>
                <Sun className="h-4 w-4 mr-2" />
                {t("userMenu.light")}
                {currentTheme === "light" && <Check className="h-3.5 w-3.5 ml-auto" />}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("dark")}>
                <Moon className="h-4 w-4 mr-2" />
                {t("userMenu.dark")}
                {currentTheme === "dark" && <Check className="h-3.5 w-3.5 ml-auto" />}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("system")}>
                <Monitor className="h-4 w-4 mr-2" />
                {t("userMenu.system")}
                {currentTheme === "system" && <Check className="h-3.5 w-3.5 ml-auto" />}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signOut}>
                <LogOut className="h-4 w-4 mr-2" />
                {t("userMenu.signOut")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>
      {activePanelNode && !collapsed && (
        <aside
          aria-label={`${activePanelNode.label} menu`}
          className="flex shrink-0 flex-col w-52 bg-background border-r border-border"
        >
          <div className="h-12 flex items-center px-3 border-b border-border">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground flex-1">
              {activePanelNode.label}
            </span>
            <button
              type="button"
              onClick={() => setActivePanelId(null)}
              aria-label="Close panel"
              className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
            >
              <ChevronDown className="h-3.5 w-3.5 rotate-90" />
            </button>
          </div>
          <nav className="flex-1 overflow-y-auto py-2 px-2">
            <ul className="space-y-0.5">
              {activePanelNode.children?.map((child) => {
                if (child.type !== "item" || !child.href) return null;
                const Icon = resolveIcon(child.icon);
                const active = isItemActive(child.href);
                return (
                  <li key={child.id}>
                    <Link
                      href={child.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group relative flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors",
                        active
                          ? "bg-foreground/[0.08] text-foreground"
                          : "text-foreground/70 hover:bg-foreground/[0.04] hover:text-foreground"
                      )}
                    >
                      {active && <span aria-hidden className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r-full bg-foreground" />}
                      <Icon className="h-4 w-4 shrink-0" style={child.iconColor ? { color: child.iconColor } : undefined} />
                      <span className="truncate">{child.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </aside>
      )}
      </>
    </TooltipProvider>
  );
}