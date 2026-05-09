import "@/styles/globals.css";
import "@/components/product-edit/image-editor/product-image-editor-portals.css";
import "tippy.js/dist/tippy.css";
import "tippy.js/animations/scale.css";
import "grapesjs/dist/css/grapes.min.css";
import "@/components/templates/builder/builder-canvas.css";
import "@/components/templates/builder/builder-palette.css";
import "@/components/templates/builder/builder-right-panel.css";
import type { AppProps } from "next/app";
import { useEffect, useState, useRef } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/router";
import dynamic from "next/dynamic";
import { QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { appWithTranslation, useTranslation } from "next-i18next";
import nextI18NextConfig from "../../next-i18next.config.js";
import { ThemeProvider } from "@/contexts/ThemeProvider";
import { BrandingProvider } from "@/contexts/BrandingProvider";
import { AuthProvider, useAuth } from "@/contexts/AuthProvider";
import { RecentMutationsProvider } from "@/contexts/RecentMutationsProvider";
import { LoadingProvider } from "@/contexts/LoadingProvider";
import { BlockingOverlay } from "@/contexts/LoadingProvider";
import { Toaster } from "@/components/ui/toaster";
import { SidebarProvider } from "@/components/ui/sidebar";
import { TopProgressBar } from "@/components/ui/top-progress-bar";
import { makeQueryClient, queryKeys } from "@/lib/query-client";
import { createPersister, clearPersistedCache, getCacheBustKey, setCacheBustKey } from "@/lib/query-persistence";
import { initPostHog, capturePostHogPageView } from "@/lib/posthog";
import { isRtl } from "@/lib/i18n";
import { NAMESPACES } from "@/lib/i18n";
import { DeploymentVersionGate } from "@/components/DeploymentVersionGate";

const AppSidebar = dynamic(
  () => import("@/components/layout/AppSidebar").then((m) => m.AppSidebar),
  {
    loading: () => <aside className="h-screen w-14 shrink-0 border-r bg-background" aria-hidden="true" />,
  }
);
const ScrollToEdgeButton = dynamic(
  () => import("@/components/layout/ScrollToEdgeButton").then((m) => m.ScrollToEdgeButton),
  { ssr: false }
);
const GlobalAssistantDock = dynamic(
  () => import("@/components/assistant/AssistantDock").then((m) => m.GlobalAssistantDock),
  { ssr: false }
);
const IncompleteOnboardingPrompt = dynamic(
  () => import("@/components/IncompleteOnboardingPrompt").then((m) => m.IncompleteOnboardingPrompt),
  { ssr: false }
);

function LocaleDirSync() {
  const { i18n } = useTranslation();
  const { profile } = useAuth();
  const cookieLocale = typeof document !== "undefined"
    ? document.cookie.split("; ").find((row) => row.startsWith("NEXT_LOCALE="))?.split("=")[1]
    : undefined;

  useEffect(() => {
    const profileLocale = profile?.locale;
    const activeLanguage = i18n.language;
    const shouldTrustCurrentSelection =
      !!cookieLocale &&
      !!activeLanguage &&
      cookieLocale === activeLanguage &&
      profileLocale !== activeLanguage;
    if (profileLocale && profileLocale !== activeLanguage && !shouldTrustCurrentSelection) {
      i18n.changeLanguage(profileLocale);
      if (typeof document !== "undefined") {
        document.cookie = `NEXT_LOCALE=${profileLocale}; path=/; max-age=31536000; SameSite=Lax`;
      }
    } else if (profileLocale && profileLocale !== activeLanguage && shouldTrustCurrentSelection) {
    }
  }, [profile?.locale, i18n, cookieLocale]);

  useEffect(() => {
    const lang = i18n.language || "en";
    if (typeof document === "undefined") return;
    document.documentElement.lang = lang;
    document.documentElement.dir = isRtl(lang) ? "rtl" : "ltr";
  }, [i18n.language]);
  return null;
}

function NavigationRouteProbe() {
  const router = useRouter();
  const t0Ref = useRef(0);
  useEffect(() => {
    const onStart = () => {
      t0Ref.current = performance.now();
    };
    const onComplete = () => {};
    router.events.on("routeChangeStart", onStart);
    router.events.on("routeChangeComplete", onComplete);
    return () => {
      router.events.off("routeChangeStart", onStart);
      router.events.off("routeChangeComplete", onComplete);
    };
  }, [router.events]);
  return null;
}

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
  const queryClient = useQueryClient();
  useEffect(() => {
    const current = getCacheBustKey();
    const uid = user?.id || null;
    if (current !== uid) {
      clearPersistedCache();
      setCacheBustKey(uid);
      queryClient.removeQueries({ queryKey: queryKeys.stores });
      queryClient.removeQueries({ queryKey: ["sync-runs"] });
    }
  }, [user?.id, queryClient]);
  return null;
}

