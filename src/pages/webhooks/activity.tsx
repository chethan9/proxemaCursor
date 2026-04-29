import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/ui/status-badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Activity,
  Search,
  RefreshCw,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Filter,
  Download,
  Zap,
} from "lucide-react";
import { JsonTableView } from "@/components/JsonTableView";
import { useTranslation } from "next-i18next";
import { formatDateTime, formatNumber } from "@/lib/format-number";

interface WebhookEvent {
  id: string;
  store_id: string;
  topic: string;
  payload: unknown;
  processed: boolean | null;
  processed_at: string | null;
  created_at: string | null;
  processing_status: string | null;
  error_message: string | null;
}

interface StoreInfo {
  id: string;
  name: string;
}

const PAGE_SIZE = 50;

const statusConfig: Record<string, { variant: "success" | "error" | "warning" | "default" | "pending"; icon: typeof CheckCircle2 }> = {
  completed: { variant: "success", icon: CheckCircle2 },
  failed: { variant: "error", icon: XCircle },
  processing: { variant: "warning", icon: Loader2 },
  pending: { variant: "pending", icon: Clock },
};

function formatDate(d: string | null, locale?: string): string {
  if (!d) return "—";
  return formatDateTime(d, locale, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatAgo(d: string | null): string {
  if (!d) return "";
  const diff = Date.now() - new Date(d).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

function topicLabel(topic: string): { entity: string; action: string } {
  const parts = topic.split(".");
  return { entity: parts[0] || topic, action: parts[1] || "" };
}

export default function WebhookActivityLog() {
  const { i18n } = useTranslation();
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [stores, setStores] = useState<StoreInfo[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);
  const pageRef = useRef(0);
  const loadingRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const [filterStore, setFilterStore] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterTopic, setFilterTopic] = useState("all");
  const [search, setSearch] = useState("");

  const [selectedEvent, setSelectedEvent] = useState<WebhookEvent | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const [stats, setStats] = useState({ total: 0, completed: 0, failed: 0, pending: 0, processing: 0 });
  const [polling, setPolling] = useState(true);
  const [topics, setTopics] = useState<string[]>([]);

  const storeMap = new Map(stores.map(s => [s.id, s.name]));

  const loadStores = useCallback(async () => {
    const { data } = await supabase.from("stores").select("id, name").order("name");
    if (data) setStores(data);
  }, []);

  const loadStats = useCallback(async () => {
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from("webhook_events")
      .select("processing_status")
      .gte("created_at", dayAgo);
    if (data) {
      const s = { total: data.length, completed: 0, failed: 0, pending: 0, processing: 0 };
      for (const e of data) {
        const st = (e.processing_status || "pending") as keyof typeof s;
        if (st in s) s[st]++;
      }
      setStats(s);
    }
  }, []);

  const loadTopics = useCallback(async () => {
    const { data } = await supabase.from("webhook_events").select("topic");
    if (data) {
      setTopics(Array.from(new Set(data.map(e => e.topic))).sort());
    }
  }, []);

  const buildQuery = useCallback(() => {
    let query = supabase
      .from("webhook_events")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });
    if (filterStore !== "all") query = query.eq("store_id", filterStore);
    if (filterStatus !== "all") query = query.eq("processing_status", filterStatus);
    if (filterTopic !== "all") query = query.eq("topic", filterTopic);
    if (search.trim()) query = query.or(`topic.ilike.%${search.trim()}%,error_message.ilike.%${search.trim()}%`);
    return query;
  }, [filterStore, filterStatus, filterTopic, search]);

  const loadPage = useCallback(async (page: number, append: boolean) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    if (page === 0) setInitialLoading(true);
    else setLoadingMore(true);

    try {
      const query = buildQuery().range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      const { data, count } = await query;
      if (data) {
        setEvents(prev => append ? [...prev, ...data] : data);
        setHasMore(data.length === PAGE_SIZE);
        pageRef.current = page;
      }
      if (count !== null) setTotal(count);
    } finally {
      setInitialLoading(false);
      setLoadingMore(false);
      loadingRef.current = false;
    }
  }, [buildQuery]);

  const resetAndLoad = useCallback(() => {
    pageRef.current = 0;
    setEvents([]);
    setHasMore(true);
    loadPage(0, false);
  }, [loadPage]);

  useEffect(() => { loadStores(); loadTopics(); }, [loadStores, loadTopics]);
  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { resetAndLoad(); }, [resetAndLoad]);

  useEffect(() => {
    if (!polling) return;
    const interval = setInterval(() => { loadStats(); }, 5000);
    return () => clearInterval(interval);
  }, [polling, loadStats]);

  // Intersection observer for infinite scroll
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

  const handleExportCSV = () => {
    const headers = ["Timestamp", "Store", "Topic", "Status", "Processed At", "Error"];
    const rows = events.map(e => [
      e.created_at || "",
      storeMap.get(e.store_id) || e.store_id,
      e.topic,
      e.processing_status || "pending",
      e.processed_at || "",
      e.error_message || "",
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `webhook-activity-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const openDetail = (e: WebhookEvent) => {
    setSelectedEvent(e);
    setDetailOpen(true);
  };

  return (
    <AppLayout title="Activity Log">
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Activity className="h-6 w-6 text-primary" />
              Webhook Activity Log
            </h1>
            <p className="text-muted-foreground mt-1">Track incoming webhook events and their processing status</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={polling ? "default" : "outline"}
              size="sm"
              onClick={() => setPolling(!polling)}
              className="gap-1.5"
            >
              <Zap className={`h-3.5 w-3.5 ${polling ? "animate-pulse" : ""}`} />
              {polling ? "Live" : "Paused"}
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-1.5">
              <Download className="h-3.5 w-3.5" />
              Export
            </Button>
          </div>
        </div>

        <div className="grid gap-4 grid-cols-2 md:grid-cols-5">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-medium">24h Events</span>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-2xl font-bold mt-1">{formatNumber(stats.total, i18n.language)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-medium">Completed</span>
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              </div>
              <p className="text-2xl font-bold text-emerald-600 mt-1">{stats.completed}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-medium">Failed</span>
                <XCircle className="h-4 w-4 text-red-500" />
              </div>
              <p className="text-2xl font-bold text-red-600 mt-1">{stats.failed}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-medium">Processing</span>
                <Loader2 className="h-4 w-4 text-amber-500" />
              </div>
              <p className="text-2xl font-bold text-amber-600 mt-1">{stats.processing}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-medium">Pending</span>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-2xl font-bold mt-1">{stats.pending}</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base">Event Stream</CardTitle>
                <span className="text-xs text-muted-foreground">({formatNumber(total, i18n.language)} events)</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search topic or error..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="pl-8 h-9 w-56 text-sm"
                  />
                </div>
                <Select value={filterStore} onValueChange={setFilterStore}>
                  <SelectTrigger className="h-9 w-40 text-sm">
                    <SelectValue placeholder="All stores" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All stores</SelectItem>
                    {stores.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="h-9 w-36 text-sm">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                    <SelectItem value="processing">Processing</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
                {topics.length > 1 && (
                  <Select value={filterTopic} onValueChange={setFilterTopic}>
                    <SelectTrigger className="h-9 w-44 text-sm">
                      <SelectValue placeholder="All topics" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All topics</SelectItem>
                      {topics.map(t => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="w-[180px]">Timestamp</TableHead>
                    <TableHead>Store</TableHead>
                    <TableHead>Topic</TableHead>
                    <TableHead className="w-[120px]">Status</TableHead>
                    <TableHead>Processed</TableHead>
                    <TableHead>Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {initialLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12">
                        <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Loading events...</span>
                      </TableCell>
                    </TableRow>
                  ) : events.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12">
                        <Activity className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                        <p className="text-sm text-muted-foreground">No webhook events found</p>
                        <p className="text-xs text-muted-foreground/60 mt-1">Events appear here when WooCommerce sends webhook notifications</p>
                      </TableCell>
                    </TableRow>
                  ) : events.map(event => {
                    const { entity, action } = topicLabel(event.topic);
                    const status = (event.processing_status || "pending") as string;
                    const cfg = statusConfig[status] || statusConfig.pending;
                    const StatusIcon = cfg.icon;

                    return (
                      <TableRow
                        key={event.id}
                        className="cursor-pointer hover:bg-muted/40 transition-colors"
                        onClick={() => openDetail(event)}
                      >
                        <TableCell className="font-mono text-xs">
                          <div>{formatDate(event.created_at, i18n.language)}</div>
                          <div className="text-muted-foreground/60">{formatAgo(event.created_at)}</div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm font-medium">
                            {storeMap.get(event.store_id) || event.store_id.substring(0, 8)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-medium capitalize">{entity}</span>
                            {action && (
                              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                                action === "created" ? "bg-emerald-100 text-emerald-700" :
                                action === "updated" ? "bg-blue-100 text-blue-700" :
                                action === "deleted" ? "bg-red-100 text-red-700" :
                                "bg-gray-100 text-gray-700"
                              }`}>
                                {action}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <StatusBadge variant={cfg.variant}>
                            <StatusIcon className={`h-3 w-3 mr-1 ${status === "processing" ? "animate-spin" : ""}`} />
                            {status}
                          </StatusBadge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {event.processed_at ? formatDate(event.processed_at, i18n.language) : "—"}
                        </TableCell>
                        <TableCell className="max-w-[200px]">
                          {event.error_message ? (
                            <div className="flex items-start gap-1">
                              <AlertTriangle className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />
                              <span className="text-xs text-red-600 truncate">{event.error_message}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground/40">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Infinite scroll sentinel + loading indicator */}
            <div ref={sentinelRef} className="py-1" />
            {loadingMore && (
              <div className="flex items-center justify-center py-4 border-t">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mr-2" />
                <span className="text-sm text-muted-foreground">Loading more events...</span>
              </div>
            )}
            {!hasMore && events.length > 0 && (
              <div className="text-center py-3 border-t">
                <span className="text-xs text-muted-foreground">All {formatNumber(total, i18n.language)} events loaded</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Webhook Event Detail
            </DialogTitle>
          </DialogHeader>
          {selectedEvent && (() => {
            const { entity, action } = topicLabel(selectedEvent.topic);
            const status = (selectedEvent.processing_status || "pending") as string;
            const cfg = statusConfig[status] || statusConfig.pending;
            const StatusIcon = cfg.icon;
            const duration = selectedEvent.processed_at && selectedEvent.created_at
              ? Math.round((new Date(selectedEvent.processed_at).getTime() - new Date(selectedEvent.created_at).getTime()) / 1000)
              : null;

            return (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground font-medium">Topic</span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium capitalize">{entity}</span>
                      {action && (
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                          action === "created" ? "bg-emerald-100 text-emerald-700" :
                          action === "updated" ? "bg-blue-100 text-blue-700" :
                          action === "deleted" ? "bg-red-100 text-red-700" :
                          "bg-gray-100 text-gray-700"
                        }`}>
                          {action}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground font-medium">Status</span>
                    <div>
                      <StatusBadge variant={cfg.variant}>
                        <StatusIcon className={`h-3 w-3 mr-1 ${status === "processing" ? "animate-spin" : ""}`} />
                        {status}
                      </StatusBadge>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground font-medium">Store</span>
                    <p className="text-sm font-medium">
                      {storeMap.get(selectedEvent.store_id) || selectedEvent.store_id.substring(0, 8)}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground font-medium">Processing Time</span>
                    <p className="text-sm font-medium">
                      {duration !== null ? `${duration}s` : "—"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground font-medium">Received</span>
                    <p className="text-sm">{formatDate(selectedEvent.created_at, i18n.language)}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground font-medium">Processed</span>
                    <p className="text-sm">{formatDate(selectedEvent.processed_at, i18n.language)}</p>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground font-medium">Event ID</span>
                  <p className="text-xs font-mono bg-muted/50 rounded px-2 py-1">{selectedEvent.id}</p>
                </div>

                {selectedEvent.error_message && (
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground font-medium">Error</span>
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                      <div className="flex items-start gap-2">
                        <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                        <p className="text-sm text-red-700">{selectedEvent.error_message}</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground font-medium">Payload</span>
                  <JsonTableView data={selectedEvent.payload} />
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}