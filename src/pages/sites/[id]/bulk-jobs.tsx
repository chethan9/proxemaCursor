import { useState, useMemo } from "react";
import type { ComponentType } from "react";
import Link from "next/link";
import { useTranslation } from "next-i18next";
import { formatDateTime, formatNumber } from "@/lib/format-number";
import { SitePageShell, useSiteFromRoute, SiteLoadingSkeleton } from "@/components/site/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, CheckCircle2, XCircle, AlertCircle, Ban, Briefcase, Clock, Search, RefreshCw, RotateCcw, Download, BellOff } from "lucide-react";
import { useStoreBulkJobs } from "@/hooks/queries/useBulkJobs";
import { computeBulkJobSidebarBadgeCounts, useBulkJobNotificationDismiss } from "@/hooks/useBulkJobNotificationDismiss";
import { cancelBulkJob, retryFailedBulkJobItems, JOB_TYPE_LABEL, type BulkJob } from "@/services/bulkJobService";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const STATUS_META: Record<string, { icon: ComponentType<{ className?: string }>; cls: string; badge: string }> = {
  pending: { icon: Clock, cls: "text-muted-foreground", badge: "bg-muted text-muted-foreground" },
  running: { icon: Loader2, cls: "text-primary animate-spin", badge: "bg-primary/10 text-primary border-primary/20" },
  completed: { icon: CheckCircle2, cls: "text-emerald-600", badge: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  partial: { icon: AlertCircle, cls: "text-amber-600", badge: "bg-amber-50 text-amber-700 border-amber-200" },
  failed: { icon: XCircle, cls: "text-destructive", badge: "bg-destructive/10 text-destructive border-destructive/20" },
  cancelled: { icon: Ban, cls: "text-muted-foreground", badge: "bg-muted text-muted-foreground" },
};

function effectiveStatus(job: BulkJob): string {
  if (job.status === "completed" && (job.failed ?? 0) > 0) return "partial";
  return job.status;
}

function statusTranslationKey(job: BulkJob): string {
  const eff = effectiveStatus(job);
  if (eff === "cancelled") {
    const p = job.payload as Record<string, unknown> | null;
    if (p?.cancelled_by === "user") return "cancelledByUser";
  }
  return eff;
}

function BulkJobsInner() {
  const { id, store, loading } = useSiteFromRoute();
  const { t, i18n } = useTranslation("site");
  const { data: jobs = [], isLoading, isFetching } = useStoreBulkJobs(id, 200);
  const { dismiss: dismissBulkJobSidebarBadge, dismissedAt: bulkJobsDismissedAt } = useBulkJobNotificationDismiss(id);
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [selectedJob, setSelectedJob] = useState<BulkJob | null>(null);

  const stats = useMemo(() => ({
    total: jobs.length,
    running: jobs.filter((j) => j.status === "running" || j.status === "pending").length,
    completed: jobs.filter((j) => j.status === "completed").length,
    failed: jobs.filter((j) => j.status === "failed").length,
    totalProcessed: jobs.reduce((s, j) => s + (j.processed || 0), 0),
  }), [jobs]);

  const jobTypes = useMemo(() => {
    const set = new Set(jobs.map((j) => j.job_type));
    return Array.from(set);
  }, [jobs]);

  const sidebarBadgeCounts = useMemo(
    () => computeBulkJobSidebarBadgeCounts(jobs, bulkJobsDismissedAt),
    [jobs, bulkJobsDismissedAt],
  );

  const filteredJobs = useMemo(() => {
    return jobs.filter((j) => {
      if (statusFilter !== "all" && j.status !== statusFilter) return false;
      if (typeFilter !== "all" && j.job_type !== typeFilter) return false;
      if (search) {
        const label = JOB_TYPE_LABEL[j.job_type as keyof typeof JOB_TYPE_LABEL] || j.job_type;
        const hay = `${label} ${j.error_message || ""}`.toLowerCase();
        if (!hay.includes(search.toLowerCase())) return false;
      }
      return true;
    });
  }, [jobs, statusFilter, typeFilter, search]);

  const handleCancel = async (j: BulkJob) => {
    try {
      await cancelBulkJob(j.id);
      qc.invalidateQueries({ queryKey: ["bulk-jobs"] });
      qc.invalidateQueries({ queryKey: ["site-downloads", id] });
      toast({ title: t("bulkJobs.toasts.cancelled") });
    } catch (e) {
      toast({ title: t("bulkJobs.toasts.cancelFailed"), description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  };

  if (loading) return <SiteLoadingSkeleton />;
  if (!store) return <div className="p-6">Store not found</div>;

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    return formatDateTime(d, i18n.language, {
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
  };

  const formatDuration = (start: string | null, end: string | null) => {
    if (!start) return "—";
    const endTime = end ? new Date(end).getTime() : Date.now();
    const ms = endTime - new Date(start).getTime();
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  return (
    <div className="p-6 space-y-5 max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t("bulkJobs.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("bulkJobs.subtitle", { name: store.name })}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/sites/${id}/downloads`}>
              <Download className="h-4 w-4 mr-2" />
              {t("bulkJobs.viewDownloads")}
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => dismissBulkJobSidebarBadge()}
            disabled={sidebarBadgeCounts.recent === 0}
            title={t("bulkJobs.clearSidebarBadgeHint")}
          >
            <BellOff className="h-4 w-4 mr-2" />
            {t("bulkJobs.clearSidebarBadge")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => qc.invalidateQueries({ queryKey: ["bulk-jobs"] })}
            disabled={isFetching}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
            {t("bulkJobs.refresh")}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                <Briefcase className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-semibold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">{t("bulkJobs.stats.total")}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Loader2 className={`h-5 w-5 text-primary ${stats.running > 0 ? "animate-spin" : ""}`} />
              </div>
              <div>
                <p className="text-2xl font-semibold">{stats.running}</p>
                <p className="text-xs text-muted-foreground">{t("bulkJobs.stats.active")}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-semibold">{stats.completed}</p>
                <p className="text-xs text-muted-foreground">{t("bulkJobs.stats.completed")}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                <XCircle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-semibold">{stats.failed}</p>
                <p className="text-xs text-muted-foreground">{t("bulkJobs.stats.failed")}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-semibold">{formatNumber(stats.totalProcessed, i18n.language)}</p>
                <p className="text-xs text-muted-foreground">{t("bulkJobs.stats.processed")}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input placeholder={t("bulkJobs.search")} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("bulkJobs.filters.allStatus")}</SelectItem>
                <SelectItem value="pending">{t("bulkJobs.statuses.pending")}</SelectItem>
                <SelectItem value="running">{t("bulkJobs.statuses.running")}</SelectItem>
                <SelectItem value="completed">{t("bulkJobs.statuses.completed")}</SelectItem>
                <SelectItem value="failed">{t("bulkJobs.statuses.failed")}</SelectItem>
                <SelectItem value="cancelled">{t("bulkJobs.statuses.cancelled")}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("bulkJobs.filters.allTypes")}</SelectItem>
                {jobTypes.map((tt) => (
                  <SelectItem key={tt} value={tt}>
                    {JOB_TYPE_LABEL[tt as keyof typeof JOB_TYPE_LABEL] || tt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(search || statusFilter !== "all" || typeFilter !== "all") && (
              <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setStatusFilter("all"); setTypeFilter("all"); }}>
                {t("bulkJobs.filters.clear")}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t("bulkJobs.history")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("bulkJobs.columns.type")}</TableHead>
                <TableHead>{t("bulkJobs.columns.status")}</TableHead>
                <TableHead className="w-[240px]">{t("bulkJobs.columns.progress")}</TableHead>
                <TableHead className="text-right">{t("bulkJobs.columns.succeeded")}</TableHead>
                <TableHead className="text-right">{t("bulkJobs.columns.failed")}</TableHead>
                <TableHead>{t("bulkJobs.columns.duration")}</TableHead>
                <TableHead>{t("bulkJobs.columns.started")}</TableHead>
                <TableHead className="text-right">{t("bulkJobs.columns.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-12 text-sm text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />{t("bulkJobs.loading")}
                </TableCell></TableRow>
              ) : filteredJobs.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-12 text-sm text-muted-foreground">
                  <Briefcase className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  {jobs.length === 0 ? t("bulkJobs.empty.none") : t("bulkJobs.empty.noMatches")}
                </TableCell></TableRow>
              ) : (
                filteredJobs.map((j) => {
                  const eff = effectiveStatus(j);
                  const meta = STATUS_META[eff] ?? STATUS_META.pending;
                  const Icon = meta.icon;
                  const pct = j.total > 0 ? Math.round((j.processed / j.total) * 100) : 0;
                  const running = j.status === "running" || j.status === "pending";
                  return (
                    <TableRow key={j.id}>
                      <TableCell className="font-medium text-sm">
                        {JOB_TYPE_LABEL[j.job_type as keyof typeof JOB_TYPE_LABEL] || j.job_type}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Icon className={`h-3.5 w-3.5 ${meta.cls}`} />
                          <Badge variant="outline" className={`text-[10px] capitalize ${meta.badge}`}>{t(`bulkJobs.statuses.${statusTranslationKey(j)}`)}</Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                            <span className="min-w-0 truncate font-mono">{j.processed}/{j.total}</span>
                            <span className="shrink-0 whitespace-nowrap tabular-nums">{pct}%</span>
                          </div>
                          <Progress value={pct} className="h-1.5" />
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-emerald-600">{j.succeeded}</TableCell>
                      <TableCell className="text-right font-mono text-xs text-destructive">{j.failed}</TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono">
                        {formatDuration(j.started_at, j.completed_at)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatDate(j.started_at)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {j.error_message && (
                            <span title={j.error_message} className="text-[11px] text-destructive inline-flex items-center gap-1">
                              <AlertCircle className="h-3 w-3" /> {t("bulkJobs.row.error")}
                            </span>
                          )}
                          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setSelectedJob(j)}>
                            {t("bulkJobs.row.view")}
                          </Button>
                          {running && (
                            <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive hover:text-destructive" onClick={() => handleCancel(j)}>
                              {t("bulkJobs.row.cancel")}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <JobDetailsDialog job={selectedJob} onClose={() => setSelectedJob(null)} />
    </div>
  );
}

function JobDetailsDialog({ job, onClose }: { job: BulkJob | null; onClose: () => void }) {
  const { t, i18n } = useTranslation("site");
  const { toast } = useToast();
  const qc = useQueryClient();
  const [retrying, setRetrying] = useState(false);
  if (!job) return null;
  const eff = effectiveStatus(job);
  const meta = STATUS_META[eff] ?? STATUS_META.pending;
  const Icon = meta.icon;
  const pct = job.total > 0 ? Math.round((job.processed / job.total) * 100) : 0;
  const errors = Array.isArray(job.errors) ? (job.errors as Array<{ id: number | string; error: string }>) : [];
  const payload = job.payload as Record<string, unknown> | null;
  const isDeleteJob = job.job_type === "delete_products" || job.job_type === "delete_orders";
  const fmt = (d: string | null) => d ? formatDateTime(d, i18n.language) : "—";
  const dur = (() => {
    if (!job.started_at) return "—";
    const end = job.completed_at ? new Date(job.completed_at).getTime() : Date.now();
    const ms = end - new Date(job.started_at).getTime();
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  })();

  const handleRetry = async (force?: boolean) => {
    if (!job) return;
    setRetrying(true);
    try {
      const next = await retryFailedBulkJobItems(job.id, force !== undefined ? { force } : undefined);
      qc.invalidateQueries({ queryKey: ["bulk-jobs"] });
      toast({
        title: t("bulkJobs.toasts.retryQueued"),
        description: t("bulkJobs.toasts.retryQueuedDesc", { count: next.total }),
      });
      onClose();
    } catch (e) {
      toast({ title: t("bulkJobs.toasts.retryFailed"), description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setRetrying(false);
    }
  };

  return (
    <Dialog open={!!job} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className={`h-5 w-5 ${meta.cls}`} />
            {JOB_TYPE_LABEL[job.job_type as keyof typeof JOB_TYPE_LABEL] || job.job_type}
            <Badge variant="outline" className={`text-[10px] capitalize ${meta.badge}`}>{t(`bulkJobs.statuses.${statusTranslationKey(job)}`)}</Badge>
          </DialogTitle>
          <DialogDescription>{t("bulkJobs.details.jobId")} <code className="text-xs">{job.id}</code></DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-5 pb-2">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-lg border p-3">
                <p className="text-[10px] uppercase text-muted-foreground tracking-wide">{t("bulkJobs.details.total")}</p>
                <p className="text-lg font-semibold font-mono">{job.total}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-[10px] uppercase text-muted-foreground tracking-wide">{t("bulkJobs.details.processed")}</p>
                <p className="text-lg font-semibold font-mono">{job.processed}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-[10px] uppercase text-muted-foreground tracking-wide">{t("bulkJobs.details.succeeded")}</p>
                <p className="text-lg font-semibold font-mono text-emerald-600">{job.succeeded}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-[10px] uppercase text-muted-foreground tracking-wide">{t("bulkJobs.details.failed")}</p>
                <p className="text-lg font-semibold font-mono text-destructive">{job.failed}</p>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span className="min-w-0 truncate">{t("bulkJobs.details.progress")}</span>
                <span className="shrink-0 whitespace-nowrap font-mono tabular-nums">{pct}%</span>
              </div>
              <Progress value={pct} className="h-2" />
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-[10px] uppercase text-muted-foreground tracking-wide mb-1">{t("bulkJobs.details.created")}</p>
                <p>{fmt(job.created_at)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-muted-foreground tracking-wide mb-1">{t("bulkJobs.details.started")}</p>
                <p>{fmt(job.started_at)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-muted-foreground tracking-wide mb-1">{t("bulkJobs.details.completed")}</p>
                <p>{fmt(job.completed_at)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-muted-foreground tracking-wide mb-1">{t("bulkJobs.details.duration")}</p>
                <p className="font-mono">{dur}</p>
              </div>
            </div>

            {job.error_message && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                <p className="text-xs font-medium text-destructive mb-1 inline-flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5" /> {t("bulkJobs.details.jobError")}
                </p>
                <p className="text-sm text-destructive/90">{job.error_message}</p>
              </div>
            )}

            {payload && (
              <div>
                <p className="text-[10px] uppercase text-muted-foreground tracking-wide mb-1.5">{t("bulkJobs.details.payload")}</p>
                <pre className="rounded-lg border bg-muted/30 p-3 text-xs font-mono overflow-x-auto max-h-64">
{JSON.stringify(payload, null, 2)}
                </pre>
              </div>
            )}

            {errors.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[10px] uppercase text-muted-foreground tracking-wide">
                    {t("bulkJobs.details.perItemErrors", { count: errors.length })}
                  </p>
                  <div className="flex items-center gap-2">
                    {isDeleteJob ? (
                      <>
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={() => handleRetry(false)} disabled={retrying}>
                          <RotateCcw className={`h-3 w-3 ${retrying ? "animate-spin" : ""}`} />
                          {t("bulkJobs.details.retryTrash")}
                        </Button>
                        <Button size="sm" variant="destructive" className="h-7 text-xs gap-1.5" onClick={() => handleRetry(true)} disabled={retrying}>
                          <RotateCcw className={`h-3 w-3 ${retrying ? "animate-spin" : ""}`} />
                          {t("bulkJobs.details.retryForce")}
                        </Button>
                      </>
                    ) : (
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={() => handleRetry()} disabled={retrying}>
                        <RotateCcw className={`h-3 w-3 ${retrying ? "animate-spin" : ""}`} />
                        {t("bulkJobs.details.retryFailed")}
                      </Button>
                    )}
                  </div>
                </div>
                <div className="rounded-lg border divide-y max-h-72 overflow-y-auto">
                  {errors.map((e, i) => (
                    <div key={i} className="px-3 py-2 text-xs">
                      <span className="font-mono text-muted-foreground mr-2">#{e.id}</span>
                      <span className="text-destructive">{e.error}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

export default function BulkJobsPage() {
  return (
    <SitePageShell>
      <BulkJobsInner />
    </SitePageShell>
  );
}