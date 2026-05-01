import { useEffect, useMemo, useState } from "react";
import type { GetServerSideProps } from "next";
import Link from "next/link";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { useTranslation } from "next-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useStores } from "@/hooks/queries/useStores";
import type { StoreWithClient } from "@/services/storeService";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import type { MirrorDashboardStats } from "@/pages/api/admin/cloudflare-images-mirror-stats";
import {
  Loader2,
  Cloud,
  FlaskConical,
  RefreshCw,
  ImageIcon,
  Clock,
  AlertTriangle,
  Layers,
  Store,
  Trash2,
  Activity,
  Gauge,
  Zap,
  Workflow,
  ChevronsUpDown,
  Check,
} from "lucide-react";

async function authHeaders() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return { Authorization: `Bearer ${session?.access_token ?? ""}` };
}

function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  variant = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: typeof ImageIcon;
  variant?: "default" | "success" | "warn" | "danger" | "muted";
}) {
  const ring =
    variant === "success" ? "border-emerald-500/25 bg-emerald-500/5"
    : variant === "warn" ? "border-amber-500/25 bg-amber-500/5"
    : variant === "danger" ? "border-destructive/30 bg-destructive/5"
    : variant === "muted" ? "border-muted bg-muted/40"
    : "border-border bg-card";

  return (
    <div className={`rounded-xl border p-4 ${ring}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1 min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
          {hint ? <p className="text-xs text-muted-foreground leading-snug">{hint}</p> : null}
        </div>
        <Icon className="h-5 w-5 shrink-0 text-muted-foreground opacity-80" />
      </div>
    </div>
  );
}

function MirrorMonitoringSection() {
  const { t } = useTranslation("common");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const {
    data: stats,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey: ["admin-cloudflare-images-mirror-stats"],
    queryFn: async () => {
      const res = await fetch("/api/admin/cloudflare-images-mirror-stats", { headers: await authHeaders() });
      if (!res.ok) throw new Error("Failed to load mirror stats");
      return res.json() as Promise<MirrorDashboardStats>;
    },
    refetchInterval: 60_000,
  });

  const runPipelineMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/cloudflare-images-run-pipeline", {
        method: "POST",
        headers: { ...(await authHeaders()), "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) throw new Error(typeof body.error === "string" ? body.error : res.statusText || "Request failed");
      return body;
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ["admin-cloudflare-images-mirror-stats"] });
      const repair = data.repair as { attempted?: number; ok?: number; failed?: number } | undefined;
      const backfill = data.backfill as { touched?: number; skipped?: number; hasMore?: boolean } | undefined;
      const rA = repair?.attempted ?? 0;
      const rOk = repair?.ok ?? 0;
      const bTouch = backfill?.touched ?? 0;
      const more = backfill?.hasMore === true;
      toast({
        title: t("cloudflareImages.pipelineToastTitle", "Pipeline batch finished"),
        description: t("cloudflareImages.pipelineToastDesc", {
          defaultValue:
            "Repair: {{rA}} attempted, {{rOk}} OK. Backfill: {{bTouch}} products touched.{{moreHint}}",
          rA,
          rOk,
          bTouch,
          moreHint: more ? ` ${t("cloudflareImages.pipelineMoreHint", "More catalog batches remain (cursor saved).")}` : "",
        }),
      });
    },
    onError: (err: Error) => {
      toast({
        variant: "destructive",
        title: t("cloudflareImages.pipelineErrorTitle", "Pipeline run failed"),
        description: err.message,
      });
    },
  });

  const runRepairMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/cloudflare-images-run-repair", {
        method: "POST",
        headers: { ...(await authHeaders()), "Content-Type": "application/json" },
      });
      const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) throw new Error(typeof body.error === "string" ? body.error : res.statusText || "Request failed");
      return body;
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ["admin-cloudflare-images-mirror-stats"] });
      const attempted = typeof data.attempted === "number" ? data.attempted : 0;
      const okCount = typeof data.ok === "number" ? data.ok : 0;
      const failed = typeof data.failed === "number" ? data.failed : 0;
      toast({
        title: t("cloudflareImages.forceRepairToastTitle", "Repair batch finished"),
        description: t("cloudflareImages.forceRepairToastDesc", {
          defaultValue: "Processed {{attempted}} rows: {{okCount}} OK, {{failed}} failed.",
          attempted,
          okCount,
          failed,
        }),
      });
    },
    onError: (err: Error) => {
      toast({
        variant: "destructive",
        title: t("cloudflareImages.forceRepairErrorTitle", "Repair run failed"),
        description: err.message,
      });
    },
  });

  const nf = (n: number) => n.toLocaleString();

  return (
    <Card className="border-primary/15">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4 space-y-0 pb-2">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Activity className="h-5 w-5 text-primary" />
            {t("cloudflareImages.monitorTitle", "Mirror pipeline")}
          </CardTitle>
          <CardDescription>
            {t(
              "cloudflareImages.monitorSubtitle",
              "Live counts from product_image_mirrors: synced assets, backlog, failures, and per-store pending load."
            )}
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="default"
            size="sm"
            className="gap-1.5"
            onClick={() => runPipelineMutation.mutate()}
            disabled={runPipelineMutation.isPending || runRepairMutation.isPending || isFetching}
            title={t(
              "cloudflareImages.pipelineHint",
              "Runs repair + catalog backfill (same as the scheduled server cron). Does not require keeping a browser tab open."
            )}
          >
            {runPipelineMutation.isPending ?
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <Workflow className="h-3.5 w-3.5" />}
            {t("cloudflareImages.runPipeline", "Run full pipeline")}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="gap-1.5"
            onClick={() => runRepairMutation.mutate()}
            disabled={runRepairMutation.isPending || runPipelineMutation.isPending || isFetching}
            title={t(
              "cloudflareImages.forceRepairHint",
              "Runs one repair batch only (pending/failed rows). For catalog discovery use full pipeline or legacy backfill."
            )}
          >
            {runRepairMutation.isPending ?
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <Zap className="h-3.5 w-3.5" />}
            {t("cloudflareImages.forceRepair", "Run repair now")}
          </Button>
          <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
            {t("cloudflareImages.refreshStats", "Refresh")}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("cloudflareImages.loadingStats", "Loading statistics…")}
          </div>
        )}
        {error && (
          <Alert variant="destructive">
            <AlertTitle>{t("cloudflareImages.statsError", "Could not load mirror statistics")}</AlertTitle>
            <AlertDescription>{error instanceof Error ? error.message : ""}</AlertDescription>
          </Alert>
        )}
        {stats && (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <StatTile
                label={t("cloudflareImages.statReady", "In Cloudflare (ready)")}
                value={nf(stats.counts.ready)}
                hint={t("cloudflareImages.statReadyHint", "Rows uploaded & usable")}
                icon={ImageIcon}
                variant="success"
              />
              <StatTile
                label={t("cloudflareImages.statPending", "Pending sync")}
                value={nf(stats.counts.pending)}
                hint={t("cloudflareImages.statPendingHint", "Awaiting upload / repair")}
                icon={Clock}
                variant="warn"
              />
              <StatTile
                label={t("cloudflareImages.statFailed", "Failed")}
                value={nf(stats.counts.failed)}
                hint={t("cloudflareImages.statFailedHint", "Last error stored on row")}
                icon={AlertTriangle}
                variant="danger"
              />
              <StatTile
                label={t("cloudflareImages.statDeleting", "Deleting")}
                value={nf(stats.counts.deleting)}
                hint={t("cloudflareImages.statDeletingHint", "Cleanup in progress")}
                icon={Trash2}
                variant="muted"
              />
              <StatTile
                label={t("cloudflareImages.statDedup", "Unique CF images")}
                value={nf(stats.counts.distinct_cf_images)}
                hint={t("cloudflareImages.statDedupHint", "Distinct cf_image_id (deduped)")}
                icon={Layers}
              />
              <StatTile
                label={t("cloudflareImages.statTotalRows", "Total mirror rows")}
                value={nf(stats.counts.total_rows)}
                hint={t("cloudflareImages.statTotalRowsHint", "All statuses")}
                icon={Gauge}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border bg-muted/30 p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Clock className="h-4 w-4" />
                  {t("cloudflareImages.repairQueueTitle", "Repair cron backlog")}
                </div>
                <p className="text-sm text-muted-foreground">
                  {t("cloudflareImages.repairQueueBody", "Pending + failed rows processed by the mirror pipeline cron (repair half of each run).")}
                </p>
                <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
                  <span>
                    <strong className="tabular-nums">{nf(stats.counts.repair_queue)}</strong>{" "}
                    {t("cloudflareImages.inQueue", "in queue")}
                  </span>
                  <span className="text-muted-foreground">
                    ~{nf(stats.estimated_batches_remaining)} {t("cloudflareImages.batchesHint", "batches at")}{" "}
                    {nf(stats.repair_batch_size)} / {t("cloudflareImages.run", "run")}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground font-mono">{stats.repair_cron_schedule}</p>
              </div>

              <div className="rounded-xl border bg-muted/30 p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Layers className="h-4 w-4" />
                  {t("cloudflareImages.bySourceTitle", "Rows by trigger")}
                </div>
                <p className="text-sm text-muted-foreground">
                  {t("cloudflareImages.bySourceHint", "How mirror rows were created: Woo sync, product save, or repair cron.")}
                </p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(stats.by_source).length === 0 ?
                    <span className="text-sm text-muted-foreground">{t("cloudflareImages.noSourceData", "No data yet")}</span>
                  : Object.entries(stats.by_source).map(([k, v]) => (
                      <Badge key={k} variant="secondary" className="font-mono text-xs">
                        {k}: {nf(Number(v))}
                      </Badge>
                    ))
                  }
                </div>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-2">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  {t("cloudflareImages.recentFailures", "Recent failures")}
                </h3>
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[100px]">{t("cloudflareImages.colStore", "Store")}</TableHead>
                        <TableHead>{t("cloudflareImages.colError", "Error")}</TableHead>
                        <TableHead className="w-[90px]">{t("cloudflareImages.colSource", "Source")}</TableHead>
                        <TableHead className="w-[120px] text-right">{t("cloudflareImages.colUpdated", "Updated")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stats.recent_failures.length === 0 ?
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                            {t("cloudflareImages.noFailures", "No failed rows — looks healthy.")}
                          </TableCell>
                        </TableRow>
                      : stats.recent_failures.map((r) => (
                          <TableRow key={r.id}>
                            <TableCell className="align-top text-xs">
                              <div className="font-medium line-clamp-2">{r.store_name || "—"}</div>
                              {r.store_url ?
                                <a
                                  href={r.store_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[11px] text-primary underline-offset-2 hover:underline break-all"
                                >
                                  {r.store_url.replace(/^https?:\/\//, "").slice(0, 36)}
                                  {(r.store_url.length || 0) > 40 ? "…" : ""}
                                </a>
                              : null}
                              <Link
                                href={`/sites/${r.store_id}/products/edit/${r.product_id}`}
                                className="block mt-1 text-[11px] text-muted-foreground hover:text-foreground"
                              >
                                {t("cloudflareImages.openProduct", "Open product")}
                              </Link>
                            </TableCell>
                            <TableCell className="align-top text-xs max-w-[280px]">
                              <span className="line-clamp-4 break-words">{r.error || "—"}</span>
                            </TableCell>
                            <TableCell className="align-top">
                              <Badge variant="outline" className="text-[10px]">
                                {r.source_kind || "—"}
                              </Badge>
                            </TableCell>
                            <TableCell className="align-top text-xs text-right text-muted-foreground whitespace-nowrap">
                              {r.updated_at ?
                                new Date(r.updated_at).toLocaleString(undefined, {
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "—"}
                            </TableCell>
                          </TableRow>
                        ))
                      }
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Store className="h-4 w-4" />
                  {t("cloudflareImages.topPendingStores", "Most pending images by store")}
                </h3>
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("cloudflareImages.colStore", "Store")}</TableHead>
                        <TableHead className="text-right w-[100px]">{t("cloudflareImages.colPending", "Pending")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stats.top_pending_by_store.length === 0 ?
                        <TableRow>
                          <TableCell colSpan={2} className="text-center text-muted-foreground py-8">
                            {t("cloudflareImages.noPendingByStore", "No pending rows — backlog is clear.")}
                          </TableCell>
                        </TableRow>
                      : stats.top_pending_by_store.map((r) => (
                          <TableRow key={r.store_id}>
                            <TableCell className="text-sm">
                              <div className="font-medium">{r.store_name || "—"}</div>
                              {r.store_url ?
                                <span className="text-xs text-muted-foreground break-all line-clamp-1">{r.store_url}</span>
                              : null}
                              <Link
                                href={`/sites/${r.store_id}`}
                                className="text-xs text-primary hover:underline"
                              >
                                {t("cloudflareImages.openSite", "Site dashboard")}
                              </Link>
                            </TableCell>
                            <TableCell className="text-right tabular-nums font-semibold">{nf(r.pending_count)}</TableCell>
                          </TableRow>
                        ))
                      }
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              {t(
                "cloudflareImages.monitorFootnote",
                "Counts refresh automatically every 60s. Server cron /api/cron/mirror-product-images-pipeline runs repair + backfill every 10 minutes (see vercel.json). Configure Cloudflare variant thumb ~384px wide for catalog grid parity. Enable JSON mirror metrics in logs for detailed upload traces."
              )}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

type SettingsResponse = {
  row: {
    enabled: boolean;
    prefer_database_over_env: boolean;
    account_id: string | null;
    images_account_hash: string | null;
    api_token_configured: boolean;
    variant_thumb: string;
    variant_card: string;
    variant_edit: string;
    variant_zoom: string;
    mirror_metrics_enabled: boolean;
    repair_batch_size: number | null;
    mirror_backfill_after_product_id: string | null;
    updated_at: string | null;
  } | null;
  resolvedSource: "database" | "env" | null;
  resolvedActive: boolean;
  envFallbackAvailable: boolean;
};

function BackfillSection() {
  const { t } = useTranslation("common");
  const { toast } = useToast();
  const qc = useQueryClient();
  const [storeFilter, setStoreFilter] = useState("");
  const [storeComboOpen, setStoreComboOpen] = useState(false);
  const [batchSize, setBatchSize] = useState(25);
  const [afterCursor, setAfterCursor] = useState("");
  const [useStoredCursor, setUseStoredCursor] = useState(false);
  const [updateStoredCursor, setUpdateStoredCursor] = useState(false);
  const [lastJson, setLastJson] = useState<Record<string, unknown> | null>(null);

  const { data: stores = [], isLoading: storesLoading } = useStores();
  const selectedStore = useMemo(
    () => (stores as StoreWithClient[]).find((s) => s.id === storeFilter.trim()),
    [stores, storeFilter]
  );

  const { data: settings } = useQuery({
    queryKey: ["admin-cloudflare-images-settings"],
    queryFn: async () => {
      const res = await fetch("/api/admin/cloudflare-images-settings", { headers: await authHeaders() });
      if (!res.ok) throw new Error("Failed to load");
      return res.json() as Promise<SettingsResponse>;
    },
  });

  const backfillMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/cloudflare-images-backfill", {
        method: "POST",
        headers: { ...(await authHeaders()), "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId: storeFilter.trim() || null,
          productLimit: batchSize,
          afterId: afterCursor.trim() || null,
          useStoredCursor,
          updateStoredCursor,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) throw new Error(typeof body.error === "string" ? body.error : res.statusText || "Backfill failed");
      return body;
    },
    onSuccess: async (data) => {
      setLastJson(data);
      await qc.invalidateQueries({ queryKey: ["admin-cloudflare-images-settings"] });
      await qc.invalidateQueries({ queryKey: ["admin-cloudflare-images-mirror-stats"] });
      const touched = typeof data.touched === "number" ? data.touched : 0;
      const hasMore = data.hasMore === true;
      const next = typeof data.nextAfterId === "string" ? data.nextAfterId : "";
      if (hasMore && next) setAfterCursor(next);
      toast({
        title: t("cloudflareImages.backfillToastTitle", "Backfill batch finished"),
        description: t("cloudflareImages.backfillToastDesc", {
          defaultValue: "Touched {{touched}} products. {{moreHint}}",
          touched,
          moreHint: hasMore
            ? t("cloudflareImages.backfillMoreHint", "More batches remain — cursor updated below.")
            : t("cloudflareImages.backfillDoneHint", "Reached end of catalog window or nothing left to sync."),
        }),
      });
    },
    onError: (err: Error) => {
      toast({
        variant: "destructive",
        title: t("cloudflareImages.backfillErrorTitle", "Backfill failed"),
        description: err.message,
      });
    },
  });

  const resetCursorMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/cloudflare-images-settings", {
        method: "PUT",
        headers: { ...(await authHeaders()), "Content-Type": "application/json" },
        body: JSON.stringify({ mirror_backfill_after_product_id: null }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error || "Reset failed");
      }
    },
    onSuccess: async () => {
      setAfterCursor("");
      await qc.invalidateQueries({ queryKey: ["admin-cloudflare-images-settings"] });
      toast({
        title: t("cloudflareImages.cursorResetTitle", "Cursor cleared"),
        description: t("cloudflareImages.cursorResetDesc", "Scheduled backfill will start from the first products again."),
      });
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Error", description: err.message });
    },
  });

  const storedCursor = settings?.row?.mirror_backfill_after_product_id;

  return (
    <Card className="border-orange-500/15">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Layers className="h-5 w-5 text-orange-600 dark:text-orange-400" />
          {t("cloudflareImages.backfillTitle", "Legacy catalog backfill")}
        </CardTitle>
        <CardDescription>
          {t(
            "cloudflareImages.backfillSubtitle",
            "Products that existed before mirroring may have no mirror rows yet. This walks the catalog in batches (same pipeline as Woo sync) and uploads missing images. Repair cron still drains pending/failed rows — run both for large imports."
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert className="min-w-0">
          <AlertTitle>{t("cloudflareImages.optimizeTitle", "Speed & compression")}</AlertTitle>
          <AlertDescription className="text-sm break-words text-pretty min-w-0">
            <p>
              {t(
                "cloudflareImages.optimizeBody",
                "Uploads resize large masters server-side (max edge 2048px, JPEG/WebP). Set CF_MIRROR_MASTER_MAX_EDGE_PX or CF_MIRROR_SKIP_MASTER_OPTIMIZE on Vercel if needed. In Cloudflare Images, define variants to match the names below — typical widths: thumb 200px, card 600px, edit 1200px, zoom 1600px — so storefronts load small URLs."
              )}
            </p>
          </AlertDescription>
        </Alert>

        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:gap-4">
          <div className="min-w-0 flex-1 space-y-1.5">
            <Label htmlFor="bf-store-trigger">{t("cloudflareImages.backfillStoreId", "Store (optional)")}</Label>
            <p className="text-[11px] text-muted-foreground leading-snug">
              {t(
                "cloudflareImages.backfillStoreHint",
                "Shows the 10 newest sites first; search matches any store you can access."
              )}
            </p>
            <Popover open={storeComboOpen} onOpenChange={setStoreComboOpen} modal={false}>
              <PopoverTrigger asChild>
                <Button
                  id="bf-store-trigger"
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={storeComboOpen}
                  disabled={storesLoading}
                  className={cn(
                    "h-9 w-full min-w-0 justify-between font-normal shadow-sm",
                    selectedStore ? "font-medium text-foreground" : "text-muted-foreground"
                  )}
                >
                  <span className="truncate text-left">
                    {storesLoading ?
                      t("actions.loading")
                    : selectedStore ?
                      <>
                        <span className="font-medium">{selectedStore.name}</span>
                        <span className="text-muted-foreground font-mono text-[11px] ms-1">
                          {selectedStore.id.slice(0, 8)}…
                        </span>
                      </>
                    : storeFilter.trim() ?
                      <span className="font-mono text-xs truncate">{storeFilter.trim()}</span>
                    : t("cloudflareImages.backfillStorePlaceholder", "All stores")}
                  </span>
                  <ChevronsUpDown className="ms-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[min(100vw-2rem,var(--radix-popover-trigger-width))] max-w-[min(100vw-2rem,520px)] p-0" align="start">
                <Command shouldFilter>
                  <CommandInput placeholder={t("cloudflareImages.backfillStoreSearch", "Search name, URL, or store id…")} className="h-9" />
                  <CommandList className="max-h-[280px]">
                    <CommandEmpty>{t("cloudflareImages.noStoresMatch", "No stores match.")}</CommandEmpty>
                    <CommandGroup heading={t("cloudflareImages.backfillStoreGroupPick", "Choose store")}>
                      <CommandItem
                        value="__all stores catalog every"
                        onSelect={() => {
                          setStoreFilter("");
                          setStoreComboOpen(false);
                        }}
                      >
                        <Check className={cn("h-4 w-4 shrink-0", !storeFilter.trim() ? "opacity-100" : "opacity-0")} />
                        <span>{t("cloudflareImages.backfillStorePlaceholder", "All stores")}</span>
                      </CommandItem>
                      {(stores as StoreWithClient[]).map((s) => (
                        <CommandItem
                          key={s.id}
                          value={`${s.name} ${s.id} ${s.url || ""} ${s.client_name || ""}`}
                          onSelect={() => {
                            setStoreFilter(s.id);
                            setStoreComboOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "h-4 w-4 shrink-0",
                              storeFilter.trim() === s.id ? "opacity-100 text-primary" : "opacity-0"
                            )}
                          />
                          <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-start sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                            <span className="truncate font-medium">{s.name}</span>
                            <span className="truncate font-mono text-[10px] text-muted-foreground sm:max-w-[220px]">
                              {s.id}
                            </span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          <div className="w-full shrink-0 space-y-1.5 sm:w-32">
            <Label htmlFor="bf-batch">{t("cloudflareImages.backfillBatch", "Products per batch (1–80)")}</Label>
            <Input
              id="bf-batch"
              type="number"
              min={1}
              max={80}
              value={batchSize}
              onChange={(e) => setBatchSize(Number(e.target.value) || 25)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="bf-after">{t("cloudflareImages.backfillAfterId", "Continue after product id (optional)")}</Label>
          <Input
            id="bf-after"
            value={afterCursor}
            onChange={(e) => setAfterCursor(e.target.value)}
            placeholder="uuid"
            className="font-mono text-xs"
          />
          <p className="text-xs text-muted-foreground">
            {t("cloudflareImages.backfillAfterHint", "Leave empty to start from the beginning of the filtered list. After each batch with “more” left, the next cursor is filled automatically.")}
          </p>
        </div>

        <div className="rounded-lg border bg-muted/30 px-3 py-2 text-xs space-y-1">
          <div className="flex flex-wrap justify-between gap-2">
            <span className="text-muted-foreground">{t("cloudflareImages.storedCronCursor", "Stored cron cursor")}</span>
            <span className="font-mono break-all text-right">{storedCursor ?? "—"}</span>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <Switch id="bf-use-stored" checked={useStoredCursor} onCheckedChange={setUseStoredCursor} />
            <Label htmlFor="bf-use-stored" className="text-sm font-normal cursor-pointer">
              {t("cloudflareImages.backfillUseStoredCursor", "Start from stored cron cursor")}
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="bf-persist" checked={updateStoredCursor} onCheckedChange={setUpdateStoredCursor} />
            <Label htmlFor="bf-persist" className="text-sm font-normal cursor-pointer">
              {t("cloudflareImages.backfillPersistCursor", "Save cursor after run (for cron alignment)")}
            </Label>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            className="gap-1.5"
            onClick={() => backfillMutation.mutate()}
            disabled={backfillMutation.isPending}
          >
            {backfillMutation.isPending ?
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <ImageIcon className="h-3.5 w-3.5" />}
            {t("cloudflareImages.backfillRun", "Run backfill batch")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => resetCursorMutation.mutate()}
            disabled={resetCursorMutation.isPending}
          >
            {t("cloudflareImages.resetCronCursor", "Reset stored cursor")}
          </Button>
        </div>

        {lastJson ?
          <pre className="text-[11px] bg-muted/50 border rounded-md p-3 overflow-x-auto max-h-48 font-mono">
            {JSON.stringify(lastJson, null, 2)}
          </pre>
        : null}
      </CardContent>
    </Card>
  );
}

function Inner() {
  const { t } = useTranslation("common");
  const { toast } = useToast();
  const qc = useQueryClient();
  const [apiToken, setApiToken] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-cloudflare-images-settings"],
    queryFn: async () => {
      const res = await fetch("/api/admin/cloudflare-images-settings", { headers: await authHeaders() });
      if (!res.ok) throw new Error("Failed to load");
      return res.json() as Promise<SettingsResponse>;
    },
  });

  const [enabled, setEnabled] = useState(false);
  const [preferDb, setPreferDb] = useState(true);
  const [accountId, setAccountId] = useState("");
  const [accountHash, setAccountHash] = useState("");
  const [vThumb, setVThumb] = useState("thumb");
  const [vCard, setVCard] = useState("card");
  const [vEdit, setVEdit] = useState("edit");
  const [vZoom, setVZoom] = useState("zoom");
  const [metrics, setMetrics] = useState(false);
  const [repairBatch, setRepairBatch] = useState<number | "">("");

  useEffect(() => {
    const r = data?.row;
    if (!r) return;
    setEnabled(r.enabled);
    setPreferDb(r.prefer_database_over_env);
    setAccountId(r.account_id || "");
    setAccountHash(r.images_account_hash || "");
    setVThumb(r.variant_thumb || "thumb");
    setVCard(r.variant_card || "card");
    setVEdit(r.variant_edit || "edit");
    setVZoom(r.variant_zoom || "zoom");
    setMetrics(r.mirror_metrics_enabled);
    setRepairBatch(r.repair_batch_size ?? "");
  }, [data?.row]);

  const save = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/cloudflare-images-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({
          enabled,
          prefer_database_over_env: preferDb,
          account_id: accountId || null,
          images_account_hash: accountHash || null,
          api_token: apiToken.trim() || undefined,
          variant_thumb: vThumb,
          variant_card: vCard,
          variant_edit: vEdit,
          variant_zoom: vZoom,
          mirror_metrics_enabled: metrics,
          repair_batch_size: repairBatch === "" ? null : Number(repairBatch),
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error || "Save failed");
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-cloudflare-images-settings"] });
      qc.invalidateQueries({ queryKey: ["admin-cloudflare-images-mirror-stats"] });
      setApiToken("");
      toast({ title: t("cloudflareImages.saved", "Settings saved") });
    },
    onError: (e) =>
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "",
        variant: "destructive",
      }),
  });

  const testConn = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/cloudflare-images-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ action: "test" }),
      });
      const j = (await res.json()) as { ok?: boolean; error?: string; hint?: string };
      if (!res.ok) {
        const msg = [j.error, j.hint].filter(Boolean).join("\n\n");
        throw new Error(msg || "Test failed");
      }
      return j;
    },
    onSuccess: (j) => {
      toast({
        title: j.ok ? t("cloudflareImages.testOk", "Connection OK") : "Failed",
        variant: j.ok ? "default" : "destructive",
      });
    },
    onError: (e) =>
      toast({
        title: "Test failed",
        description: e instanceof Error ? e.message : "",
        variant: "destructive",
      }),
  });

  return (
    <div className="p-6 max-w-6xl space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <Cloud className="h-7 w-7 text-muted-foreground" />
          <h1 className="text-2xl font-semibold">{t("cloudflareImages.title", "Cloudflare Images")}</h1>
        </div>
        <p className="text-muted-foreground text-sm mt-1">
          {t(
            "cloudflareImages.subtitle",
            "Configure platform-wide product image mirroring. Credentials are encrypted in the database; environment variables are still supported as a fallback."
          )}
        </p>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      )}

      <MirrorMonitoringSection />

      <BackfillSection />

      {data && (
        <Alert>
          <AlertTitle>{t("cloudflareImages.statusTitle", "Runtime status")}</AlertTitle>
          <AlertDescription className="text-sm space-y-1">
            <div>
              {t("cloudflareImages.active", "Mirroring active")}:{" "}
              <strong>{data.resolvedActive ? t("common.yes", "Yes") : t("common.no", "No")}</strong>
              {data.resolvedSource ? ` (${data.resolvedSource})` : ""}
            </div>
            <div className="text-muted-foreground">
              {t("cloudflareImages.envFallback", "Environment fallback available")}:{" "}
              {data.envFallbackAvailable ? t("common.yes", "Yes") : t("common.no", "No")}
            </div>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("cloudflareImages.flags", "Feature flags")}</CardTitle>
          <CardDescription>
            {t("cloudflareImages.flagsHint", "Turn on only after API token and account details are set.")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="en">{t("cloudflareImages.enableIntegration", "Enable Cloudflare Images mirroring")}</Label>
            <Switch id="en" checked={enabled} onCheckedChange={setEnabled} />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="pdb">{t("cloudflareImages.preferDb", "Prefer database credentials over environment")}</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t("cloudflareImages.preferDbHint", "When off, Vercel/host env vars take priority if set.")}
              </p>
            </div>
            <Switch id="pdb" checked={preferDb} onCheckedChange={setPreferDb} />
          </div>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="met">{t("cloudflareImages.metrics", "Emit JSON mirror metrics to logs")}</Label>
            <Switch id="met" checked={metrics} onCheckedChange={setMetrics} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("cloudflareImages.credentials", "API credentials")}</CardTitle>
          <CardDescription>
            {t(
              "cloudflareImages.credentialsHint",
              "Account ID and Images delivery hash are non-secret. API token is stored encrypted (same key as payment credentials)."
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="aid">{t("cloudflareImages.accountId", "Cloudflare account ID")}</Label>
            <Input id="aid" value={accountId} onChange={(e) => setAccountId(e.target.value)} autoComplete="off" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="hash">{t("cloudflareImages.imagesHash", "Images account hash (imagedelivery.net)")}</Label>
            <Input id="hash" value={accountHash} onChange={(e) => setAccountHash(e.target.value)} autoComplete="off" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tok">
              {t("cloudflareImages.apiToken", "API token")}{" "}
              {data?.row?.api_token_configured ? (
                <span className="text-muted-foreground font-normal">({t("cloudflareImages.configured", "configured")})</span>
              ) : null}
            </Label>
            <Input
              id="tok"
              type="password"
              autoComplete="new-password"
              value={apiToken}
              onChange={(e) => setApiToken(e.target.value)}
              placeholder={t("cloudflareImages.tokenPlaceholder", "Leave blank to keep existing")}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("cloudflareImages.variants", "Variant names")}</CardTitle>
          <CardDescription>
            {t("cloudflareImages.variantsHint", "Must match variants defined in your Cloudflare Images dashboard.")}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="vt">thumb</Label>
            <Input id="vt" value={vThumb} onChange={(e) => setVThumb(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vc">card</Label>
            <Input id="vc" value={vCard} onChange={(e) => setVCard(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ve">edit</Label>
            <Input id="ve" value={vEdit} onChange={(e) => setVEdit(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vz">zoom</Label>
            <Input id="vz" value={vZoom} onChange={(e) => setVZoom(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("cloudflareImages.repair", "Repair cron")}</CardTitle>
          <CardDescription>{t("cloudflareImages.repairHint", "Max rows processed per repair cron run (10–500).")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-1.5 max-w-xs">
            <Label htmlFor="rb">{t("cloudflareImages.repairBatch", "Repair batch size")}</Label>
            <Input
              id="rb"
              type="number"
              min={10}
              max={500}
              value={repairBatch}
              onChange={(e) => setRepairBatch(e.target.value === "" ? "" : Number(e.target.value))}
            />
          </div>
        </CardContent>
      </Card>

      <Alert>
        <AlertTitle>{t("cloudflareImages.clientEnvTitle", "Storefront / catalog")}</AlertTitle>
        <AlertDescription>
          {t(
            "cloudflareImages.clientEnvBody",
            "Set NEXT_PUBLIC_CLOUDFLARE_PRODUCT_IMAGES=true on Vercel so the product grid and editor use mirrored URLs when available."
          )}
        </AlertDescription>
      </Alert>

      <div className="flex flex-wrap gap-3">
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          {t("cloudflareImages.save", "Save")}
        </Button>
        <Button type="button" variant="outline" onClick={() => testConn.mutate()} disabled={testConn.isPending}>
          {testConn.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FlaskConical className="h-4 w-4 mr-2" />}
          {t("cloudflareImages.test", "Test connection")}
        </Button>
      </div>
    </div>
  );
}

export default function AdminCloudflareImagesPage() {
  return (
    <AppLayout title="Cloudflare Images" requireSuperAdmin bypassBillingGate>
      <Inner />
    </AppLayout>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale ?? "en", ["common"])),
  },
});
