/**
 * Cloudflare Images mirror status for a store (same store id as Projects workspace `/projects/[id]`).
 * Lives under `/projects/...` so it sits next to the technical project/workspace tooling.
 */
import { useEffect, useState } from "react";
import { SitePageShell, useSiteFromRoute, SiteLoadingSkeleton } from "@/components/site/shared";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { setCfDebugBadge, useCfDebugBadge } from "@/hooks/useCfDebugBadge";
import type { StoreCloudflareStats } from "@/pages/api/stores/[storeId]/cloudflare/stats";
import { Loader2, RefreshCw, Cloud, AlertTriangle, Zap } from "lucide-react";
import { formatDateTime } from "@/lib/format-number";
import { useTranslation } from "next-i18next";

async function authFetch(url: string, init?: RequestInit) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  return fetch(url, {
    ...init,
    headers: {
      ...init?.headers,
      Authorization: `Bearer ${token ?? ""}`,
      "Content-Type": "application/json",
    },
  });
}

function Inner() {
  const { id: storeId, store, loading } = useSiteFromRoute();
  const { toast } = useToast();
  const { i18n } = useTranslation();
  const cfDebugOn = useCfDebugBadge();
  const [stats, setStats] = useState<StoreCloudflareStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [rows, setRows] = useState<
    Array<{
      id: string;
      status: string;
      error: string | null;
      updated_at: string;
      product_name: string | null;
      src_normalized: string;
    }>
  >([]);
  const [rowsLoading, setRowsLoading] = useState(true);
  const [retrying, setRetrying] = useState<string | null>(null);
  /** Cursor for store-scoped mirror backfill; null = from first product. */
  const [mirrorAfterId, setMirrorAfterId] = useState<string | null>(null);
  const [syncLoading, setSyncLoading] = useState(false);

  const loadStats = async () => {
    if (!storeId) return;
    setStatsLoading(true);
    try {
      const res = await authFetch(`/api/stores/${storeId}/cloudflare/stats`);
      if (!res.ok) throw new Error(`Stats ${res.status}`);
      setStats((await res.json()) as StoreCloudflareStats);
    } catch (e) {
      toast({
        title: "Could not load stats",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setStatsLoading(false);
    }
  };

  const loadRows = async () => {
    if (!storeId) return;
    setRowsLoading(true);
    try {
      const res = await authFetch(`/api/stores/${storeId}/cloudflare/mirrors-recent`);
      if (!res.ok) throw new Error(`History ${res.status}`);
      const j = (await res.json()) as {
        rows: Array<{
          id: string;
          status: string;
          error: string | null;
          updated_at: string;
          product_name: string | null;
          src_normalized: string;
        }>;
      };
      setRows(j.rows || []);
    } catch (e) {
      toast({
        title: "Could not load mirror history",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setRowsLoading(false);
    }
  };

  useEffect(() => {
    void loadStats();
    void loadRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  if (loading) return <SiteLoadingSkeleton />;
  if (!store) return <div className="p-6">Store not found</div>;

  const ready = stats?.mirrorRows.ready ?? 0;
  const pending = stats?.mirrorRows.pending ?? 0;
  const failed = stats?.mirrorRows.failed ?? 0;
  const totalTracked = ready + pending + failed + (stats?.mirrorRows.deleting ?? 0);
  const slots = stats?.gallerySlots ?? 0;
  const coverage = slots > 0 ? Math.round((ready / slots) * 100) : 0;

  const runMirrorBatch = async () => {
    if (!storeId) return;
    setSyncLoading(true);
    try {
      const res = await authFetch(`/api/stores/${storeId}/cloudflare/force-sync`, {
        method: "POST",
        body: JSON.stringify({
          afterId: mirrorAfterId,
          rounds: 8,
          productLimit: 80,
        }),
      });
      const j = (await res.json()) as {
        error?: string;
        integrationEnabled?: boolean;
        touched?: number;
        scanned?: number;
        errors?: number;
        hasMore?: boolean;
        nextAfterId?: string | null;
        roundsRun?: number;
      };
      if (!res.ok) throw new Error(j.error || `Sync ${res.status}`);
      if (j.integrationEnabled === false) {
        toast({
          title: "Cloudflare mirroring is off",
          description: "Server-side Cloudflare Images is not configured or disabled.",
          variant: "destructive",
        });
        return;
      }
      const hasMore = Boolean(j.hasMore && j.nextAfterId);
      setMirrorAfterId(hasMore ? (j.nextAfterId ?? null) : null);
      const touched = j.touched ?? 0;
      const scanned = j.scanned ?? 0;
      const errors = j.errors ?? 0;
      const rounds = j.roundsRun ?? 1;
      toast({
        title: hasMore ? "Batch finished — more products remain" : "Mirror batch finished",
        description: `Ran ${rounds} round(s). Touched ${touched} product(s), scanned ${scanned} in batch window. Errors: ${errors}.`,
      });
      await loadStats();
    } catch (e) {
      toast({
        title: "Mirror batch failed",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setSyncLoading(false);
    }
  };

  const retry = async (mirrorId: string) => {
    setRetrying(mirrorId);
    try {
      const res = await authFetch(`/api/stores/${storeId}/cloudflare/retry-mirror`, {
        method: "POST",
        body: JSON.stringify({ mirrorId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || "Retry failed");
      }
      toast({ title: "Retry queued" });
      await loadStats();
      await loadRows();
    } catch (e) {
      toast({
        title: "Retry failed",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setRetrying(null);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-[1100px] mx-auto">
      <div>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <Cloud className="h-6 w-6" />
          Cloudflare Images
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Mirror status for <span className="font-medium text-foreground">{store.name}</span>
        </p>
      </div>

      <Tabs defaultValue="status" className="space-y-4">
        <TabsList>
          <TabsTrigger value="status">Status</TabsTrigger>
          <TabsTrigger value="history">Sync history</TabsTrigger>
        </TabsList>

        <TabsContent value="status" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle className="text-base">Debug</CardTitle>
                <CardDescription>
                  When on, the products grid shows a small Cloudflare badge on thumbnails served from{" "}
                  <code className="text-xs">imagedelivery.net</code>.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Label htmlFor="cf-debug" className="text-sm">
                  Show Cloudflare badge
                </Label>
                <Switch
                  id="cf-debug"
                  checked={cfDebugOn}
                  onCheckedChange={(v) => setCfDebugBadge(!!v)}
                />
              </div>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Coverage</CardTitle>
                <CardDescription>Woo gallery slots vs mirrored-ready assets.</CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2 justify-end">
                {mirrorAfterId != null && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground"
                    onClick={() => setMirrorAfterId(null)}
                    disabled={syncLoading || statsLoading}
                  >
                    Start scan over
                  </Button>
                )}
                <Button
                  variant="default"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => void runMirrorBatch()}
                  disabled={syncLoading || statsLoading || stats?.configResolved === false}
                >
                  {syncLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Zap className="h-3.5 w-3.5" />
                  )}
                  {mirrorAfterId == null ? "Run mirror batch" : "Continue mirror batch"}
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => void loadStats()} disabled={statsLoading}>
                  <RefreshCw className={`h-3.5 w-3.5 ${statsLoading ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {statsLoading && !stats ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : stats ? (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                    <div className="rounded-lg border p-3">
                      <div className="text-muted-foreground text-xs">Gallery images</div>
                      <div className="text-2xl font-semibold">{slots}</div>
                    </div>
                    <div className="rounded-lg border p-3">
                      <div className="text-muted-foreground text-xs">Ready (CF)</div>
                      <div className="text-2xl font-semibold text-emerald-600">{ready}</div>
                    </div>
                    <div className="rounded-lg border p-3">
                      <div className="text-muted-foreground text-xs">Pending</div>
                      <div className="text-2xl font-semibold text-amber-600">{pending}</div>
                    </div>
                    <div className="rounded-lg border p-3">
                      <div className="text-muted-foreground text-xs">Failed</div>
                      <div className="text-2xl font-semibold text-destructive">{failed}</div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span>Coverage (ready / gallery slots)</span>
                      <span>{coverage}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 transition-all"
                        style={{ width: `${Math.min(100, coverage)}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <Badge variant={stats.configResolved ? "default" : "destructive"}>
                      Server CF config: {stats.configResolved ? "resolved" : "missing"}
                    </Badge>
                    <Badge variant={stats.publicFlagOn ? "default" : "secondary"}>
                      NEXT_PUBLIC_CLOUDFLARE_PRODUCT_IMAGES: {stats.publicFlagOn ? "true" : "off"}
                    </Badge>
                  </div>
                  {stats.lastMirrorActivityAt && (
                    <p className="text-xs text-muted-foreground">
                      Last mirror activity:{" "}
                      {formatDateTime(stats.lastMirrorActivityAt, i18n.language)}
                    </p>
                  )}
                  {!stats.configResolved && (
                    <div className="flex gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
                      <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                      <span>
                        Cloudflare API credentials are not configured or invalid — uploads won&apos;t run until fixed
                        (see admin Cloudflare Images).
                      </span>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Tracked mirror rows: {totalTracked} (includes deleting state).
                  </p>
                  <p className="text-xs text-muted-foreground border-t pt-3 mt-1">
                    <span className="font-medium text-foreground">Run mirror batch</span> processes several waves of
                    products per click (uploads missing images to Cloudflare). Repeat until coverage catches up or the
                    toast says there is nothing left to scan.
                  </p>
                </>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Recent mirror operations</CardTitle>
                <CardDescription>Latest rows from product_image_mirrors for this store.</CardDescription>
              </div>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => void loadRows()} disabled={rowsLoading}>
                <RefreshCw className={`h-3.5 w-3.5 ${rowsLoading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </CardHeader>
            <CardContent>
              {rowsLoading && rows.length === 0 ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Updated</TableHead>
                      <TableHead className="w-[100px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                          No mirror rows yet.
                        </TableCell>
                      </TableRow>
                    ) : (
                      rows.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium max-w-[200px] truncate">
                            {r.product_name || "—"}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                r.status === "ready"
                                  ? "default"
                                  : r.status === "failed"
                                    ? "destructive"
                                    : "secondary"
                              }
                            >
                              {r.status}
                            </Badge>
                            {r.error && (
                              <div className="text-[10px] text-destructive mt-1 line-clamp-2">{r.error}</div>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {formatDateTime(r.updated_at, i18n.language)}
                          </TableCell>
                          <TableCell>
                            {r.status === "failed" && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8"
                                disabled={retrying === r.id}
                                onClick={() => void retry(r.id)}
                              >
                                {retrying === r.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  "Retry"
                                )}
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function ProjectCloudflarePage() {
  return (
    <SitePageShell>
      <Inner />
    </SitePageShell>
  );
}
