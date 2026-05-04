import Link from "next/link";
import { useRouter } from "next/router";
import type { ReactNode } from "react";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { AuthGuard } from "@/components/AuthGuard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Search, type LucideIcon } from "lucide-react";
import { getStore } from "@/services/storeService";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-client";
import type { Database } from "@/integrations/supabase/helpers";

type StoreRow = Database["public"]["Tables"]["stores"]["Row"];

export function SitePageShell({ children }: { children: ReactNode }) {
  return (
    <AuthGuard>
      <SiteLayout>{children}</SiteLayout>
    </AuthGuard>
  );
}

function getSeededStore(id: string): StoreRow | undefined {
  if (!id || typeof window === "undefined") return undefined;
  try {
    const raw = localStorage.getItem("sidebar-sites-cache");
    if (!raw) return undefined;
    const list = JSON.parse(raw) as Array<StoreRow & { client_name?: string | null }>;
    const found = list.find((s) => s.id === id);
    if (!found) return undefined;
    const { client_name: _cn, ...rest } = found as StoreRow & { client_name?: string | null };
    void _cn;
    return rest as StoreRow;
  } catch {
    return undefined;
  }
}

export function useSiteFromRoute() {
  const router = useRouter();
  const id = typeof router.query.id === "string" ? router.query.id : "";
  const seeded = getSeededStore(id);
  const { data: store, isLoading } = useQuery({
    queryKey: queryKeys.store(id),
    queryFn: () => getStore(id),
    enabled: !!id,
    initialData: seeded,
    staleTime: 60_000,
  });
  // If we have seeded data, never show full-page loading.
  const loading = !seeded && isLoading;
  return { id, store: store ?? null, loading };
}

interface SiteSectionHeaderProps {
  store: StoreRow | null;
  searchPlaceholder: string;
  search: string;
  onSearchChange: (v: string) => void;
}

export function SiteSectionHeader({ store, searchPlaceholder, search, onSearchChange }: SiteSectionHeaderProps) {
  return (
    <div className="flex items-center gap-4 flex-wrap">
      <Link href="/projects">
        <Button variant="ghost" size="icon" className="h-8 w-8"><ArrowLeft className="h-4 w-4" /></Button>
      </Link>
      <div className="min-w-0">
        <h1 className="text-xl font-semibold truncate leading-tight">{store?.name || "—"}</h1>
        <p className="text-xs text-muted-foreground truncate">{store?.url || ""}</p>
      </div>
      <div className="relative w-full max-w-[320px] ml-auto">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input placeholder={searchPlaceholder} value={search} onChange={(e) => onSearchChange(e.target.value)} className="pl-9 h-9" />
      </div>
    </div>
  );
}

interface SitePagePlaceholderProps {
  title: string;
  description?: string;
  icon: LucideIcon;
  exploreLabel?: string;
}

export function SitePagePlaceholder({ title, description, icon: Icon }: SitePagePlaceholderProps) {
  return (
    <Card>
      <CardContent className="py-16 text-center">
        <Icon className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
        <h2 className="text-base font-semibold">{title}</h2>
        {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
      </CardContent>
    </Card>
  );
}

export function SiteLoadingSkeleton() {
  return (
    <div className="p-6 space-y-4">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-10 w-full max-w-xl" />
      <Skeleton className="h-96 w-full" />
    </div>
  );
}

export function CustomerDetailSkeleton() {
  return (
    <div className="p-6 space-y-4 max-w-[1200px] mx-auto animate-in fade-in duration-200">
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-16" />
        <Skeleton className="h-7 w-48" />
      </div>
      <Card>
        <CardContent className="p-5 flex items-center gap-4">
          <Skeleton className="h-16 w-16 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-56" />
            <Skeleton className="h-3.5 w-72" />
            <Skeleton className="h-3 w-40" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-9" />
          </div>
        </CardContent>
      </Card>
      <div className="flex gap-2">
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-9 w-28" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card><CardContent className="p-5 space-y-3">
          <Skeleton className="h-4 w-32" />
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex justify-between">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-3.5 w-32" />
            </div>
          ))}
        </CardContent></Card>
        <Card><CardContent className="p-5 space-y-3">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-5/6" />
          <Skeleton className="h-3.5 w-4/6" />
          <Skeleton className="h-3.5 w-3/4" />
        </CardContent></Card>
      </div>
    </div>
  );
}