import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { useBranding } from "@/contexts/BrandingProvider";
import { useAuth } from "@/contexts/AuthProvider";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Zap, LogOut, Lock, Unlock, MoreHorizontal, Check, ChevronDown } from "lucide-react";
import { queryKeys } from "@/lib/query-client";
import { useStores } from "@/hooks/queries/useStores";

let cachedSites: StoreWithClient[] | null = null;
const cachedMenuByRole = new Map<RoleKey, ResolvedMenuNode[]>();

const SIDEBAR_SITE_CAP = 5;

function menuStorageKey(role: RoleKey) {
  return `sidebar-menu-cache:${role}`;
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
    return { i: n.id, t: n.type, l: n.label, c: n.iconColor, h: n.href, ch: n.children?.map(reduce) };
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
  const prefetchStore = (id: string) => {
    qc.prefetchQuery({ queryKey: queryKeys.store(id), queryFn: () => getStore(id), staleTime: 60_000 });
  };
  const { profile, role, can, isSuperAdmin, signOut, permissions, loading: authLoading } = useAuth();
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
  const currentRoleKey = roleKeyFor(profile?.role, isSuperAdmin);
  const [menuTree, setMenuTree] = useState<ResolvedMenuNode[]>(() => {
    const exactCache = loadCachedMenu(currentRoleKey);
    if (exactCache.length > 0) return exactCache;
    return buildInitialTree(can, isSuperAdmin);
  });

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
    if (!profile && !role) return;
    if (permissions.length === 0 && !isSuperAdmin) return;
    const roleKey = currentRoleKey;
    const exactCache = loadCachedMenu(roleKey);
    if (exactCache.length > 0 && serialize(exactCache) !== serialize(menuTree)) {
      setMenuTree(exactCache);
    } else if (exactCache.length === 0) {
      const defaults = buildInitialTree(can, isSuperAdmin);
      if (serialize(defaults) !== serialize(menuTree)) setMenuTree(defaults);
    }
    getMenuConfig(roleKey).then((cfg) => {
      const { tree } = mergeMenu(cfg);
      const resolved = resolveForSidebar(tree, can, isSuperAdmin);
      cachedMenuByRole.set(roleKey, resolved);
      try { localStorage.setItem(menuStorageKey(roleKey), JSON.stringify(resolved)); } catch { /* ignore */ }
      setMenuTree((prev) => (serialize(prev) === serialize(resolved) ? prev : resolved));
    }).catch(() => { /* keep current tree */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, currentRoleKey, permissions.join(","), isSuperAdmin]);

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

  const isItemActive = (href: string) => router.pathname === href;

  const renderItem = (node: ResolvedMenuNode, indent = false) => {
    if (node.type !== "item" || !node.href) return null;
    const active = isItemActive(node.href);
    const Icon = resolveIcon(node.icon);
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
        {!collapsed && <span className="truncate">{node.label}</span>}
      </Link>
    );
    return (
      <li key={node.id}>
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>{link}</TooltipTrigger>
            <TooltipContent side="right">{node.label}</TooltipContent>
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
                    router.push(`/sites/${site.id}/products`);
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

  const renderCollapsibleGroup = (node: ResolvedMenuNode) => {
    const children = node.children || [];
    if (children.length === 0) return null;
    const GroupIcon = resolveIcon(node.icon);
    const hasActiveChild = children.some((c) => c.href === router.pathname);
    const isExpanded = !!groupExpanded[node.id];

    if (collapsed) {
      return (
        <div key={node.id} className="mb-2 px-1.5">
          <Popover>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    aria-label={node.label}
                    className={cn(
                      "relative flex items-center justify-center rounded-md h-9 w-9 mx-auto transition-colors",
                      hasActiveChild ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60"
                    )}
                  >
                    <GroupIcon className="h-4 w-4" style={node.iconColor ? { color: node.iconColor } : undefined} />
                  </button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8} className="z-[100]">{node.label}</TooltipContent>
            </Tooltip>
            <PopoverContent side="right" align="start" sideOffset={8} className="w-56 p-1 z-[100]">
              <div className="px-2 py-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">{node.label}</div>
              <ul className="space-y-0.5">
                {children.map((child) => {
                  if (child.type !== "item" || !child.href) return null;
                  const Icon = resolveIcon(child.icon);
                  const active = isItemActive(child.href);
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
                        <span className="truncate">{child.label}</span>
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
          <span className="truncate flex-1 text-left">{node.label}</span>
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

  return (
    <TooltipProvider delayDuration={0}>
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
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt={brandName} className="h-6 w-6 rounded object-contain flex-shrink-0" />
              ) : (
                <Zap className="h-5 w-5 text-sidebar-primary flex-shrink-0" aria-hidden="true" />
              )}
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
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt={brandName} className="h-6 w-6 rounded object-contain flex-shrink-0" />
              ) : (
                <Zap className="h-5 w-5 text-sidebar-primary flex-shrink-0" aria-hidden="true" />
              )}
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
          {menuTree.map((node) => {
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
                      const href = `/sites/${site.id}/products`;
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
                  <p className="text-sm font-medium">{profile?.full_name || "User"}</p>
                  <p className="text-xs text-muted-foreground truncate">{profile?.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signOut}>
                <LogOut className="h-4 w-4 mr-2" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>
    </TooltipProvider>
  );
}