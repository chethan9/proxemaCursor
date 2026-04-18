import Head from "next/head";
import { AppSidebar } from "./AppSidebar";
import { Breadcrumbs } from "./Breadcrumbs";
import { SidebarProvider } from "@/components/ui/sidebar";
import { useBranding } from "@/contexts/BrandingProvider";
import { AuthGuard } from "@/components/AuthGuard";
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
      <SidebarProvider>
        <Head>
          <title>{fullTitle}</title>
        </Head>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground focus:shadow-polaris-md"
        >
          Skip to main content
        </a>
        <div className="flex h-screen w-full overflow-hidden bg-background">
          <AppSidebar />
          <div className="flex flex-1 flex-col overflow-hidden">
            <Breadcrumbs />
            <main id="main-content" className="flex-1 overflow-auto">
              <div className="mx-auto w-full max-w-[1600px]">{children}</div>
            </main>
          </div>
        </div>
      </SidebarProvider>
    </AuthGuard>
  );
}