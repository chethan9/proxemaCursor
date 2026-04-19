import { useRouter } from "next/router";
import { AppSidebar } from "./AppSidebar";
import { SiteSidebar } from "./SiteSidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { SyncProgressBanner } from "@/components/SyncProgressBanner";

type Props = { children: React.ReactNode };

export function SiteLayout({ children }: Props) {
  const router = useRouter();
  const siteId = typeof router.query.id === "string" ? router.query.id : undefined;

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <AppSidebar />
      {siteId ? (
        <SiteSidebar siteId={siteId} />
      ) : (
        <aside className="flex shrink-0 flex-col w-52 bg-background border-r border-border p-2 gap-2">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </aside>
      )}
      <main className="flex-1 overflow-y-auto">
        {siteId && <SyncProgressBanner storeId={siteId} />}
        {children}
      </main>
    </div>
  );
}