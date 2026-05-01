import { useEffect, useState } from "react";
import type { GetServerSideProps } from "next";
import Link from "next/link";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { useTranslation } from "next-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SettingsLayout } from "@/components/layout/SettingsLayout";
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
        <Button type="button" variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
          {t("cloudflareImages.refreshStats", "Refresh")}
        </Button>
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
                  {t("cloudflareImages.repairQueueBody", "Pending + failed rows processed by /api/cron/mirror-product-images")}
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
                "Counts refresh automatically every 60s. Repair cron runs on Vercel (see vercel.json). Enable JSON mirror metrics in logs for detailed upload traces."
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
    updated_at: string | null;
  } | null;
  resolvedSource: "database" | "env" | null;
  resolvedActive: boolean;
  envFallbackAvailable: boolean;
};

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
    <SettingsLayout title="Cloudflare Images" requireSuperAdmin>
      <Inner />
    </SettingsLayout>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale ?? "en", ["common"])),
  },
});
