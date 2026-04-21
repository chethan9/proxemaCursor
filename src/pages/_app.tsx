import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { QueryClientProvider } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { ThemeProvider } from "@/contexts/ThemeProvider";
import { BrandingProvider } from "@/contexts/BrandingProvider";
import { AuthProvider, useAuth } from "@/contexts/AuthProvider";
import { Toaster } from "@/components/ui/toaster";
import { BulkJobsToast } from "@/components/BulkJobsToast";
import { ScrollToEdgeButton } from "@/components/layout/ScrollToEdgeButton";
import { IncompleteOnboardingPrompt } from "@/components/IncompleteOnboardingPrompt";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { makeQueryClient } from "@/lib/query-client";
import { createPersister, clearPersistedCache, getCacheBustKey, setCacheBustKey } from "@/lib/query-persistence";

function CacheBuster() {
  const { user } = useAuth();
  useEffect(() => {
    const current = getCacheBustKey();
    const uid = user?.id || null;
    if (current !== uid) {
      clearPersistedCache();
      setCacheBustKey(uid);
    }
  }, [user?.id]);
  return null;
}

function GlobalScrollButton() {
  const router = useRouter();
  const hidden = router.pathname.startsWith("/auth") || router.pathname.startsWith("/sites/connect");
  if (hidden) return null;
  return <ScrollToEdgeButton />;
}

function Shell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, loading } = useAuth();
  const noShellRoute =
    router.pathname.startsWith("/auth") ||
    router.pathname.startsWith("/sites/connect") ||
    router.pathname.startsWith("/sites/[id]") ||
    router.pathname === "/404";

  if (noShellRoute || loading || !user) {
    return <>{children}</>;
  }

  return (
    <SidebarProvider>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        Skip to main content
      </a>
      <div className="flex h-screen w-full overflow-hidden bg-background">
        <AppSidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <main id="main-content" className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <CacheBuster />
        <BrandingProvider>
          <Shell>{children}</Shell>
          <BulkJobsToast />
          <GlobalScrollButton />
          <IncompleteOnboardingPrompt />
        </BrandingProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default function App({ Component, pageProps }: AppProps) {
  const [queryClient] = useState(() => makeQueryClient());
  const [persister] = useState(() => createPersister());

  if (!persister) {
    return (
      <QueryClientProvider client={queryClient}>
        <Providers>
          <Component {...pageProps} />
          <Toaster />
        </Providers>
      </QueryClientProvider>
    );
  }

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: 24 * 60 * 60 * 1000,
        buster: "v1",
      }}
    >
      <Providers>
        <Component {...pageProps} />
        <Toaster />
      </Providers>
    </PersistQueryClientProvider>
  );
}