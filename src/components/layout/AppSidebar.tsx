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

const navItems = [
  { href: "/", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/clients", icon: Users, label: "Clients" },
  { href: "/sites", icon: Store, label: "Sites" },
  { href: "/sync-runs", icon: RefreshCw, label: "Sync Runs" },
  { href: "/webhooks", icon: Webhook, label: "Webhooks" },
  { href: "/webhooks/activity", icon: Activity, label: "Activity Log" },
  { href: "/api-management", icon: Key, label: "API Management" },
];

export function AppSidebar() {
  const router = useRouter();

  return (
    <aside className="flex w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-14 items-center border-b border-sidebar-border px-4">
        <Link href="/" className="flex items-center gap-2">
          <Zap className="h-6 w-6 text-sidebar-primary" />
          <span className="font-semibold text-lg">WooSync</span>
        </Link>
      </div>

      <nav className="flex-1 space-y-1 p-2 overflow-y-auto">
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? router.pathname === "/"
              : router.pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-4">
        <p className="text-xs text-sidebar-foreground/50">WooSync v1.0.0</p>
      </div>
    </aside>
  );
}