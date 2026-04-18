import Link from "next/link";
import { useRouter } from "next/router";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  Store,
  RefreshCw,
  Webhook,
  Zap,
  Activity,
  Key,
} from "lucide-react";

const navSections = [
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
      { href: "/webhooks/activity", icon: Activity, label: "Activity Log" },
    ],
  },
  {
    label: "Developer",
    items: [{ href: "/api-management", icon: Key, label: "API Management" }],
  },
];

export function AppSidebar() {
  const router = useRouter();

  const isItemActive = (href: string) =>
    href === "/" ? router.pathname === "/" : router.pathname.startsWith(href);

  return (
    <aside
      aria-label="Primary navigation"
      className="flex w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground"
    >
      <div className="flex h-14 items-center border-b border-sidebar-border px-4">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-primary focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar"
        >
          <Zap className="h-6 w-6 text-sidebar-primary" aria-hidden="true" />
          <span className="font-semibold text-lg">WooSync</span>
        </Link>
      </div>

      <nav className="flex-1 space-y-4 overflow-y-auto p-3">
        {navSections.map((section) => (
          <div key={section.label}>
            <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-sidebar-muted">
              {section.label}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active = isItemActive(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-primary focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar",
                        active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                      )}
                    >
                      {active && (
                        <span
                          aria-hidden="true"
                          className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r-full bg-sidebar-primary"
                        />
                      )}
                      <item.icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-sidebar-border p-4">
        <p className="text-xs text-sidebar-muted">WooSync v1.0.0</p>
      </div>
    </aside>
  );
}