import { useRouter } from "next/router";
import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { SiteSidebar } from "./SiteSidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { useStore } from "@/hooks/queries/useStores";
import { useToast } from "@/hooks/use-toast";
import { InitialSyncBanner } from "@/components/site/InitialSyncBanner";
import { useSyncCompletionInvalidation } from "@/hooks/queries/useSyncCompletionInvalidation";
import { useTranslation } from "next-i18next";

type Props = { children: ReactNode };

export function SiteLayout({ children }: Props) {
  const router = useRouter();
  const { t } = useTranslation("common");
  const siteId = typeof router.query.id === "string" ? router.query.id : undefined;
  const { data: store, isLoading, isFetched } = useStore(siteId);
  const { toast } = useToast();
  const redirectedRef = useRef(false);
  useSyncCompletionInvalidation(siteId);

  /** Warm route JS early so first click Orders/Products feels instant (no full-content swap). */
  useEffect(() => {
    if (!siteId) return;
    const paths = [
      `/sites/${siteId}/orders`,
      `/sites/${siteId}/products`,
      `/sites/${siteId}/customers`,
      `/sites/${siteId}/categories`,
      `/sites/${siteId}/tags`,
      `/sites/${siteId}/brands`,
    ];
    for (const p of paths) {
      void router.prefetch(p);
    }
  }, [siteId, router]);

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
      <div id="site-scroll-root" className="flex-1 overflow-y-auto">
        <InitialSyncBanner />
        {children}
      </div>
    </div>
  );
}