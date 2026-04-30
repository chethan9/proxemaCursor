import Head from "next/head";
import { useBranding } from "@/contexts/BrandingProvider";
import { AuthGuard } from "@/components/AuthGuard";
import { BillingGate } from "@/components/billing/BillingGate";
import { SubscriptionStatusBanner } from "@/components/billing/SubscriptionStatusBanner";
import { BillingDevModeBanner } from "@/components/billing/BillingDevModeBanner";
import type { Permission } from "@/lib/permissions";

interface AppLayoutProps {
  children: React.ReactNode;
  title?: string;
  requirePermission?: Permission;
  requireSuperAdmin?: boolean;
  bypassBillingGate?: boolean;
}

export function AppLayout({ children, title, requirePermission, requireSuperAdmin, bypassBillingGate }: AppLayoutProps) {
  const { brandName } = useBranding();
  const fullTitle = title ? `${title} · ${brandName}` : brandName;
  const content = (
    <>
      <Head>
        <title>{fullTitle}</title>
      </Head>
      <BillingDevModeBanner />
      <SubscriptionStatusBanner />
      <div className="mx-auto w-full max-w-[1600px]">{children}</div>
    </>
  );
  return (
    <AuthGuard requirePermission={requirePermission} requireSuperAdmin={requireSuperAdmin}>
      {bypassBillingGate ? content : <BillingGate>{content}</BillingGate>}
    </AuthGuard>
  );
}