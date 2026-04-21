import { useRouter } from "next/router";
import { useEffect, useRef } from "react";
import { SiteSidebar } from "./SiteSidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { useStore } from "@/hooks/queries/useStores";
import { useToast } from "@/hooks/use-toast";
import { InitialSyncBanner } from "@/components/site/InitialSyncBanner";
import { useSyncCompletionInvalidation } from "@/hooks/queries/useSyncCompletionInvalidation";

type Props = { children: React.ReactNode };

export function SiteLayout({ children }: Props) {
  const router = useRouter();
  const siteId = typeof router.query.id === "string" ? router.query.id : undefined;
  const { data: store, isLoading, isFetched } = useStore(siteId);
  const { toast } = useToast();
  const redirectedRef = useRef(false);
  useSyncCompletionInvalidation(siteId);

  useEffect(() => {
    if (!siteId) return;
    if (!router.pathname.startsWith("/sites/")) return;
    if (redirectedRef.current) return;
    if (isFetched && !isLoading && store === null) {
      redirectedRef.current = true;
      toast({ title: "Site no longer exists", description: "Redirecting to your projects", variant: "destructive" });
      router.replace("/projects");
    }
  }, [siteId, isFetched, isLoading, store, router, toast]);

  return (
    <div className="flex h-full w-full overflow-hidden">
      {siteId ? (
        <SiteSidebar siteId={siteId} />
      ) : (
        <aside className="flex shrink-0 flex-col w-52 bg-background border-r border-border p-2 gap-2">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </aside>
      )}
      <div className="flex-1 overflow-y-auto">
        <InitialSyncBanner />
        {children}
      </div>
    </div>
  );
}