import { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { AppLayout } from "./AppLayout";
import { User, Palette, CreditCard, UserCog, Shield, ListTree } from "lucide-react";
import { useAuth } from "@/contexts/AuthProvider";
import { PERMISSIONS } from "@/lib/permissions";
import { cn } from "@/lib/utils";

interface SettingsLayoutProps {
  children: ReactNode;
  title?: string;
}

export function SettingsLayout({ children, title = "Settings" }: SettingsLayoutProps) {
  const router = useRouter();
  const { can, isSuperAdmin } = useAuth();

  const groups = [
    {
      label: "Account",
      items: [
        { href: "/settings/profile", icon: User, label: "My Profile", show: true },
      ],
    },
    {
      label: "Appearance",
      items: [
        { href: "/settings/theme", icon: Palette, label: "Theme", show: true },
      ],
    },
    {
      label: "Admin",
      items: [
        { href: "/settings/menu-editor", icon: ListTree, label: "Menu Editor", show: isSuperAdmin },
        { href: "/settings/payment-methods", icon: CreditCard, label: "Payment Methods", show: isSuperAdmin },
      ],
    },
  ];

  const isActive = (href: string) =>
    router.pathname === href || router.pathname.startsWith(href + "/");

  return (
    <AppLayout title={title}>
      <div className="flex min-h-[calc(100vh-3.5rem)]">
        <aside className="w-60 shrink-0 border-r border-border bg-muted/30 p-4">
          <h2 className="text-lg font-semibold px-2 mb-4">Settings</h2>
          <nav className="space-y-5">
            {groups.map((g) => {
              const visible = g.items.filter((i) => i.show);
              if (visible.length === 0) return null;
              return (
                <div key={g.label}>
                  <div className="px-2 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{g.label}</div>
                  <div className="space-y-0.5">
                    {visible.map((item) => {
                      const active = isActive(item.href);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={cn(
                            "flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-sm transition-colors",
                            active
                              ? "bg-primary/10 text-primary font-medium"
                              : "text-foreground/80 hover:bg-muted hover:text-foreground"
                          )}
                        >
                          <item.icon className="h-4 w-4" />
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </nav>
        </aside>
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </AppLayout>
  );
}