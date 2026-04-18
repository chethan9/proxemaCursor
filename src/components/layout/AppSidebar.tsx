import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useBranding } from "@/contexts/BrandingProvider";
import { useAuth } from "@/contexts/AuthProvider";
import { PERMISSIONS } from "@/lib/permissions";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getStores, type StoreWithClient } from "@/services/storeService";
import { getMenuConfig, type RoleKey } from "@/services/menuConfigService";
import { mergeMenu, resolveForSidebar, type ResolvedMenuNode } from "@/lib/menu-merge";
import { resolveIcon } from "@/lib/menu-registry";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Zap, ChevronsLeft, ChevronsRight, LogOut, CornerDownRight, Store } from "lucide-react";

let cachedSites: StoreWithClient[] | null = null;
const cachedMenuByRole = new Map<RoleKey, ResolvedMenuNode[]>();

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

function getSiteFavicon(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=64`;
  } catch { return null; }
}

function SiteIcon({ site, size = "sm" }: { site: StoreWithClient; size?: "sm" | "md" }) {
  const [failed, setFailed] = useState(false);
  const favicon = getSiteFavicon(site.url);
  const initial = (site.name || site.url || "?").trim().charAt(0).toUpperCase();
  const cls = size === "md" ? "h-6 w-6 text-[11px]" : "h-5 w-5 text-[10px]";
  if (favicon && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={favicon} alt="" onError={() => setFailed(true)}
        className={cn(cls, "rounded-sm object-contain bg-white p-0.5 flex-shrink-0")} />
    );
  }
  return (
    <div className={cn(cls, "rounded-sm bg-white text-slate-900 font-semibold flex items-center justify-center flex-shrink-0")}>
      {initial}
    </div>
  );
}

function roleKeyFor(profileRole: string | undefined, isSuperAdmin: boolean): RoleKey {
  if (isSuperAdmin) return "super_admin";
  if (profileRole === "admin") return "admin";
  if (profileRole === "readonly") return "readonly";
  return "staff";
}

export function AppSidebar({ forceCollapsed = false }: { forceCollapsed?: boolean } = {}) {
  const router = useRouter();
  const { brandName, logoUrl } = useBranding();
  const { profile, role, can, isSuperAdmin, signOut, permissions } = useAuth();
  const [collapsedPref, setCollapsedPref] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("sidebar-collapsed") === "1";
  });
  const collapsed = forceCollapsed || collapsedPref;
  const [sites, setSites] = useState<StoreWithClient[]>(() => loadCachedSites());
  const [menuTree, setMenuTree] = useState<ResolvedMenuNode[]>(() => {
    const roleKey = roleKeyFor(undefined, false);
    return cachedMenuByRole.get(roleKey) || [];
  });

  useEffect(() => {
    if (!can(PERMISSIONS.SITES_VIEW)) return;
    getStores().then((list) => {
      cachedSites = list;
      try { localStorage.setItem("sidebar-sites-cache", JSON.stringify(list)); } catch { /* ignore */ }
      setSites(list);
    }).catch(() => { /* keep cached */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const roleKey = roleKeyFor(profile?.role, isSuperAdmin);
    const cached = cachedMenuByRole.get(roleKey);
    if (cached) setMenuTree(cached);
    getMenuConfig(roleKey).then((cfg) => {
      const { tree } = mergeMenu(cfg);
      const resolved = resolveForSidebar(tree, can, isSuperAdmin);
      cachedMenuByRole.set(roleKey, resolved);
      setMenuTree(resolved);
    }).catch(() => { if (!cached) setMenuTree([]); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.role, isSuperAdmin, permissions.join(",")]);

  const toggle = () => {
    if (forceCollapsed) return;
    const next = !collapsedPref;
    setCollapsedPref(next);
    if (typeof window !== "undefined") localStorage.setItem("sidebar-collapsed", next ? "1" : "0");
  };

  const isItemActive = (href: string) =>
    href === "/" ? router.pathname === "/" : router.pathname === href || router.pathname.startsWith(href + "/");

  const renderItem = (node: ResolvedMenuNode) => {
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
          collapsed ? "h-9 w-9 justify-center mx-auto" : "gap-2.5 px-2.5 py-1.5",
          active
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
        )}
      >
        {active && !collapsed && (
          <span aria-hidden="true" className="absolute left-0 top-1 bottom-1 w-0.5 rounded-r-full bg-sidebar-primary" />
        )}
        {active && collapsed && (
          <span aria-hidden="true" className="absolute inset-0 rounded-md ring-2 ring-sidebar-primary/70 pointer-events-none" />
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

  const initials = (profile?.full_name || profile?.email || "?").slice(0, 2).toUpperCase();

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        aria-label="Primary navigation"
        className={cn(
          "flex shrink-0 flex-col bg-sidebar text-sidebar-foreground transition-[width] duration-200",
          collapsed ? "w-14" : "w-52"
        )}
      >
        <div className={cn("flex h-12 items-center border-b border-sidebar-border", collapsed ? "justify-center px-0" : "px-3 justify-between")}>
          <Link href="/" className="flex items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-primary min-w-0">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt={brandName} className="h-6 w-6 rounded object-contain flex-shrink-0" />
            ) : (
              <Zap className="h-5 w-5 text-sidebar-primary flex-shrink-0" aria-hidden="true" />
            )}
            {!collapsed && <span className="font-semibold text-sm truncate">{brandName}</span>}
          </Link>
          {!collapsed && (
            <button onClick={toggle} aria-label="Collapse sidebar"
              className="p-1 rounded-md text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/60">
              <ChevronsLeft className="h-4 w-4" />
            </button>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto py-2">
          {menuTree.map((node) => {
            if (node.type === "item") {
              return (
                <div key={node.id} className={cn("mb-1", collapsed ? "px-1.5" : "px-2")}>
                  <ul><>{renderItem(node)}</></ul>
                </div>
              );
            }
            const isStoresGroup = node.id === "group-stores";
            return (
              <div key={node.id} className={cn("mb-3", collapsed ? "px-1.5" : "px-2")}>
                {!collapsed && (
                  <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
                    {node.label}
                  </p>
                )}
                <ul className="space-y-0.5">
                  {node.children?.map(renderItem)}
                  {isStoresGroup && can(PERMISSIONS.SITES_VIEW) && sites.map((site) => {
                    const href = `/sites/${site.id}`;
                    const isActive = router.asPath.startsWith(`/sites/${site.id}`);
                    if (collapsed) {
                      return (
                        <li key={site.id}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Link href={href} className={cn("relative flex items-center justify-center rounded-md h-9 w-9 mx-auto transition-colors",
                                isActive ? "bg-sidebar-accent" : "hover:bg-sidebar-accent/60")}>
                                <SiteIcon site={site} size="md" />
                                <span className={cn("absolute top-0.5 right-0.5 h-1.5 w-1.5 rounded-full ring-1 ring-sidebar",
                                  site.status === "connected" ? "bg-success" : "bg-sidebar-foreground/40")} />
                              </Link>
                            </TooltipTrigger>
                            <TooltipContent side="right" sideOffset={8} className="z-[100]">{site.name}</TooltipContent>
                          </Tooltip>
                        </li>
                      );
                    }
                    return (
                      <li key={site.id}>
                        <Link href={href} className={cn("flex items-center gap-2 rounded-md pl-3 pr-2.5 py-1 text-[12px] transition-colors",
                          isActive ? "text-sidebar-accent-foreground bg-sidebar-accent/40"
                                   : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/40")}>
                          <CornerDownRight className="h-3 w-3 shrink-0 text-sidebar-foreground/40" />
                          <SiteIcon site={site} size="sm" />
                          <span className="truncate">{site.name}</span>
                          <span className={cn("ml-auto h-1.5 w-1.5 rounded-full shrink-0", site.status === "connected" ? "bg-success" : "bg-sidebar-foreground/30")} />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
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
          {collapsed && !forceCollapsed && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button onClick={toggle} aria-label="Expand sidebar"
                  className="mt-1 w-full flex items-center justify-center h-7 rounded-md text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/60">
                  <ChevronsRight className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Expand sidebar</TooltipContent>
            </Tooltip>
          )}
        </div>
      </aside>
    </TooltipProvider>
  );
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _unused = Store;