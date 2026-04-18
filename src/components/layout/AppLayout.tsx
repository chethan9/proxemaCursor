import Head from "next/head";
import { AppSidebar } from "./AppSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";

interface AppLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function AppLayout({ children, title, subtitle, actions }: AppLayoutProps) {
  const fullTitle = title ? `${title} · WooSync` : "WooSync";
  return (
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
          <main id="main-content" className="flex-1 overflow-auto">
            <div className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
              {(title || actions) && (
                <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    {title && (
                      <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[1.75rem]">
                        {title}
                      </h1>
                    )}
                    {subtitle && (
                      <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
                    )}
                  </div>
                  {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
                </header>
              )}
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}