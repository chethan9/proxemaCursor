import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useBranding } from "@/contexts/BrandingProvider";
import { useAuth } from "@/contexts/AuthProvider";
import { PERMISSIONS, type Permission } from "@/lib/permissions";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getStores, type StoreWithClient } from "@/services/storeService";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  LayoutDashboard,
  Users,
  Store,
  RefreshCw,
  Webhook,
  Zap,
  Activity,
  Key,
  Settings as SettingsIcon,
  ChevronsLeft,
  ChevronsRight,
  LogOut,
  Shield,
  UserCog,
  ChevronRight,
} from "lucide-react";

type NavItem = { href: string; icon: typeof LayoutDashboard; label: string; permission?: Permission; superAdminOnly?: boolean };
type NavGroup = { label: string; items: NavItem[] };

const navGroups: NavGroup[] = [
  {
    label: "Overview",
    items: [{ href: "/", icon: LayoutDashboard, label: "Dashboard" }],
  },
  {
    label: "Management",
    items: [
      { href: "/clients", icon: Users, label: "Clients", permission: PERMISSIONS.CLIENTS_VIEW },
    ],
  },
  {
    label: "Stores",
    items: [],
  },
  {
    label: "Operations",
    items: [
      { href: "/sync-runs", icon: RefreshCw, label: "Sync Runs", permission: PERMISSIONS.SYNC_VIEW },
      { href: "/webhooks", icon: Webhook, label: "Webhooks", permission: PERMISSIONS.WEBHOOKS_VIEW },
      { href: "/webhooks/activity", icon: Activity, label: "Activity", permission: PERMISSIONS.WEBHOOKS_VIEW },
    ],
  },
  {
    label: "Developer",
    items: [{ href: "/api-management", icon: Key, label: "API", permission: PERMISSIONS.API_VIEW }],
  },
  {
    label: "Administration",
    items: [
      { href: "/settings/users", icon: UserCog, label: "Users", permission: PERMISSIONS.USERS_VIEW },
      { href: "/settings/roles", icon: Shield, label: "Roles", permission: PERMISSIONS.ROLES_VIEW },
    ],
  },
  {
    label: "System",
    items: [{ href: "/settings", icon: SettingsIcon, label: "Settings" }],
  },
];

