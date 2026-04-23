import Head from "next/head";
import { useBranding } from "@/contexts/BrandingProvider";
import { AuthGuard } from "@/components/AuthGuard";
import { SubscriptionStatusBanner } from "@/components/billing/SubscriptionStatusBanner";
import type { Permission } from "@/lib/permissions";

interface AppLayoutProps {
  children: React.ReactNode;
  title?: string;
  requirePermission?: Permission;
  requireSuperAdmin?: boolean;
}

export function AppLayout({ children, title, requirePermission, requireSuperAdmin }: AppLayoutProps) {
  const { brandName } = useBranding();
  const fullTitle = title ? `${title} · ${brandName}` : brandName;
  return (
    <AuthGuard requirePermission={requirePermission} requireSuperAdmin={requireSuperAdmin}>
      <Head>
        <title>{fullTitle}</title>
      </Head>
      <SubscriptionStatusBanner />
      <div className="mx-auto w-full max-w-[1600px]">{children}</div>
    </AuthGuard>
  );
}