function GlobalScrollButton() {
  const router = useRouter();
  const hidden = router.pathname.startsWith("/auth") || router.pathname.startsWith("/sites/connect");
  if (hidden) return null;
  return <ScrollToEdgeButton />;
}

function ShellMain({ children }: { children: ReactNode }) {
  return (
    <main id="main-content" className="flex-1 overflow-auto">
      {children}
    </main>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { user, loading } = useAuth();
  const noShellRoute =
    router.pathname.startsWith("/auth") ||
    router.pathname.startsWith("/sites/connect") ||
    router.pathname === "/templates/[id]" ||
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
          <ShellMain>{children}</ShellMain>
        </div>
      </div>
    </SidebarProvider>
  );
}

function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
    >
      <AuthProvider>
        <DeploymentVersionGate />
        <CacheBuster />
        <NavigationRouteProbe />
        <PostHogPageviews />
        <BrandingProvider>
          <RecentMutationsProvider>
            <LoadingProvider>
              <LocaleDirSync />
              <TopProgressBar />
              <I18nReadyGate>
                <Shell>{children}</Shell>
                <GlobalAssistantDock />
                <GlobalScrollButton />
              </I18nReadyGate>
              <IncompleteOnboardingPrompt />
              <BlockingOverlay />
            </LoadingProvider>
          </RecentMutationsProvider>
        </BrandingProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

function App({ Component, pageProps }: AppProps) {
  const [queryClient] = useState(() => makeQueryClient());
  const [persister] = useState(() => createPersister());

  if (!persister) {
    return (
      <QueryClientProvider client={queryClient}>
        <Providers>
          <Component {...pageProps} />
          <Toaster />
          <Analytics />
          <SpeedInsights />
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
        buster: "v2",
      }}
    >
      <Providers>
        <Component {...pageProps} />
        <Toaster />
        <Analytics />
        <SpeedInsights />
      </Providers>
    </PersistQueryClientProvider>
  );
}

function I18nReadyGate({ children }: { children: ReactNode }) {
  const { i18n } = useTranslation();
  const [ready, setReady] = useState(false);
  const mergedLanguagesRef = useRef<Set<string>>(new Set());
  const seqRef = useRef(0);

  useEffect(() => {
    const lang = i18n.language;
    if (!lang) {
      setReady(true);
      return;
    }
    const seq = ++seqRef.current;
    setReady(false);

    const buildId =
      typeof process !== "undefined" ? process.env.NEXT_PUBLIC_APP_BUILD_ID?.trim() : "";
    const bust = buildId ? `?v=${encodeURIComponent(buildId)}` : "";

    (async () => {
      try {
        // Ensure static/file namespaces are loaded first.
        await i18n.loadNamespaces([...NAMESPACES]);

        // Then deep-merge DB overrides + file bundle snapshot from API.
        if (!mergedLanguagesRef.current.has(lang)) {
          await Promise.all(
            NAMESPACES.map(async (ns) => {
              const res = await fetch(
                `/api/i18n/${encodeURIComponent(lang)}/${encodeURIComponent(ns)}${bust}`,
              );
              if (!res.ok) return;
              const merged = await res.json();
              i18n.addResourceBundle(lang, ns, merged, true, true);
            }),
          );
          mergedLanguagesRef.current.add(lang);
        }
      } catch {
        /* keep static file-based translations on network failure */
      } finally {
        if (seqRef.current === seq) {
          setReady(true);
        }
      }
    })();
  }, [i18n, i18n.language]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div
          className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary"
          aria-label="Loading translations"
        />
      </div>
    );
  }

  return <>{children}</>;
}

export default appWithTranslation(App, nextI18NextConfig);