import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { AuthGuard } from "@/components/AuthGuard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge, getStatusVariant } from "@/components/ui/status-badge";
import { supabase } from "@/integrations/supabase/client";
import { getStore, type Store } from "@/services/storeService";
import {
  Package, ShoppingCart, Users, Layers, Tag, Ticket,
  BarChart3, Sparkles, ExternalLink, Clock, RefreshCw, Copy, Database,
} from "lucide-react";

type Counts = Record<"products" | "orders" | "customers" | "categories" | "tags" | "coupons", number>;

const ASPECTS: { id: keyof Counts; label: string; icon: typeof Package; color: string }[] = [
  { id: "products", label: "Products", icon: Package, color: "text-blue-500" },
  { id: "orders", label: "Orders", icon: ShoppingCart, color: "text-green-500" },
  { id: "customers", label: "Customers", icon: Users, color: "text-purple-500" },
  { id: "categories", label: "Categories", icon: Layers, color: "text-orange-500" },
  { id: "tags", label: "Tags", icon: Tag, color: "text-cyan-500" },
  { id: "coupons", label: "Coupons", icon: Ticket, color: "text-pink-500" },
];

function formatRelative(d: string | null) {
  if (!d) return "Never";
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function SiteHomeInner() {
  const router = useRouter();
  const id = typeof router.query.id === "string" ? router.query.id : undefined;
  const [store, setStore] = useState<Store | null>(null);
  const [counts, setCounts] = useState<Counts>({ products: 0, orders: 0, customers: 0, categories: 0, tags: 0, coupons: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [s, p, o, c, cat, t, cp] = await Promise.all([
        getStore(id),
        supabase.from("products").select("id", { count: "exact", head: true }).eq("store_id", id),
        supabase.from("orders").select("id", { count: "exact", head: true }).eq("store_id", id),
        supabase.from("customers").select("id", { count: "exact", head: true }).eq("store_id", id),
        supabase.from("categories").select("id", { count: "exact", head: true }).eq("store_id", id),
        supabase.from("tags").select("id", { count: "exact", head: true }).eq("store_id", id),
        supabase.from("coupons").select("id", { count: "exact", head: true }).eq("store_id", id),
      ]);
      if (cancelled) return;
      setStore(s);
      setCounts({
        products: p.count || 0, orders: o.count || 0, customers: c.count || 0,
        categories: cat.count || 0, tags: t.count || 0, coupons: cp.count || 0,
      });
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [id]);

  if (loading || !store) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-24 w-full" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const totalRecords = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      {/* Header card */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="space-y-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-semibold tracking-tight">{store.name}</h1>
                <StatusBadge variant={getStatusVariant(store.status || "pending")}>{store.status}</StatusBadge>
                <code className="text-xs bg-muted px-2 py-0.5 rounded font-mono flex items-center gap-1">
                  {store.id.substring(0, 8).toUpperCase()}
                  <button onClick={() => navigator.clipboard.writeText(store.id)} className="hover:text-primary" aria-label="Copy ID">
                    <Copy className="h-3 w-3" />
                  </button>
                </code>
              </div>
              <p className="text-sm text-muted-foreground">{store.url}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Last sync: {formatRelative(store.last_sync_at)}
                {store.next_sync_at && <span className="ml-2">• Next: {formatRelative(store.next_sync_at)}</span>}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link href={`/explore/${store.id}`}>
                <Button variant="outline" size="sm">
                  <Database className="h-4 w-4 mr-1.5" />
                  Data Explorer
                  <ExternalLink className="h-3 w-3 ml-1.5 opacity-60" />
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Record stats */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Synced records</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {ASPECTS.map((a) => {
            const Icon = a.icon;
            return (
              <Card key={a.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className={`h-4 w-4 ${a.color}`} />
                    <span className="text-xs font-medium text-muted-foreground">{a.label}</span>
                  </div>
                  <p className="text-2xl font-semibold tabular-nums">{counts[a.id].toLocaleString()}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          <span className="font-medium text-foreground tabular-nums">{totalRecords.toLocaleString()}</span> total records synced
        </p>
      </div>

      {/* Analytics coming soon */}
      <Card className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.03] via-transparent to-transparent pointer-events-none" aria-hidden />
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <BarChart3 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                Analytics
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                  <Sparkles className="h-2.5 w-2.5" />
                  Coming soon
                </span>
              </CardTitle>
              <CardDescription>Revenue trends, top products, customer insights and sync health metrics</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 opacity-50 pointer-events-none select-none">
            {["Revenue", "Top products", "New customers", "Sync success rate"].map((label) => (
              <div key={label} className="rounded-lg border border-dashed border-border p-4 space-y-2">
                <p className="text-xs text-muted-foreground">{label}</p>
                <div className="h-8 bg-muted rounded animate-pulse" />
                <div className="h-3 w-2/3 bg-muted rounded animate-pulse" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Migration notice */}
      <Card className="border-dashed">
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            <RefreshCw className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium">Workspace is being reorganized</p>
              <p className="text-sm text-muted-foreground">
                Sync engine, webhooks, logs and settings are moving to dedicated pages in the sidebar. Meanwhile, use the{" "}
                <Link href={`/explore/${store.id}`} className="text-primary underline">Data Explorer</Link>{" "}
                for products and orders, and the global{" "}
                <Link href="/sync-runs" className="text-primary underline">Sync runs</Link>,{" "}
                <Link href="/webhooks" className="text-primary underline">Webhooks</Link> pages for management.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SiteHomePage() {
  return (
    <AuthGuard>
      <SiteLayout>
        <SiteHomeInner />
      </SiteLayout>
    </AuthGuard>
  );
}