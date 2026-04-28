import { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useTranslation } from "next-i18next";
import { AppLayout } from "./AppLayout";
import { User, Palette, CreditCard, UserCog, Shield, ListTree, Layers, Sparkles, Activity, Receipt, Languages } from "lucide-react";
import { useAuth } from "@/contexts/AuthProvider";
import { PERMISSIONS, type Permission } from "@/lib/permissions";
import { cn } from "@/lib/utils";

interface SettingsLayoutProps {
  children: ReactNode;
  title?: string;
  requirePermission?: Permission;
  requireSuperAdmin?: boolean;
}

export function SettingsLayout({ children, title, requirePermission, requireSuperAdmin }: SettingsLayoutProps) {
  const router = useRouter();
  const { can, isSuperAdmin } = useAuth();
  const { t } = useTranslation("common");

  const groups = [
    {
      label: t("settings.groups.account"),
      items: [
        { href: "/settings/profile", icon: User, label: t("settings.items.myProfile"), show: true },
        { href: "/settings/my-activity", icon: Activity, label: t("settings.items.myActivity"), show: true },
      ],
    },
    {
      label: t("settings.groups.appearance"),
      items: [
        { href: "/settings/theme", icon: Palette, label: t("settings.items.theme"), show: true },
        { href: "/settings/branding", icon: Sparkles, label: t("settings.items.branding"), show: isSuperAdmin },
      ],
    },
    {
      label: t("settings.groups.team"),
      items: [
        { href: "/settings/users", icon: UserCog, label: t("settings.items.users"), show: can(PERMISSIONS.USERS_VIEW) || isSuperAdmin },
        { href: "/settings/roles", icon: Shield, label: t("settings.items.roles"), show: can(PERMISSIONS.ROLES_VIEW) || isSuperAdmin },
      ],
    },
    {
      label: t("settings.groups.admin"),
      items: [
        { href: "/settings/plans", icon: Layers, label: t("settings.items.plans"), show: isSuperAdmin },
        { href: "/settings/subscriptions", icon: Receipt, label: t("settings.items.subscriptions"), show: isSuperAdmin },
        { href: "/settings/menu-editor", icon: ListTree, label: t("settings.items.menuEditor"), show: isSuperAdmin },
        { href: "/settings/payment-methods", icon: CreditCard, label: t("settings.items.paymentMethods"), show: isSuperAdmin },
        { href: "/settings/translations", icon: Languages, label: t("settings.items.translations"), show: isSuperAdmin },
      ],
    },
  ];

  const isActive = (href: string) =>
    router.pathname === href || router.pathname.startsWith(href + "/");

  return (
    <AppLayout title={title || t("settings.title")} requirePermission={requirePermission} requireSuperAdmin={requireSuperAdmin}>
      <div className="flex min-h-[calc(100vh-3.5rem)]">
        <aside className="w-60 shrink-0 border-r border-border bg-muted/30 p-4">
          <h2 className="text-lg font-semibold px-2 mb-4">{t("settings.title")}</h2>
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