import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";
import { SiteSidebar } from "./SiteSidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { useStore } from "@/hooks/queries/useStores";
import { useToast } from "@/hooks/use-toast";
import { InitialSyncBanner } from "@/components/site/InitialSyncBanner";
import { useSyncCompletionInvalidation } from "@/hooks/queries/useSyncCompletionInvalidation";
import { useTranslation } from "next-i18next";

type Props = { children: React.ReactNode };

export function SiteLayout({ children }: Props) {
  const router = useRouter();
  const { t } = useTranslation("common");
  const siteId = typeof router.query.id === "string" ? router.query.id : undefined;
  const { data: store, isLoading, isFetched, isFetching } = useStore(siteId);
  const { toast } = useToast();
  const redirectedRef = useRef(false);
  const [routeTransitioning, setRouteTransitioning] = useState(false);
  useSyncCompletionInvalidation(siteId);

  useEffect(() => {
    if (!siteId) return;
    if (!router.pathname.startsWith("/sites/")) return;
    if (redirectedRef.current) return;
    if (isFetched && !isLoading && store === null) {
      redirectedRef.current = true;
      toast({ title: t("siteLayout.siteNotFound.title"), description: t("siteLayout.siteNotFound.description"), variant: "destructive" });
      router.replace("/projects");
    }
  }, [siteId, isFetched, isLoading, store, router, toast]);

  useEffect(() => {
    const normalize = (url: string) => url.split("?")[0].split("#")[0];
    const onStart = (nextUrl: string) => {
      if (!siteId) return;
      const current = normalize(router.asPath);
      const next = normalize(nextUrl);
      if (current === next) return;
      if (next.startsWith(`/sites/${siteId}/`) || next === `/sites/${siteId}`) {
        setRouteTransitioning(true);
      }
    };
    const onDone = () => setRouteTransitioning(false);
    router.events.on("routeChangeStart", onStart);
    router.events.on("routeChangeComplete", onDone);
    router.events.on("routeChangeError", onDone);
    return () => {
      router.events.off("routeChangeStart", onStart);
      router.events.off("routeChangeComplete", onDone);
      router.events.off("routeChangeError", onDone);
    };
  }, [router, siteId]);

  return (
    <div className="flex h-full w-full overflow-hidden">
      {siteId ? (
        <SiteSidebar siteId={siteId} />
      ) : (
        <aside className="flex shrink-0 flex-col w-44 bg-background border-r border-border p-2 gap-2">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </aside>
      )}
      <div className="flex-1 overflow-y-auto">
        <InitialSyncBanner />
        {routeTransitioning ? (
          <div className="p-6 space-y-4">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-10 w-full max-w-xl" />
            <div className="rounded-lg border border-border bg-card p-4 space-y-3">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}