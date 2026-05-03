import { useEffect, useState } from "react";
import { useTranslation } from "next-i18next";
import { SitePageShell, useSiteFromRoute, SiteLoadingSkeleton } from "@/components/site/shared";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, BarChart3, ExternalLink, Download } from "lucide-react";
import type { StandardReportPublicRow } from "@/pages/api/stores/[storeId]/standard-reports";
import { resolveIcon, ICON_NAMES } from "@/lib/menu-registry";
import type { ReportsKpisResponse } from "@/lib/reports-kpis-types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

async function fetchStandardReports(storeId: string): Promise<StandardReportPublicRow[]> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  const res = await fetch(`/api/stores/${storeId}/standard-reports`, {
    headers: { Authorization: `Bearer ${token ?? ""}` },
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return (await res.json()) as StandardReportPublicRow[];
}

async function fetchReportsKpis(storeId: string): Promise<ReportsKpisResponse> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  const res = await fetch(`/api/stores/${storeId}/reports/kpis?days=30`, {
    headers: { Authorization: `Bearer ${token ?? ""}` },
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return (await res.json()) as ReportsKpisResponse;
}

async function fetchMetabaseEmbedUrl(storeId: string, reportId: string): Promise<{ embedUrl: string }> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  const res = await fetch(`/api/stores/${storeId}/standard-reports/${reportId}/embed`, {
    headers: { Authorization: `Bearer ${token ?? ""}` },
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return (await res.json()) as { embedUrl: string };
}

async function downloadReportCsv(storeId: string, reportId: string, title: string): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  const res = await fetch(`/api/stores/${storeId}/standard-reports/${reportId}/export-csv`, {
    headers: { Authorization: `Bearer ${token ?? ""}` },
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const safe =
    title
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-+|-+$/g, "") || "report";
  a.href = url;
  a.download = `${safe}.csv`;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function IconOrFallback({ name }: { name: string | null | undefined }) {
  const safe = name?.trim();
  const Icon = safe && ICON_NAMES.includes(safe) ? resolveIcon(safe) : BarChart3;
  return <Icon className="h-5 w-5 text-muted-foreground shrink-0" aria-hidden />;
}

function fmtMoney(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtInt(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

const GROUP_PRIORITY: Record<string, number> = {
  Overview: 0,
  Sales: 1,
  Orders: 2,
};

function compareGroups(a: string, b: string): number {
  const pa = GROUP_PRIORITY[a] ?? 50;
  const pb = GROUP_PRIORITY[b] ?? 50;
  if (pa !== pb) return pa - pb;
  if (a === "_default") return -1;
  if (b === "_default") return 1;
  return a.localeCompare(b);
}

function ReportsInner() {
  const { id, store, loading } = useSiteFromRoute();
  const { t } = useTranslation("common");
  const [rows, setRows] = useState<StandardReportPublicRow[]>([]);
  const [loadingReports, setLoadingReports] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [kpis, setKpis] = useState<ReportsKpisResponse | null>(null);
  const [loadingKpis, setLoadingKpis] = useState(true);
  const [kpiError, setKpiError] = useState<string | null>(null);

  const [embedDialogOpen, setEmbedDialogOpen] = useState(false);
  const [embedTarget, setEmbedTarget] = useState<StandardReportPublicRow | null>(null);
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [embedLoading, setEmbedLoading] = useState(false);
  const [embedError, setEmbedError] = useState<string | null>(null);

  const [csvWorkingId, setCsvWorkingId] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoadingReports(true);
    setError(null);
    void fetchStandardReports(id)
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load reports");
      })
      .finally(() => {
        if (!cancelled) setLoadingReports(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoadingKpis(true);
    setKpiError(null);
    void fetchReportsKpis(id)
      .then((data) => {
        if (!cancelled) setKpis(data);
      })
      .catch((e: unknown) => {
        if (!cancelled) setKpiError(e instanceof Error ? e.message : "Failed to load KPIs");
      })
      .finally(() => {
        if (!cancelled) setLoadingKpis(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function openMetabaseEmbed(report: StandardReportPublicRow) {
    if (!id) return;
    setEmbedTarget(report);
    setEmbedDialogOpen(true);
    setEmbedUrl(null);
    setEmbedError(null);
    setEmbedLoading(true);
    try {
      const { embedUrl: url } = await fetchMetabaseEmbedUrl(id, report.id);
      setEmbedUrl(url);
    } catch (e: unknown) {
      setEmbedError(e instanceof Error ? e.message : "Failed to load embedded report");
    } finally {
      setEmbedLoading(false);
    }
  }

  function closeEmbedDialog(open: boolean) {
    setEmbedDialogOpen(open);
    if (!open) {
      setEmbedTarget(null);
      setEmbedUrl(null);
      setEmbedError(null);
    }
  }

  async function onDownloadCsv(report: StandardReportPublicRow) {
    if (!id) return;
    setCsvWorkingId(report.id);
    try {
      await downloadReportCsv(id, report.id, report.title);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "CSV download failed");
    } finally {
      setCsvWorkingId(null);
    }
  }

  if (loading) return <SiteLoadingSkeleton />;
  if (!store) return <div className="p-6">{t("errors.storeNotFound", "Store not found")}</div>;

  const grouped = rows.reduce<Record<string, StandardReportPublicRow[]>>((acc, r) => {
    const key = r.report_group?.trim() || "_default";
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {});

  const groupKeys = Object.keys(grouped).sort(compareGroups);

  return (
    <div className="p-6 space-y-8 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <BarChart3 className="h-7 w-7" aria-hidden />
          {t("site.reports.title", "Reports")}
        </h1>
        <p className="text-muted-foreground text-sm mt-2 max-w-2xl">
          {t(
            "site.reports.intro",
            "Quick KPIs for this store, plus deep Metabase reports—open in-app or export CSV."
          )}
        </p>
      </div>

      <section aria-labelledby="reports-kpis-heading" className="space-y-3">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
          <h2 id="reports-kpis-heading" className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            {t("site.reports.kpisHeading", "Quick insights")}
          </h2>
          <p className="text-xs text-muted-foreground">
            {t("site.reports.kpisWindow", "Last {{days}} days · scoped to this store", { days: kpis?.windowDays ?? 30 })}
          </p>
        </div>
        {kpiError ? (
          <p className="text-sm text-destructive" role="alert">
            {kpiError}
          </p>
        ) : loadingKpis ? (
          <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader className="pb-2 pt-4">
                  <div className="h-3 bg-muted rounded w-2/3" />
                  <div className="h-6 bg-muted rounded w-full mt-2" />
                </CardHeader>
              </Card>
            ))}
          </div>
        ) : kpis ? (
          <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
            <Card>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardDescription className="text-xs">{t("site.reports.kpiGross", "Gross sales")}</CardDescription>
                <CardTitle className="text-lg tabular-nums">{fmtMoney(kpis.grossSales)}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardDescription className="text-xs">{t("site.reports.kpiDiscounts", "Discounts")}</CardDescription>
                <CardTitle className="text-lg tabular-nums">{fmtMoney(kpis.discounts)}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardDescription className="text-xs">{t("site.reports.kpiNet", "Net sales")}</CardDescription>
                <CardTitle className="text-lg tabular-nums">{fmtMoney(kpis.netSales)}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardDescription className="text-xs">{t("site.reports.kpiOrders", "Orders")}</CardDescription>
                <CardTitle className="text-lg tabular-nums">{fmtInt(kpis.ordersCount)}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardDescription className="text-xs">{t("site.reports.kpiAov", "AOV")}</CardDescription>
                <CardTitle className="text-lg tabular-nums">{fmtMoney(kpis.aov)}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardDescription className="text-xs">{t("site.reports.kpiRefunds", "Refund orders")}</CardDescription>
                <CardTitle className="text-lg tabular-nums">{fmtInt(kpis.refundsCount)}</CardTitle>
              </CardHeader>
            </Card>
          </div>
        ) : null}
      </section>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {loadingReports ? (
        <div className="flex items-center gap-2 text-muted-foreground py-12 justify-center">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          {t("common.loading", "Loading…")}
        </div>
      ) : rows.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("site.reports.emptyTitle", "No reports yet")}</CardTitle>
            <CardDescription>
              {t(
                "site.reports.emptyHint",
                "Your administrator can add standard reports from the admin console once Metabase dashboards are configured."
              )}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        groupKeys.map((gk) => (
          <section key={gk} className="space-y-3">
            {gk !== "_default" ? (
              <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">{gk}</h2>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2">
              {(grouped[gk] ?? [])
                .slice()
                .sort((a, b) => a.sort_order - b.sort_order)
                .map((r) => {
                  const showCsv =
                    r.provider === "metabase" &&
                    r.embed_resource_type === "question" &&
                    r.embed_resource_id !== null &&
                    r.embed_resource_id !== undefined;
                  return (
                    <Card key={r.id} className="flex flex-col">
                      <CardHeader className="pb-2">
                        <div className="flex items-start gap-3">
                          <IconOrFallback name={r.icon} />
                          <div className="min-w-0 flex-1">
                            <CardTitle className="text-lg leading-snug">{r.title}</CardTitle>
                            {r.description ? (
                              <CardDescription className="mt-1">{r.description}</CardDescription>
                            ) : null}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="mt-auto pt-0 flex flex-col gap-2 sm:flex-row">
                        {r.provider === "metabase" ? (
                          <>
                            <Button
                              type="button"
                              variant="secondary"
                              className="w-full gap-2 sm:flex-1"
                              onClick={() => void openMetabaseEmbed(r)}
                            >
                              {t("site.reports.openReport", "Open report")}
                              <BarChart3 className="h-4 w-4" aria-hidden />
                            </Button>
                            {showCsv ? (
                              <Button
                                type="button"
                                variant="outline"
                                className="w-full gap-2 sm:flex-1"
                                disabled={csvWorkingId === r.id}
                                onClick={() => void onDownloadCsv(r)}
                              >
                                {csvWorkingId === r.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden />
                                ) : (
                                  <Download className="h-4 w-4 shrink-0" aria-hidden />
                                )}
                                {t("site.reports.downloadCsv", "Download CSV")}
                              </Button>
                            ) : null}
                          </>
                        ) : (
                          <Button variant="secondary" className="w-full gap-2" asChild>
                            <a href={r.dashboard_url ?? "#"} target="_blank" rel="noopener noreferrer">
                              {t("site.reports.openReport", "Open report")}
                              <ExternalLink className="h-4 w-4" aria-hidden />
                            </a>
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
            </div>
          </section>
        ))
      )}

      <Dialog open={embedDialogOpen} onOpenChange={closeEmbedDialog}>
        <DialogContent className="max-w-[min(96vw,1100px)] w-full h-[min(90vh,800px)] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
            <DialogTitle>{embedTarget?.title ?? t("site.reports.embedTitle", "Report")}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 flex flex-col px-6 pb-6">
            {embedLoading ? (
              <div className="flex flex-1 items-center justify-center gap-2 text-muted-foreground py-16">
                <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
                {t("common.loading", "Loading…")}
              </div>
            ) : embedError ? (
              <p className="text-sm text-destructive py-8" role="alert">
                {embedError}
              </p>
            ) : embedUrl ? (
              <iframe
                title={embedTarget?.title ?? "Metabase"}
                src={embedUrl}
                className="w-full flex-1 min-h-[480px] rounded-md border bg-background"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads"
                referrerPolicy="strict-origin-when-cross-origin"
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function SiteReportsPage() {
  return (
    <SitePageShell>
      <ReportsInner />
    </SitePageShell>
  );
}
