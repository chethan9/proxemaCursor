import Link from "next/link";
import { useRouter } from "next/router";
import { cn } from "@/lib/utils";
import { useBranding } from "@/contexts/BrandingProvider";
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
} from "lucide-react";

type NavItem = { href: string; icon: typeof LayoutDashboard; label: string };

const navItems: NavItem[] = [
  { href: "/", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/clients", icon: Users, label: "Clients" },
  { href: "/sites", icon: Store, label: "Sites" },
  { href: "/sync-runs", icon: RefreshCw, label: "Sync Runs" },
  { href: "/webhooks", icon: Webhook, label: "Webhooks" },
  { href: "/webhooks/activity", icon: Activity, label: "Activity" },
  { href: "/api-management", icon: Key, label: "API" },
  { href: "/settings", icon: SettingsIcon, label: "Settings" },
];

export function AppSidebar() {
  const router = useRouter();
  const { brandName, logoUrl } = useBranding();

  const isItemActive = (href: string) =>
    href === "/" ? router.pathname === "/" : router.pathname === href || router.pathname.startsWith(href + "/");

  return (
    <aside
      aria-label="Primary navigation"
      className="flex w-56 shrink-0 flex-col bg-sidebar text-sidebar-foreground"
    >
      <div className="flex h-12 items-center border-b border-sidebar-border px-3">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-primary focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar"
        >
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={brandName} className="h-6 w-6 rounded object-contain" />
          ) : (
            <Zap className="h-5 w-5 text-sidebar-primary" aria-hidden="true" />
          )}
          <span className="font-semibold text-sm truncate">{brandName}</span>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto p-2">
        <ul className="space-y-0.5">
          {navItems.map((item) => {
            const active = isItemActive(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group relative flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-primary focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar",
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                  )}
                >
                  {active && (
                    <span
                      aria-hidden="true"
                      className="absolute left-0 top-1 bottom-1 w-0.5 rounded-r-full bg-sidebar-primary"
                    />
                  )}
                  <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-sidebar-border px-3 py-2">
        <p className="text-[11px] text-sidebar-muted">{brandName} v1.0.0</p>
      </div>
    </aside>
  );
}