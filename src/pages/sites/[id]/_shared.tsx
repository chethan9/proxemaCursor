import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { AuthGuard } from "@/components/AuthGuard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Search, type LucideIcon } from "lucide-react";
import { getStore } from "@/services/storeService";
import type { Database } from "@/integrations/supabase/types";

type StoreRow = Database["public"]["Tables"]["stores"]["Row"];

export function SitePageShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <SiteLayout>{children}</SiteLayout>
    </AuthGuard>
  );
}

export function useSiteFromRoute() {
  const router = useRouter();
  const id = typeof router.query.id === "string" ? router.query.id : "";
  const [store, setStore] = useState<StoreRow | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getStore(id).then((s) => setStore(s)).catch(() => {}).finally(() => setLoading(false));
  }, [id]);
  return { id, store, loading };
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
      <Link href="/sites">
        <Button variant="ghost" size="icon" className="h-8 w-8"><ArrowLeft className="h-4 w-4" /></Button>
      </Link>
      <div className="min-w-0">
        <h1 className="text-xl font-semibold truncate leading-tight">{store?.name || "—"}</h1>
        <p className="text-xs text-muted-foreground truncate">{store?.url || ""}</p>
      </div>
      <div className="flex-1 flex justify-center min-w-[240px] px-4">
        <div className="relative w-full max-w-[560px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input placeholder={searchPlaceholder} value={search} onChange={(e) => onSearchChange(e.target.value)} className="pl-9 h-9" />
        </div>
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