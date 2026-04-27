import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { QueryClientProvider } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { Analytics } from "@vercel/analytics/next";
import { ThemeProvider } from "@/contexts/ThemeProvider";
import { BrandingProvider } from "@/contexts/BrandingProvider";
import { AuthProvider, useAuth } from "@/contexts/AuthProvider";
import { RecentMutationsProvider } from "@/contexts/RecentMutationsProvider";
import { LoadingProvider } from "@/contexts/LoadingProvider";
import { BlockingOverlay } from "@/contexts/LoadingProvider";
import { Toaster } from "@/components/ui/toaster";
import { BulkJobsToast } from "@/components/BulkJobsToast";
import { ScrollToEdgeButton } from "@/components/layout/ScrollToEdgeButton";
import { IncompleteOnboardingPrompt } from "@/components/IncompleteOnboardingPrompt";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { ThemeSwitch } from "@/components/ThemeSwitch";
import { TopProgressBar } from "@/components/ui/top-progress-bar";
import { makeQueryClient } from "@/lib/query-client";
import { createPersister, clearPersistedCache, getCacheBustKey, setCacheBustKey } from "@/lib/query-persistence";
import { initPostHog, capturePostHogPageView } from "@/lib/posthog";

function PostHogPageviews() {
  const router = useRouter();
  useEffect(() => {
    initPostHog();
  }, []);
  useEffect(() => {
    if (typeof window === "undefined") return;
    import("../../sentry.client.config").catch(() => {});
  }, []);
  useEffect(() => {
    const handle = (url: string) => capturePostHogPageView(url);
    router.events.on("routeChangeComplete", handle);
    return () => {
      router.events.off("routeChangeComplete", handle);
    };
  }, [router.events]);
  return null;
}

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
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
    >
      <AuthProvider>
        <CacheBuster />
        <PostHogPageviews />
        <BrandingProvider>
          <RecentMutationsProvider>
            <LoadingProvider>
              <TopProgressBar />
              <Shell>{children}</Shell>
              <BulkJobsToast />
              <GlobalScrollButton />
              <IncompleteOnboardingPrompt />
              <BlockingOverlay />
            </LoadingProvider>
          </RecentMutationsProvider>
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
          <Analytics />
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
        <Analytics />
      </Providers>
    </PersistQueryClientProvider>
  );
}