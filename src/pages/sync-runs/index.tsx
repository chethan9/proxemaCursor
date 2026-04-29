import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import type { GetServerSideProps } from "next";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatNumber } from "@/lib/format-number";
import {
  RefreshCw,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Package,
  ShoppingCart,
  Users,
  Layers,
  Ticket,
  Tag,
  Filter,
  Download,
  Loader2,
  Trash2,
  FilterX,
  Copy,
  PlayCircle,
  Shield,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/contexts/AuthProvider";
import { useQueryClient } from "@tanstack/react-query";
import { useSyncRunsPaged, useStoreOptions, useSyncRunsStats } from "@/hooks/queries/useSyncRuns";
import { ConnectionDiagnostic } from "@/components/project/ConnectionDiagnostic";

interface SyncRunRow {
  id: string;
  store_id: string;
  aspect: string;
  status: string;
  records_processed: number | null;
  records_created: number | null;
  records_updated: number | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  store_name?: string;
  attempt?: number | null;
  next_retry_at?: string | null;
  request_url?: string | null;
  request_method?: string | null;
  request_params?: unknown;
  response_status?: number | null;
  response_body?: string | null;
  response_headers?: unknown;
}

interface StoreOption {
  id: string;
  name: string;
}

const ASPECT_ICONS: Record<string, typeof Package> = {
  products: Package,
  orders: ShoppingCart,
  customers: Users,
  categories: Layers,
  coupons: Ticket,
  tags: Tag,
};

const ASPECT_COLORS: Record<string, string> = {
  products: "text-blue-500",
  orders: "text-green-500",
  customers: "text-purple-500",
  categories: "text-orange-500",
  coupons: "text-pink-500",
  tags: "text-cyan-500",
};

const BLOCKING_SERVICES = ["cloudflare", "sucuri", "wordfence", "aws-waf", "modsecurity", "unknown"] as const;
type BlockingServiceName = typeof BLOCKING_SERVICES[number];

function parseBlockingService(errorMessage: string | null | undefined): BlockingServiceName | null {
  if (!errorMessage) return null;
  const match = errorMessage.match(/\[blocked by ([a-z-]+):/i);
  if (!match) return null;
  const svc = match[1].toLowerCase();
  return (BLOCKING_SERVICES as readonly string[]).includes(svc) ? (svc as BlockingServiceName) : null;
}

const PAGE_SIZE = 50;

export default function SyncRunsPage() {
  const { t, i18n } = useTranslation("site");
  const { isSuperAdmin } = useAuth();
  const qc = useQueryClient();
  const [selectedRun, setSelectedRun] = useState<SyncRunRow | null>(null);
  const [diagnoseStoreId, setDiagnoseStoreId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [accumulated, setAccumulated] = useState<SyncRunRow[]>([]);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const [filterStore, setFilterStore] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterAspect, setFilterAspect] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  const { data: stores = [] } = useStoreOptions();
  const { data: stats = { total: 0, completed: 0, failed: 0, running: 0, totalRecords: 0 } } = useSyncRunsStats();

  const filters = useMemo(() => ({
    store: filterStore,
    status: filterStatus,
    aspect: filterAspect,
    search: searchQuery,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  }), [filterStore, filterStatus, filterAspect, searchQuery, dateFrom, dateTo]);

  const hasActiveRuns = stats.running > 0;

  const { data: pageData, isLoading: pageLoading, isFetching } = useSyncRunsPaged(
    currentPage,
    PAGE_SIZE,
    filters,
    stores,
    hasActiveRuns ? 5000 : false,
  );

  // Accumulate pages for infinite scroll
  useEffect(() => {
    if (!pageData) return;
    setAccumulated(prev => {
      if (currentPage === 0) return pageData.data;
      const existing = new Set(prev.map(r => r.id));
      const newOnes = pageData.data.filter(r => !existing.has(r.id));
      return [...prev, ...newOnes];
    });
  }, [pageData, currentPage]);

  // Reset to page 0 when filters change (accumulated is replaced by next page-0 fetch)
  useEffect(() => {
    setCurrentPage(0);
  }, [filterStore, filterStatus, filterAspect, searchQuery, dateFrom, dateTo]);

  const runs = accumulated;
  const totalCount = pageData?.count ?? 0;
  const hasMore = pageData ? pageData.data.length === PAGE_SIZE : false;
  const initialLoading = pageLoading && currentPage === 0 && accumulated.length === 0;
  const loadingMore = isFetching && currentPage > 0;

  const resetAndLoad = useCallback(() => {
    setCurrentPage(0);
    qc.invalidateQueries({ queryKey: ["sync-runs"] });
  }, [qc]);

  const loadStats = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["sync-runs-stats"] });
  }, [qc]);

  // Intersection observer
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore || loadingMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isFetching) {
          setCurrentPage(p => p + 1);
        }
      },
      { rootMargin: "300px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, isFetching]);

  const formatDuration = (start: string | null, end: string | null) => {
    if (!start || !end) return "—";
    const ms = new Date(end).getTime() - new Date(start).getTime();
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    return new Intl.DateTimeFormat(i18n.language?.startsWith("ar") ? "ar-u-nu-latn" : (i18n.language || "en"), {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(new Date(d));
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed": return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
      case "failed": return <XCircle className="h-4 w-4 text-red-500" />;
      case "running": return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
      default: return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "completed": return "success" as const;
      case "failed": return "error" as const;
      case "running": return "info" as const;
      default: return "pending" as const;
    }
  };

  const exportCsv = () => {
    const headers = ["Store", "Aspect", "Status", "Processed", "Created", "Updated", "Error", "Started", "Duration"];
    const rows = runs.map((r) => [
      r.store_name || "",
      r.aspect,
      r.status,
      r.records_processed ?? "",
      r.records_created ?? "",
      r.records_updated ?? "",
      r.error_message || "",
      r.started_at || "",
      formatDuration(r.started_at, r.completed_at),
    ]);
    const csv = [headers, ...rows].map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sync-runs-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const failedRuns = runs.filter((r) => r.status === "failed");

  const handleClearAll = async () => {
    const { error } = await supabase.from("sync_runs").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (!error) {
      resetAndLoad();
      loadStats();
    }
  };

  const handleClearFailed = async () => {
    const { error } = await supabase.from("sync_runs").delete().eq("status", "failed");
    if (!error) {
      resetAndLoad();
      loadStats();
    }
  };

  return (
    <AppLayout title={t("syncRuns.title")}>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">{t("syncRuns.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("syncRuns.subtitle")}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <Download className="h-4 w-4 me-2" />
              {t("syncRuns.exportCsv")}
            </Button>
            {stats.failed > 0 && isSuperAdmin && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                    <Trash2 className="h-4 w-4 me-2" />
                    {t("syncRuns.clearFailed")}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t("syncRuns.clearFailedTitle")}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t("syncRuns.clearFailedDesc", { count: stats.failed })}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t("syncRuns.cancel")}</AlertDialogCancel>
                    <AlertDialogAction onClick={handleClearFailed} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      {t("syncRuns.confirmClearFailed")}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            {isSuperAdmin && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                    <Trash2 className="h-4 w-4 me-2" />
                    {t("syncRuns.clearAll")}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t("syncRuns.clearAllTitle")}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t("syncRuns.clearAllDesc", { count: stats.total })}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t("syncRuns.cancel")}</AlertDialogCancel>
                    <AlertDialogAction onClick={handleClearAll} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      {t("syncRuns.confirmClearAll")}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <Button variant="outline" size="sm" onClick={() => { resetAndLoad(); loadStats(); }}>
              <RefreshCw className="h-4 w-4 me-2" />
              {t("syncRuns.refresh")}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                  <RefreshCw className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-semibold">{stats.total}</p>
                  <p className="text-xs text-muted-foreground">{t("syncRuns.stats.total")}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-2xl font-semibold">{stats.completed}</p>
                  <p className="text-xs text-muted-foreground">{t("syncRuns.stats.completed")}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                  <XCircle className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <p className="text-2xl font-semibold">{stats.failed}</p>
                  <p className="text-xs text-muted-foreground">{t("syncRuns.stats.failed")}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-semibold">{stats.running}</p>
                  <p className="text-xs text-muted-foreground">{t("syncRuns.stats.running")}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Package className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-semibold">{formatNumber(stats.totalRecords, i18n.language)}</p>
                  <p className="text-xs text-muted-foreground">{t("syncRuns.stats.records")}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {failedRuns.length > 0 && (
          <Card className="border-red-200 bg-red-50/30">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <CardTitle className="text-sm font-medium text-red-700">
                  {t("syncRuns.errorsHeading", { count: failedRuns.length })}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {failedRuns.slice(0, 3).map((run) => (
                  <button
                    key={run.id}
                    onClick={() => setSelectedRun(run)}
                    className="w-full text-left p-2 rounded-lg bg-white/60 hover:bg-white transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <XCircle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
                        <span className="text-sm font-medium">{run.store_name}</span>
                        <code className="text-xs bg-red-100 px-1.5 py-0.5 rounded text-red-700">{run.aspect}</code>
                      </div>
                      <span className="text-xs text-muted-foreground">{formatDate(run.started_at)}</span>
                    </div>
                    <p className="text-xs text-red-600 mt-1 truncate ps-5">{run.error_message || t("syncRuns.unknownError")}</p>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-3">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <div className="relative flex-1 min-w-[200px] max-w-xs">
                <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder={t("syncRuns.filters.search")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="ps-9"
                />
              </div>
              <Select value={filterStore} onValueChange={setFilterStore}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder={t("syncRuns.filters.allStores")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("syncRuns.filters.allStores")}</SelectItem>
                  {stores.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder={t("syncRuns.filters.allStatus")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("syncRuns.filters.allStatus")}</SelectItem>
                  <SelectItem value="completed">{t("syncRuns.status.completed")}</SelectItem>
                  <SelectItem value="failed">{t("syncRuns.status.failed")}</SelectItem>
                  <SelectItem value="running">{t("syncRuns.status.running")}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterAspect} onValueChange={setFilterAspect}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder={t("syncRuns.filters.allAspects")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("syncRuns.filters.allAspects")}</SelectItem>
                  <SelectItem value="products">{t("syncRuns.aspects.products")}</SelectItem>
                  <SelectItem value="orders">{t("syncRuns.aspects.orders")}</SelectItem>
                  <SelectItem value="customers">{t("syncRuns.aspects.customers")}</SelectItem>
                  <SelectItem value="categories">{t("syncRuns.aspects.categories")}</SelectItem>
                  <SelectItem value="tags">{t("syncRuns.aspects.tags")}</SelectItem>
                  <SelectItem value="coupons">{t("syncRuns.aspects.coupons")}</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-[150px]"
                placeholder={t("syncRuns.filters.from")}
              />
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-[150px]"
                placeholder="To"
              />
              {(filterStore !== "all" || filterStatus !== "all" || filterAspect !== "all" || searchQuery || dateFrom || dateTo) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => {
                    setFilterStore("all");
                    setFilterStatus("all");
                    setFilterAspect("all");
                    setSearchQuery("");
                    setDateFrom("");
                    setDateTo("");
                  }}
                >
                  <FilterX className="h-3.5 w-3.5" />
                  Clear
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            {initialLoading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : runs.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <RefreshCw className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No sync runs found</p>
                <p className="text-sm">Adjust your filters or trigger a sync from a site workspace</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Store</TableHead>
                    <TableHead>Aspect</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Processed</TableHead>
                    <TableHead className="text-right">Created</TableHead>
                    <TableHead className="text-right">Updated</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead>Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runs.map((run) => {
                    const AspectIcon = ASPECT_ICONS[run.aspect] || Package;
                    const aspectColor = ASPECT_COLORS[run.aspect] || "text-muted-foreground";
                    return (
                      <TableRow
                        key={run.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setSelectedRun(run)}
                      >
                        <TableCell className="font-medium text-sm">{run.store_name}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <AspectIcon className={`h-3.5 w-3.5 ${aspectColor}`} />
                            <span className="capitalize text-sm">{run.aspect}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <StatusBadge variant={getStatusVariant(run.status)}>{run.status}</StatusBadge>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">{run.records_processed ?? "—"}</TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {run.records_created != null ? <span className="text-emerald-600">+{run.records_created}</span> : "—"}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {run.records_updated != null ? <span className="text-blue-600">{run.records_updated}</span> : "—"}
                        </TableCell>
                        <TableCell className="font-mono text-sm text-muted-foreground">
                          {formatDuration(run.started_at, run.completed_at)}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">{formatDate(run.started_at)}</TableCell>
                        <TableCell className="max-w-[200px]">
                          {run.error_message ? (
                            (() => {
                              const blocking = parseBlockingService(run.error_message);
                              return (
                                <div className="flex items-center gap-1.5 min-w-0">
                                  {blocking && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setDiagnoseStoreId(run.store_id); }}
                                      className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-medium hover:bg-amber-200"
                                      title="Diagnose"
                                    >
                                      <Shield className="h-3 w-3" />
                                      {blocking === "aws-waf" ? "AWS WAF" : blocking.charAt(0).toUpperCase() + blocking.slice(1)}
                                    </button>
                                  )}
                                  <span className="text-xs text-red-600 truncate">{run.error_message}</span>
                                </div>
                              );
                            })()
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}

            <div ref={sentinelRef} className="py-1" />
            {loadingMore && (
              <div className="flex items-center justify-center py-4 border-t">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mr-2" />
                <span className="text-sm text-muted-foreground">Loading more runs...</span>
              </div>
            )}
            {!hasMore && runs.length > 0 && (
              <div className="text-center py-3 border-t">
                <span className="text-xs text-muted-foreground">All {formatNumber(totalCount, i18n.language)} runs loaded</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!selectedRun} onOpenChange={() => setSelectedRun(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedRun && getStatusIcon(selectedRun.status)}
              <span className="capitalize">{selectedRun?.aspect}</span> Sync Run
            </DialogTitle>
            <DialogDescription>
              {selectedRun?.store_name} — {formatDate(selectedRun?.started_at ?? null)}
            </DialogDescription>
          </DialogHeader>
          {selectedRun && (
            <div className="space-y-4 mt-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Status</p>
                  <StatusBadge variant={getStatusVariant(selectedRun.status)}>{selectedRun.status}</StatusBadge>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Duration</p>
                  <p className="text-sm font-mono font-medium">{formatDuration(selectedRun.started_at, selectedRun.completed_at)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Records Processed</p>
                  <p className="text-sm font-mono font-medium">{selectedRun.records_processed ?? 0}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Records Created</p>
                  <p className="text-sm font-mono font-medium text-emerald-600">+{selectedRun.records_created ?? 0}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Records Updated</p>
                  <p className="text-sm font-mono font-medium text-blue-600">{selectedRun.records_updated ?? 0}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Attempt</p>
                  <p className="text-sm font-mono font-medium">{selectedRun.attempt ?? 1} / 5</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Started At</p>
                  <p className="text-sm">{formatDate(selectedRun.started_at)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Completed At</p>
                  <p className="text-sm">{formatDate(selectedRun.completed_at)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Run ID</p>
                  <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{selectedRun.id.substring(0, 12)}</code>
                </div>
              </div>
              {selectedRun.error_message && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-red-500" />
                      <p className="text-sm font-medium text-red-700">Error Details</p>
                    </div>
                    {selectedRun.status === "failed" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          await supabase
                            .from("sync_runs")
                            .update({ status: "retrying", next_retry_at: new Date().toISOString(), error_message: null })
                            .eq("id", selectedRun.id);
                          setSelectedRun(null);
                          resetAndLoad();
                          loadStats();
                        }}
                      >
                        <PlayCircle className="h-3.5 w-3.5 mr-1.5" />
                        Retry now
                      </Button>
                    )}
                  </div>
                  <pre className="text-xs text-red-600 whitespace-pre-wrap font-mono bg-white/60 rounded p-3">
                    {selectedRun.error_message}
                  </pre>
                </div>
              )}
              {selectedRun.request_url && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">API Request</p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const curl = `curl -X ${selectedRun.request_method || "GET"} "${selectedRun.request_url}" -u "$WC_KEY:$WC_SECRET" -H "Accept: application/json"`;
                        navigator.clipboard.writeText(curl);
                      }}
                    >
                      <Copy className="h-3.5 w-3.5 mr-1.5" />
                      Copy as curl
                    </Button>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div>
                      <span className="text-muted-foreground">Method: </span>
                      <code className="bg-white px-1.5 py-0.5 rounded">{selectedRun.request_method || "GET"}</code>
                    </div>
                    <div>
                      <span className="text-muted-foreground">URL: </span>
                      <code className="bg-white px-1.5 py-0.5 rounded break-all">{selectedRun.request_url}</code>
                    </div>
                    {selectedRun.response_status != null && (
                      <div>
                        <span className="text-muted-foreground">Response: </span>
                        <code className="bg-white px-1.5 py-0.5 rounded">HTTP {selectedRun.response_status}</code>
                      </div>
                    )}
                    {selectedRun.response_body && (
                      <div>
                        <p className="text-muted-foreground mb-1">Response body:</p>
                        <pre className="text-xs bg-white rounded p-2 max-h-40 overflow-auto font-mono">{selectedRun.response_body}</pre>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!diagnoseStoreId} onOpenChange={(open) => !open && setDiagnoseStoreId(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("syncRuns.details.diagnostic", { defaultValue: "Connection Diagnostic" })}</DialogTitle>
            <DialogDescription>{t("syncRuns.details.description")}</DialogDescription>
          </DialogHeader>
          {diagnoseStoreId && (
            <ConnectionDiagnostic storeId={diagnoseStoreId} autoRun />
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale ?? "en", ["common", "site"])),
  },
});