export function AppSidebar() {
  const router = useRouter();
  const { brandName, logoUrl } = useBranding();
  const { profile, role, can, isSuperAdmin, signOut } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [sites, setSites] = useState<StoreWithClient[]>([]);
  const [sitesExpanded, setSitesExpanded] = useState(true);

  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("sidebar-collapsed") : null;
    if (stored === "1") setCollapsed(true);
    const sitesStored = typeof window !== "undefined" ? localStorage.getItem("sidebar-sites-expanded") : null;
    if (sitesStored === "0") setSitesExpanded(false);
  }, []);

  useEffect(() => {
    if (!can(PERMISSIONS.SITES_VIEW)) return;
    getStores().then(setSites).catch(() => setSites([]));
  }, [can]);

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    if (typeof window !== "undefined") localStorage.setItem("sidebar-collapsed", next ? "1" : "0");
  };

  const toggleSites = () => {
    const next = !sitesExpanded;
    setSitesExpanded(next);
    if (typeof window !== "undefined") localStorage.setItem("sidebar-sites-expanded", next ? "1" : "0");
  };

  const isItemActive = (href: string) =>
    href === "/" ? router.pathname === "/" : router.pathname === href || router.pathname.startsWith(href + "/");

  const visibleGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (item.superAdminOnly && !isSuperAdmin) return false;
        if (item.permission && !can(item.permission)) return false;
        return true;
      }),
    }))
    .filter((g) => {
      if (g.label === "Stores") return can(PERMISSIONS.SITES_VIEW);
      return g.items.length > 0;
    });

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
          <Link
            href="/"
            className="flex items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-primary min-w-0"
          >
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt={brandName} className="h-6 w-6 rounded object-contain flex-shrink-0" />
            ) : (
              <Zap className="h-5 w-5 text-sidebar-primary flex-shrink-0" aria-hidden="true" />
            )}
            {!collapsed && <span className="font-semibold text-sm truncate">{brandName}</span>}
          </Link>
          {!collapsed && (
            <button
              onClick={toggle}
              aria-label="Collapse sidebar"
              className="p-1 rounded-md text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/60"
            >
              <ChevronsLeft className="h-4 w-4" />
            </button>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto py-2">
          {visibleGroups.map((group) => (
            <div key={group.label} className={cn("mb-3", collapsed ? "px-1.5" : "px-2")}>
              {!collapsed && (
                <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
                  {group.label}
                </p>
              )}
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const active = isItemActive(item.href);
                  const link = (
                    <Link
                      href={item.href}
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
                        <span
                          aria-hidden="true"
                          className="absolute left-0 top-1 bottom-1 w-0.5 rounded-r-full bg-sidebar-primary"
                        />
                      )}
                      <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </Link>
                  );
                  return (
                    <li key={item.href}>
                      {collapsed ? (
                        <Tooltip>
                          <TooltipTrigger asChild>{link}</TooltipTrigger>
                          <TooltipContent side="right">{item.label}</TooltipContent>
                        </Tooltip>
                      ) : (
                        link
                      )}
                    </li>
                  );
                })}

                {group.label === "Stores" && can(PERMISSIONS.SITES_VIEW) && (
                  <>
                    <li>
                      {collapsed ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Link
                              href="/sites"
                              className={cn(
                                "group relative flex items-center rounded-md text-[13px] font-medium transition-colors h-9 w-9 justify-center mx-auto",
                                router.pathname === "/sites"
                                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                                  : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60"
                              )}
                            >
                              <Store className="h-4 w-4" />
                            </Link>
                          </TooltipTrigger>
                          <TooltipContent side="right">Sites</TooltipContent>
                        </Tooltip>
                      ) : (
                        <div className="flex items-center gap-0.5">
                          <Link
                            href="/sites"
                            className={cn(
                              "flex-1 flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors",
                              router.pathname === "/sites"
                                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                                : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                            )}
                          >
                            <Store className="h-4 w-4 shrink-0" />
                            <span className="truncate">Sites</span>
                          </Link>
                          {sites.length > 0 && (
                            <button
                              onClick={toggleSites}
                              aria-label={sitesExpanded ? "Collapse sites" : "Expand sites"}
                              className="p-1 rounded text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent/60"
                            >
                              <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", sitesExpanded && "rotate-90")} />
                            </button>
                          )}
                        </div>
                      )}
                    </li>
                    {!collapsed && sitesExpanded && sites.map((site) => {
                      const href = `/explore/${site.id}`;
                      const isActive = router.asPath.startsWith(`/explore/${site.id}`);
                      return (
                        <li key={site.id}>
                          <Link
                            href={href}
                            className={cn(
                              "flex items-center gap-2 rounded-md pl-7 pr-2.5 py-1 text-[12px] transition-colors",
                              isActive
                                ? "text-sidebar-accent-foreground bg-sidebar-accent/40"
                                : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/40"
                            )}
                          >
                            <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", site.status === "connected" ? "bg-success" : "bg-sidebar-foreground/30")} />
                            <span className="truncate">{site.name}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </>
                )}
              </ul>
            </div>
          ))}
        </nav>

        <div className={cn("border-t border-sidebar-border", collapsed ? "p-2" : "p-2")}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  "w-full flex items-center gap-2 rounded-md p-1.5 hover:bg-sidebar-accent/60 transition-colors",
                  collapsed && "justify-center"
                )}
                aria-label="User menu"
              >
                <Avatar className="h-7 w-7 flex-shrink-0">
                  <AvatarFallback className="bg-sidebar-primary/20 text-sidebar-foreground text-xs">{initials}</AvatarFallback>
                </Avatar>
                {!collapsed && (
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-xs font-medium truncate">{profile?.full_name || profile?.email}</p>
                    <p className="text-[10px] text-sidebar-foreground/50 truncate">{role?.name || profile?.role}</p>
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
          {collapsed && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={toggle}
                  aria-label="Expand sidebar"
                  className="mt-1 w-full flex items-center justify-center h-7 rounded-md text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/60"
                >
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