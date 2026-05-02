/**
 * Cloudflare product image mirror status and on-demand full-store sync (per store).
 * Used from `/projects/[id]/cloudflare` and `/sites/[id]/cloudflare`.
 */
import { useEffect, useState } from "react";
import { useSiteFromRoute, SiteLoadingSkeleton } from "@/components/site/shared";
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

export function CloudflareImagesInner() {
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
  const [syncLoading, setSyncLoading] = useState(false);
  /** When the server stops early (time limit), continue from this product id. */
  const [resumeAfterId, setResumeAfterId] = useState<string | null>(null);
  const [lastSyncSummary, setLastSyncSummary] = useState<{
    completed: boolean;
    rounds: number;
    totalTouched: number;
    totalScanned: number;
    totalErrors: number;
    elapsedMs: number;
  } | null>(null);

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

  const httpsSlots = stats?.httpsImageSlots ?? 0;
  const slotsReady = stats?.slotsWithReadyMirror ?? 0;
  const galleryAll = stats?.gallerySlots ?? 0;
  const readyRows = stats?.mirrorRows.ready ?? 0;
  const pending = stats?.mirrorRows.pending ?? 0;
  const failed = stats?.mirrorRows.failed ?? 0;
  const totalTracked = readyRows + pending + failed + (stats?.mirrorRows.deleting ?? 0);
  const slotCoveragePct = httpsSlots > 0 ? Math.round((slotsReady / httpsSlots) * 100) : 0;

  const runSyncAllImages = async (opts?: { continueOnly?: boolean; fromScratch?: boolean }) => {
    if (!storeId) return;
    const continueOnly = opts?.continueOnly === true;
    const fromScratch = opts?.fromScratch === true;
    setSyncLoading(true);
    setLastSyncSummary(null);
    try {
      const useResume = continueOnly && resumeAfterId && !fromScratch;
      const res = await authFetch(`/api/stores/${storeId}/cloudflare/sync-all-images`, {
        method: "POST",
        body: JSON.stringify(
          useResume ? { fromScratch: false, afterId: resumeAfterId } : { fromScratch: true },
        ),
      });
      const j = (await res.json()) as {
        error?: string;
        integrationEnabled?: boolean;
        completed?: boolean;
        rounds?: number;
        totalTouched?: number;
        totalScanned?: number;
        totalErrors?: number;
        nextAfterId?: string | null;
        elapsedMs?: number;
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

      setLastSyncSummary({
        completed: Boolean(j.completed),
        rounds: j.rounds ?? 0,
        totalTouched: j.totalTouched ?? 0,
        totalScanned: j.totalScanned ?? 0,
        totalErrors: j.totalErrors ?? 0,
        elapsedMs: j.elapsedMs ?? 0,
      });

      if (j.completed) {
        setResumeAfterId(null);
        toast({
          title: "Image sync finished",
          description: `Processed ${j.rounds ?? 0} batch rounds in ${((j.elapsedMs ?? 0) / 1000).toFixed(1)}s (${j.totalTouched ?? 0} products touched).`,
        });
      } else if (j.nextAfterId) {
        setResumeAfterId(j.nextAfterId);
        toast({
          title: "Image sync paused (time limit)",
          description: "Click “Continue image sync” to process the rest of the catalog.",
        });
      } else {
        toast({
          title: "Image sync stopped",
          description: "No further cursor — refresh stats or try again.",
        });
      }
      await loadStats();
    } catch (e) {
      toast({
        title: "Image sync failed",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      await loadStats();
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
                <Switch id="cf-debug" checked={cfDebugOn} onCheckedChange={(v) => setCfDebugBadge(!!v)} />
              </div>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Coverage</CardTitle>
                <CardDescription>
                  HTTPS product images vs mirrors ready in Supabase (per image slot). Row counts below are database mirror
                  rows.
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2 justify-end">
                <Button
                  variant="default"
                  size="sm"
                  className="gap-1.5"
                  onClick={() =>
                    void runSyncAllImages(
                      resumeAfterId ? { continueOnly: true } : { fromScratch: true },
                    )
                  }
                  disabled={syncLoading || statsLoading || stats?.configResolved === false}
                >
                  {syncLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Zap className="h-3.5 w-3.5" />
                  )}
                  {syncLoading ? "Syncing…" : resumeAfterId ? "Continue image sync" : "Sync all images to Cloudflare"}
                </Button>
                {resumeAfterId && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setResumeAfterId(null);
                      void runSyncAllImages({ fromScratch: true });
                    }}
                    disabled={syncLoading || statsLoading || stats?.configResolved === false}
                  >
                    Start over from beginning
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => void loadStats()}
                  disabled={statsLoading}
                >
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
                      <div className="text-muted-foreground text-xs">HTTPS image slots</div>
                      <div className="text-2xl font-semibold">{httpsSlots}</div>
                    </div>
                    <div className="rounded-lg border p-3">
                      <div className="text-muted-foreground text-xs">Slots mirrored (ready)</div>
                      <div className="text-2xl font-semibold text-emerald-600">{slotsReady}</div>
                    </div>
                    <div className="rounded-lg border p-3">
                      <div className="text-muted-foreground text-xs">Mirror rows pending</div>
                      <div className="text-2xl font-semibold text-amber-600">{pending}</div>
                    </div>
                    <div className="rounded-lg border p-3">
                      <div className="text-muted-foreground text-xs">Mirror rows failed</div>
                      <div className="text-2xl font-semibold text-destructive">{failed}</div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span>Coverage (ready slots / HTTPS slots)</span>
                      <span>{slotCoveragePct}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 transition-all"
                        style={{ width: `${Math.min(100, slotCoveragePct)}%` }}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Gallery entries (all): {galleryAll} — includes non-HTTPS URLs not mirrored to Cloudflare.
                  </p>
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
                      Last mirror activity: {formatDateTime(stats.lastMirrorActivityAt, i18n.language)}
                    </p>
                  )}
                  {!stats.configResolved && (
                    <div className="flex gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
                      <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                      <span>
                        Cloudflare API credentials are not configured or invalid — uploads won&apos;t run until fixed (see
                        admin Cloudflare Images).
                      </span>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Tracked mirror rows: {totalTracked} (ready {readyRows}, includes deleting state in total above).
                  </p>
                  {lastSyncSummary && (
                    <div className="rounded-md border bg-muted/30 p-3 text-xs space-y-1">
                      <div className="font-medium text-foreground">
                        {lastSyncSummary.completed ? "Last run: completed" : "Last run: partial or stopped"}
                      </div>
                      <p>
                        Rounds: {lastSyncSummary.rounds} | Touched products: {lastSyncSummary.totalTouched} | Scanned batch
                        rows: {lastSyncSummary.totalScanned} | Errors: {lastSyncSummary.totalErrors} | Time:{" "}
                        {(lastSyncSummary.elapsedMs / 1000).toFixed(1)}s
                      </p>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground border-t pt-3 mt-1">
                    <span className="font-medium text-foreground">Sync all images</span> walks every product in this store,
                    batches work server-side, uploads to Cloudflare, and writes public URLs into Supabase. Large catalogs may
                    need a second click (<span className="font-medium">Continue image sync</span>) after the server time
                    limit.
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
                          <TableCell className="font-medium max-w-[200px] truncate">{r.product_name || "—"}</TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                r.status === "ready" ? "default" : r.status === "failed" ? "destructive" : "secondary"
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
