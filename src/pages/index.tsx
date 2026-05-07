import { useMemo } from "react";
import dynamic from "next/dynamic";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge, getStatusVariant } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Store, RefreshCw, ArrowRight, Clock, TrendingUp, TrendingDown, Activity, Heart, AlertTriangle, Plus, Loader2 } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthProvider";
import { useStores } from "@/hooks/queries/useStores";
import { useSyncRuns } from "@/hooks/queries/useSyncRuns";
import { BrandLogo } from "@/components/BrandLogo";
import { useBranding } from "@/contexts/BrandingProvider";
import { useTranslation } from "next-i18next";
import { formatDate, formatNumber, formatTime } from "@/lib/format-number";

const DashboardChartsSection = dynamic(
  () => import("@/components/dashboard/DashboardChartsSection").then((m) => m.DashboardChartsSection),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-3">
          <Card><CardContent className="h-[320px]" /></Card>
          <Card className="lg:col-span-2"><CardContent className="h-[320px]" /></Card>
        </div>
        <Card><CardContent className="h-[280px]" /></Card>
      </div>
    ),
  }
);

export default function Dashboard() {
  useAuth();
  const { data: stores = [], isPending: sPending, isFetching: sFetching } = useStores();
  const { data: syncRuns = [], isPending: rPending, isFetching: rFetching } = useSyncRuns(100);
  const { brandName } = useBranding();
  const { t, i18n } = useTranslation("common");

  const loading =
    sPending ||
    rPending ||
    (sFetching && stores.length === 0) ||
    (rFetching && syncRuns.length === 0);

  const stats = {
    stores: stores.length,
    connectedStores: stores.filter((s) => s.status === "connected").length,
    totalSyncs: syncRuns.length,
    successfulSyncs: syncRuns.filter((r) => r.status === "completed").length,
    failedSyncs: syncRuns.filter((r) => r.status === "failed").length,
    runningSyncs: syncRuns.filter((r) => r.status === "running").length,
    totalRecords: syncRuns.reduce((sum, r) => sum + (r.records_processed || 0), 0),
  };

  const successRate = stats.totalSyncs > 0
    ? Math.round((stats.successfulSyncs / stats.totalSyncs) * 100)
    : 0;

  const healthyStores = stores.filter(s => (s.health_score ?? 0) >= 80);
  const attentionStores = stores.filter(s => s.health_score != null && s.health_score < 80)
    .sort((a, b) => (a.health_score ?? 0) - (b.health_score ?? 0));
  const avgHealth = stores.length > 0 && stores.some(s => s.health_score != null)
    ? Math.round(stores.filter(s => s.health_score != null).reduce((sum, s) => sum + (s.health_score ?? 0), 0) / stores.filter(s => s.health_score != null).length)
    : null;

  const hasSites = stores.length > 0;
  const hasSyncs = syncRuns.length > 0;

  const syncStatusData = useMemo(
    () =>
      [
        { name: t("platformDashboard.syncStatusSuccessful"), value: stats.successfulSyncs, color: "#10b981" },
        { name: t("platformDashboard.syncStatusFailed"), value: stats.failedSyncs, color: "#ef4444" },
        { name: t("platformDashboard.syncStatusRunning"), value: stats.runningSyncs, color: "#3b82f6" },
      ].filter((d) => d.value > 0),
    [t, stats.successfulSyncs, stats.failedSyncs, stats.runningSyncs],
  );

  if (loading) {
    return (
      <AppLayout title={t("platformDashboard.pageTitle")}>
        <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center p-6">
          <Loader2 className="h-8 w-8 animate-spin text-primary" aria-label={t("platformDashboard.pageTitle")} />
        </div>
      </AppLayout>
    );
  }

  // ---------- EMPTY STATE: no sites ----------
  if (!hasSites) {
    return (
      <AppLayout title={t("platformDashboard.pageTitle")}>
        <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-6">
          <div className="max-w-lg text-center space-y-6">
            <BrandLogo size="xl" className="mx-auto" />
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight">{t("platformDashboard.emptyWelcomeTitle", { brand: brandName })}</h1>
              <p className="text-base text-muted-foreground">
                {t("platformDashboard.emptyWelcomeBody")}
              </p>
            </div>
            <Button size="lg" asChild>
              <Link href="/projects">
                <Plus className="h-4 w-4 me-2" />
                {t("platformDashboard.emptyAddSite")}
              </Link>
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  const syncsByAspect = syncRuns.reduce((acc, run) => {
    const aspect = run.aspect || "unknown";
    if (!acc[aspect]) acc[aspect] = { aspect, successful: 0, failed: 0 };
    if (run.status === "completed") acc[aspect].successful++;
    else if (run.status === "failed") acc[aspect].failed++;
    return acc;
  }, {} as Record<string, { aspect: string; successful: number; failed: number }>);
  const aspectChartData = Object.values(syncsByAspect);

  const syncsByDay = syncRuns.reduce((acc, run) => {
    const date = formatDate(run.started_at || "", i18n.language, { month: "short", day: "numeric" });
    if (!acc[date]) acc[date] = { date, successful: 0, failed: 0 };
    if (run.status === "completed") acc[date].successful++;
    else if (run.status === "failed") acc[date].failed++;
    return acc;
  }, {} as Record<string, { date: string; successful: number; failed: number }>);
  const timelineData = Object.values(syncsByDay).slice(0, 7).reverse();

  return (
    <AppLayout title={t("platformDashboard.pageTitle")}>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{t("platformDashboard.pageTitle")}</h1>
          <p className="text-muted-foreground">
            {hasSyncs ? t("platformDashboard.headerSubtitleWithSyncs") : t("platformDashboard.headerSubtitleNoSyncs")}
          </p>
        </div>

        {/* KPI Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{t("platformDashboard.kpiActiveSites")}</CardTitle>
              <Store className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.connectedStores}
                <span className="text-sm font-normal text-muted-foreground">/{stats.stores}</span>
              </div>
              <p className="text-xs text-muted-foreground">{t("platformDashboard.kpiConnectedStores")}</p>
            </CardContent>
          </Card>

          {avgHealth !== null && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{t("platformDashboard.kpiFleetHealth")}</CardTitle>
                <Heart className={`h-4 w-4 ${avgHealth >= 80 ? "text-emerald-500 fill-emerald-500" : avgHealth >= 50 ? "text-amber-500 fill-amber-500" : "text-red-500 fill-red-500"}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{avgHealth}%</div>
                <p className="text-xs text-muted-foreground">
                  {t("platformDashboard.kpiHealthyAttention", { healthy: healthyStores.length, attention: attentionStores.length })}
                </p>
              </CardContent>
            </Card>
          )}

          {hasSyncs && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{t("platformDashboard.kpiSuccessRate")}</CardTitle>
                {successRate >= 90 ? (
                  <TrendingUp className="h-4 w-4 text-success" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-destructive" />
                )}
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{successRate}%</div>
                <p className="text-xs text-muted-foreground">
                  {t("platformDashboard.kpiSyncsFraction", { successful: stats.successfulSyncs, total: stats.totalSyncs })}
                </p>
              </CardContent>
            </Card>
          )}

          {hasSyncs && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{t("platformDashboard.kpiRecordsSynced")}</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(stats.totalRecords, i18n.language)}</div>
                <p className="text-xs text-muted-foreground">{t("platformDashboard.kpiTotalRecordsProcessed")}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Attention */}
        {attentionStores.length > 0 && (
          <Card className="border-amber-200 bg-amber-50/30">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <CardTitle className="text-sm font-medium">{t("platformDashboard.attentionTitle")}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 md:grid-cols-2">
                {attentionStores.slice(0, 6).map(store => (
                  <Link key={store.id} href={`/sites/${store.id}/home`} className="flex items-center justify-between p-2 rounded-lg hover:bg-amber-100/50 transition-colors">
                    <div className="flex items-center gap-2 min-w-0">
                      <Store className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-sm font-medium truncate">{store.name}</span>
                    </div>
                    <span className={`text-sm font-bold flex-shrink-0 ${(store.health_score ?? 0) < 50 ? "text-red-600" : "text-amber-600"}`}>
                      {store.health_score}%
                    </span>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* PARTIAL STATE: sites but no syncs */}
        {!loading && hasSites && !hasSyncs && (
          <Card>
            <CardContent className="py-12 text-center">
              <RefreshCw className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-40" />
              <h3 className="text-lg font-medium mb-1">{t("platformDashboard.noSyncYetTitle")}</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                {t("platformDashboard.noSyncYetBody")}
              </p>
            </CardContent>
          </Card>
        )}

        {/* FULL STATE: charts + tables */}
        {hasSyncs && (
          <>
            <DashboardChartsSection
              syncStatusData={syncStatusData}
              successRate={successRate}
              aspectChartData={aspectChartData}
              timelineData={timelineData}
            />

            {/* Recent */}
            <div className="grid gap-6 lg:grid-cols-2">
              {stores.length > 0 && (
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle>{t("platformDashboard.recentSitesTitle")}</CardTitle>
                      <CardDescription>{t("platformDashboard.recentSitesDesc")}</CardDescription>
                    </div>
                    <Button variant="ghost" size="sm" asChild>
                      <Link href="/projects">
                        {t("platformDashboard.viewAll")} <ArrowRight className="ms-1 h-4 w-4" />
                      </Link>
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {stores.slice(0, 5).map((store) => (
                        <Link
                          key={store.id}
                          href={`/sites/${store.id}/home`}
                          className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="font-medium truncate">{store.name}</p>
                            <p className="text-sm text-muted-foreground truncate">{store.url}</p>
                          </div>
                          <StatusBadge
                            variant={getStatusVariant(store.status || "pending")}
                            pulse={store.status === "syncing"}
                          >
                            {store.status}
                          </StatusBadge>
                        </Link>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {syncRuns.length > 0 && (
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle>{t("platformDashboard.recentSyncRunsTitle")}</CardTitle>
                      <CardDescription>{t("platformDashboard.recentSyncRunsDesc")}</CardDescription>
                    </div>
                    <Button variant="ghost" size="sm" asChild>
                      <Link href="/sync-runs">
                        {t("platformDashboard.viewAll")} <ArrowRight className="ms-1 h-4 w-4" />
                      </Link>
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {syncRuns.slice(0, 5).map((run) => (
                        <div
                          key={run.id}
                          className="flex items-center justify-between p-3 rounded-lg border"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="font-medium truncate">{run.store_name}</p>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <span className="capitalize">{run.aspect}</span>
                              <span>•</span>
                              <Clock className="h-3 w-3" />
                              <span>{formatTime(run.started_at || "", i18n.language)}</span>
                            </div>
                          </div>
                          <StatusBadge
                            variant={getStatusVariant(run.status || "running")}
                            pulse={run.status === "running"}
                          >
                            {run.status}
                          </StatusBadge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}