import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useBranding } from "@/contexts/BrandingProvider";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
} from "lucide-react";

type NavItem = { href: string; icon: typeof LayoutDashboard; label: string };
type NavGroup = { label: string; items: NavItem[] };

const navGroups: NavGroup[] = [
  {
    label: "Overview",
    items: [{ href: "/", icon: LayoutDashboard, label: "Dashboard" }],
  },
  {
    label: "Management",
    items: [
      { href: "/clients", icon: Users, label: "Clients" },
      { href: "/sites", icon: Store, label: "Sites" },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/sync-runs", icon: RefreshCw, label: "Sync Runs" },
      { href: "/webhooks", icon: Webhook, label: "Webhooks" },
      { href: "/webhooks/activity", icon: Activity, label: "Activity" },
    ],
  },
  {
    label: "Developer",
    items: [{ href: "/api-management", icon: Key, label: "API" }],
  },
  {
    label: "System",
    items: [{ href: "/settings", icon: SettingsIcon, label: "Settings" }],
  },
];

export function AppSidebar() {
  const router = useRouter();
  const { brandName, logoUrl } = useBranding();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("sidebar-collapsed") : null;
    if (stored === "1") setCollapsed(true);
  }, []);

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    if (typeof window !== "undefined") localStorage.setItem("sidebar-collapsed", next ? "1" : "0");
  };

  const isItemActive = (href: string) =>
    href === "/" ? router.pathname === "/" : router.pathname === href || router.pathname.startsWith(href + "/");

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
          {navGroups.map((group) => (
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
              </ul>
            </div>
          ))}
        </nav>

        <div className={cn("border-t border-sidebar-border", collapsed ? "p-2" : "px-3 py-2 flex items-center justify-between")}>
          {!collapsed && <p className="text-[11px] text-sidebar-foreground/40">{brandName} v1.0.0</p>}
          {collapsed && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={toggle}
                  aria-label="Expand sidebar"
                  className="w-full flex items-center justify-center h-8 rounded-md text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/60"
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