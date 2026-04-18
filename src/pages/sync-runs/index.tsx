import { useEffect, useState, useCallback, useRef } from "react";
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

const PAGE_SIZE = 50;

export default function SyncRunsPage() {
  const [runs, setRuns] = useState<SyncRunRow[]>([]);
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [selectedRun, setSelectedRun] = useState<SyncRunRow | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const pageRef = useRef(0);
  const loadingRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const [filterStore, setFilterStore] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterAspect, setFilterAspect] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const [stats, setStats] = useState({
    total: 0,
    completed: 0,
    failed: 0,
    running: 0,
    totalRecords: 0,
  });

  const loadStores = useCallback(async () => {
    const { data } = await supabase.from("stores").select("id, name").order("name");
    setStores(data || []);
  }, []);

  const loadStats = useCallback(async () => {
    const { data: allRuns } = await supabase
      .from("sync_runs")
      .select("status, records_processed");
    if (allRuns) {
      setStats({
        total: allRuns.length,
        completed: allRuns.filter((r) => r.status === "completed").length,
        failed: allRuns.filter((r) => r.status === "failed").length,
        running: allRuns.filter((r) => r.status === "running").length,
        totalRecords: allRuns.reduce((s, r) => s + (r.records_processed || 0), 0),
      });
    }
  }, []);

  const buildQuery = useCallback(() => {
    let query = supabase
      .from("sync_runs")
      .select("*", { count: "exact" })
      .order("started_at", { ascending: false });
    if (filterStore !== "all") query = query.eq("store_id", filterStore);
    if (filterStatus !== "all") query = query.eq("status", filterStatus);
    if (filterAspect !== "all") query = query.eq("aspect", filterAspect);
    if (searchQuery) query = query.ilike("error_message", `%${searchQuery}%`);
    return query;
  }, [filterStore, filterStatus, filterAspect, searchQuery]);

  const loadPage = useCallback(async (page: number, append: boolean) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    if (page === 0) setInitialLoading(true);
    else setLoadingMore(true);

    try {
      const query = buildQuery().range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      const { data, count, error } = await query;
      if (error) throw error;

      const storeMap = new Map(stores.map((s) => [s.id, s.name]));
      const enriched = (data || []).map((r) => ({
        ...r,
        store_name: storeMap.get(r.store_id) || r.store_id.substring(0, 8),
      }));

      setRuns(prev => append ? [...prev, ...enriched] : enriched);
      setHasMore((data || []).length === PAGE_SIZE);
      setTotalCount(count || 0);
      pageRef.current = page;
    } catch (err) {
      console.error("Error loading sync runs:", err);
    } finally {
      setInitialLoading(false);
      setLoadingMore(false);
      loadingRef.current = false;
    }
  }, [buildQuery, stores]);

  const resetAndLoad = useCallback(() => {
    pageRef.current = 0;
    setRuns([]);
    setHasMore(true);
    loadPage(0, false);
  }, [loadPage]);

  useEffect(() => { loadStores(); loadStats(); }, [loadStores, loadStats]);
  useEffect(() => { if (stores.length > 0) resetAndLoad(); }, [stores, resetAndLoad]);

  // Intersection observer
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loadingRef.current && hasMore) {
          loadPage(pageRef.current + 1, true);
        }
      },
      { rootMargin: "300px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadPage]);

  const formatDuration = (start: string | null, end: string | null) => {
    if (!start || !end) return "—";
    const ms = new Date(end).getTime() - new Date(start).getTime();
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    return new Date(d).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
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
      setRuns([]);
      setStats({ total: 0, completed: 0, failed: 0, running: 0, totalRecords: 0 });
      setTotalCount(0);
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
    <AppLayout title="Sync Runs">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Sync Runs</h1>
            <p className="text-sm text-muted-foreground">
              Complete history of all sync operations across all sites
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
            {stats.failed > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Clear Failed
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Clear failed sync runs?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete all {stats.failed} failed sync run records across all sites.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleClearFailed} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Clear Failed Runs
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear All
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear all sync runs?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete all {stats.total} sync run records across all sites. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleClearAll} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Delete All Runs
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button variant="outline" size="sm" onClick={() => { resetAndLoad(); loadStats(); }}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
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
                  <p className="text-xs text-muted-foreground">Total Runs</p>
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
                  <p className="text-xs text-muted-foreground">Completed</p>
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
                  <p className="text-xs text-muted-foreground">Failed</p>
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
                  <p className="text-xs text-muted-foreground">Running</p>
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
                  <p className="text-2xl font-semibold">{stats.totalRecords.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Records Processed</p>
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
                  Recent Errors ({failedRuns.length} on this page)
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
                    <p className="text-xs text-red-600 mt-1 truncate pl-5">{run.error_message || "Unknown error"}</p>
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
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search error messages..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={filterStore} onValueChange={setFilterStore}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Stores" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Stores</SelectItem>
                  {stores.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="running">Running</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterAspect} onValueChange={setFilterAspect}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="All Aspects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Aspects</SelectItem>
                  <SelectItem value="products">Products</SelectItem>
                  <SelectItem value="orders">Orders</SelectItem>
                  <SelectItem value="customers">Customers</SelectItem>
                  <SelectItem value="categories">Categories</SelectItem>
                  <SelectItem value="tags">Tags</SelectItem>
                  <SelectItem value="coupons">Coupons</SelectItem>
                </SelectContent>
              </Select>
              {(filterStore !== "all" || filterStatus !== "all" || filterAspect !== "all" || searchQuery) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setFilterStore("all");
                    setFilterStatus("all");
                    setFilterAspect("all");
                    setSearchQuery("");
                  }}
                >
                  Clear filters
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
                            <span className="text-xs text-red-600 truncate block">{run.error_message}</span>
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
                <span className="text-xs text-muted-foreground">All {totalCount.toLocaleString()} runs loaded</span>
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
                  <div className="flex items-center gap-2 mb-2">
                    <XCircle className="h-4 w-4 text-red-500" />
                    <p className="text-sm font-medium text-red-700">Error Details</p>
                  </div>
                  <pre className="text-xs text-red-600 whitespace-pre-wrap font-mono bg-white/60 rounded p-3">
                    {selectedRun.error_message}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}