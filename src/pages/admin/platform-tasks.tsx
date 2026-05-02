import { useEffect, useMemo, useState } from "react";
import type { GetServerSideProps } from "next";
import { useRouter } from "next/router";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { useTranslation } from "next-i18next";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthProvider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, RefreshCw, Workflow, AlertTriangle, CheckCircle2, XCircle, Clock } from "lucide-react";
import type { PlatformTasksResponse, PlatformTaskStatusFilter } from "@/pages/api/admin/platform-tasks";
import { useStoreOptions } from "@/hooks/queries/useSyncRuns";

async function fetchPlatformTasks(status: PlatformTaskStatusFilter, storeId: string | null) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  const params = new URLSearchParams();
  params.set("status", status);
  if (storeId) params.set("storeId", storeId);
  const res = await fetch(`/api/admin/platform-tasks?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token ?? ""}` },
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return (await res.json()) as PlatformTasksResponse;
}

function formatDuration(start: string | null, end: string | null) {
  if (!start || !end) return "—";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function truncate(s: string | null | undefined, max = 72) {
  if (!s) return "—";
  return s.length <= max ? s : `${s.slice(0, max)}…`;
}

function SummaryStat({
  label,
  value,
  sub,
  variant = "default",
}: {
  label: string;
  value: number;
  sub?: string;
  variant?: "default" | "warn" | "danger";
}) {
  const ring =
    variant === "danger"
      ? "border-destructive/30 bg-destructive/5"
      : variant === "warn"
        ? "border-amber-500/25 bg-amber-500/5"
        : "border-border bg-card";
  return (
    <div className={`rounded-xl border p-4 ${ring}`}>
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      {sub ? <p className="text-xs text-muted-foreground mt-1">{sub}</p> : null}
    </div>
  );
}

function StatusGlyph({ status }: { status: string | null | undefined }) {
  const s = (status || "").toLowerCase();
  if (s === "running" || s === "retrying" || s === "started" || s === "pending") {
    return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" aria-hidden />;
  }
  if (s === "failed") return <XCircle className="h-4 w-4 text-red-500" aria-hidden />;
  if (s === "completed") return <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden />;
  return <Clock className="h-4 w-4 text-muted-foreground" aria-hidden />;
}

export default function AdminPlatformTasksPage() {
  const { t, i18n } = useTranslation("common");
  const router = useRouter();
  const { profile, isSuperAdmin } = useAuth();
  const [statusFilter, setStatusFilter] = useState<PlatformTaskStatusFilter>("all");
  const [storeFilter, setStoreFilter] = useState<string>("all");

  const { data: stores = [] } = useStoreOptions();

  useEffect(() => {
    if (profile && !isSuperAdmin) {
      void router.replace("/");
    }
  }, [profile, isSuperAdmin, router]);

  const storeIdParam = storeFilter === "all" ? null : storeFilter;

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["admin-platform-tasks", statusFilter, storeIdParam] as const,
    queryFn: () => fetchPlatformTasks(statusFilter, storeIdParam),
    enabled: !!profile && isSuperAdmin,
    staleTime: 5_000,
    refetchInterval: (query) => {
      const filter = query.queryKey[1] as PlatformTaskStatusFilter;
      const s = query.state.data?.summary;
      if (!s) return false;
      const active =
        s.syncRunsRunning > 0 ||
        s.cronInProgress > 0 ||
        s.bulkRunning > 0 ||
        filter === "running";
      return active ? 8_000 : 30_000;
    },
  });

  const hasRunning = useMemo(() => {
    if (!data?.summary) return false;
    return (
      data.summary.syncRunsRunning > 0 || data.summary.cronInProgress > 0 || data.summary.bulkRunning > 0
    );
  }, [data?.summary]);

  if (profile && !isSuperAdmin) {
    return (
      <AppLayout>
        <div className="p-6">
          <p className="text-muted-foreground">{t("accessDenied", "Access denied")}</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <Workflow className="h-6 w-6" />
              Platform tasks
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Read-only view of sync runs, scheduled cron activity, and bulk jobs across all stores.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as PlatformTaskStatusFilter)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="running">Running</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={storeFilter} onValueChange={setStoreFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Store" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All stores</SelectItem>
                {stores.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching}>
              {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              <span className="ml-2">Refresh</span>
            </Button>
          </div>
        </div>

        {hasRunning && (
          <div className="flex items-center gap-2 rounded-md border border-blue-500/20 bg-blue-500/5 px-3 py-2 text-sm">
            <RefreshCw className="h-4 w-4 text-blue-600 animate-spin shrink-0" />
            <span>Live refresh enabled while tasks are running.</span>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error instanceof Error ? error.message : String(error)}
          </div>
        )}

        {data?.summary && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <SummaryStat label="Sync runs (running)" value={data.summary.syncRunsRunning} />
            <SummaryStat label="Cron (in progress)" value={data.summary.cronInProgress} sub="status started" />
            <SummaryStat label="Bulk jobs (active)" value={data.summary.bulkRunning} sub="pending + running" />
            <SummaryStat
              label="Sync failed (24h)"
              value={data.summary.syncRunsFailed24h}
              variant={data.summary.syncRunsFailed24h > 0 ? "danger" : "default"}
            />
            <SummaryStat
              label="Cron failed (24h)"
              value={data.summary.cronFailed24h}
              variant={data.summary.cronFailed24h > 0 ? "danger" : "default"}
            />
            <SummaryStat
              label="Bulk failed (24h)"
              value={data.summary.bulkFailed24h}
              variant={data.summary.bulkFailed24h > 0 ? "danger" : "default"}
            />
          </div>
        )}

        {isLoading && !data ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Sync runs</CardTitle>
                <CardDescription>Woo sync pipeline executions per store and aspect.</CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10" />
                      <TableHead>Aspect</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Store</TableHead>
                      <TableHead>Started</TableHead>
                      <TableHead>Completed</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Records</TableHead>
                      <TableHead>Error</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!data?.syncRuns.length ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                          No rows for this filter.
                        </TableCell>
                      </TableRow>
                    ) : (
                      data.syncRuns.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell>
                            <StatusGlyph status={r.status} />
                          </TableCell>
                          <TableCell className="font-medium">{r.aspect}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">{r.status || "—"}</Badge>
                          </TableCell>
                          <TableCell className="max-w-[180px] truncate" title={r.store_name || r.store_id}>
                            {r.store_name || r.store_id.slice(0, 8)}
                          </TableCell>
                          <TableCell className="text-xs whitespace-nowrap">
                            {r.started_at
                              ? new Intl.DateTimeFormat(i18n.language || "en", {
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  second: "2-digit",
                                }).format(new Date(r.started_at))
                              : "—"}
                          </TableCell>
                          <TableCell className="text-xs whitespace-nowrap">
                            {r.completed_at
                              ? new Intl.DateTimeFormat(i18n.language || "en", {
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  second: "2-digit",
                                }).format(new Date(r.completed_at))
                              : "—"}
                          </TableCell>
                          <TableCell className="text-xs">{formatDuration(r.started_at, r.completed_at)}</TableCell>
                          <TableCell className="tabular-nums">{r.records_processed ?? "—"}</TableCell>
                          <TableCell className="max-w-[220px] text-xs text-destructive" title={r.error_message || ""}>
                            {truncate(r.error_message)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Cron jobs</CardTitle>
                <CardDescription>
                  Scheduler and background cron entries (`cron_logs`). In-progress rows use status{" "}
                  <code className="text-xs">started</code> without <code className="text-xs">completed_at</code>.
                </CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10" />
                      <TableHead>Job</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Store</TableHead>
                      <TableHead>Started</TableHead>
                      <TableHead>Completed</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Message / error</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!data?.cronLogs.length ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                          No rows for this filter.
                        </TableCell>
                      </TableRow>
                    ) : (
                      data.cronLogs.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell>
                            <StatusGlyph status={r.status} />
                          </TableCell>
                          <TableCell className="font-medium">{r.job_type}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">{r.status}</Badge>
                          </TableCell>
                          <TableCell className="max-w-[180px] truncate" title={r.store_name || r.store_id || ""}>
                            {r.store_name || r.store_id?.slice(0, 8) || "—"}
                          </TableCell>
                          <TableCell className="text-xs whitespace-nowrap">
                            {r.started_at
                              ? new Intl.DateTimeFormat(i18n.language || "en", {
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  second: "2-digit",
                                }).format(new Date(r.started_at))
                              : "—"}
                          </TableCell>
                          <TableCell className="text-xs whitespace-nowrap">
                            {r.completed_at
                              ? new Intl.DateTimeFormat(i18n.language || "en", {
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  second: "2-digit",
                                }).format(new Date(r.completed_at))
                              : "—"}
                          </TableCell>
                          <TableCell className="text-xs">{formatDuration(r.started_at, r.completed_at)}</TableCell>
                          <TableCell className="max-w-[280px] text-xs">
                            <span className="text-destructive">{truncate(r.error_message)}</span>
                            {r.message && r.message !== r.error_message ? (
                              <span className="block text-muted-foreground mt-0.5">{truncate(r.message, 96)}</span>
                            ) : null}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Bulk jobs</CardTitle>
                <CardDescription>Queued bulk operations per store.</CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10" />
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Store</TableHead>
                      <TableHead>Progress</TableHead>
                      <TableHead>Started</TableHead>
                      <TableHead>Completed</TableHead>
                      <TableHead>Error</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!data?.bulkJobs.length ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                          No rows for this filter.
                        </TableCell>
                      </TableRow>
                    ) : (
                      data.bulkJobs.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell>
                            <StatusGlyph status={r.status} />
                          </TableCell>
                          <TableCell className="font-medium">{r.job_type}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">{r.status}</Badge>
                          </TableCell>
                          <TableCell className="max-w-[180px] truncate" title={r.store_name || r.store_id}>
                            {r.store_name || r.store_id.slice(0, 8)}
                          </TableCell>
                          <TableCell className="tabular-nums text-sm">
                            {r.processed} / {r.total}
                          </TableCell>
                          <TableCell className="text-xs whitespace-nowrap">
                            {r.started_at
                              ? new Intl.DateTimeFormat(i18n.language || "en", {
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  second: "2-digit",
                                }).format(new Date(r.started_at))
                              : "—"}
                          </TableCell>
                          <TableCell className="text-xs whitespace-nowrap">
                            {r.completed_at
                              ? new Intl.DateTimeFormat(i18n.language || "en", {
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  second: "2-digit",
                                }).format(new Date(r.completed_at))
                              : "—"}
                          </TableCell>
                          <TableCell className="max-w-[220px] text-xs text-destructive" title={r.error_message || ""}>
                            {truncate(r.error_message)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppLayout>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale ?? "en", ["common"])),
  },
});
