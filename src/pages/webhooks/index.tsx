import { useState, useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, CheckCircle2, XCircle, Clock, Webhook, Zap, AlertCircle, ExternalLink, Download } from "lucide-react";
import { useAllWebhooks, useAllWebhookEvents } from "@/hooks/queries/useWebhooks";
import { exportCsv } from "@/lib/exportCsv";
import { useTranslation } from "next-i18next";
import { formatDateTime } from "@/lib/format-number";

const RANGE_OPTIONS = [
  { value: "all", label: "All time" },
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
];

function rangeToMs(range: string): { from: number; to: number } | null {
  const now = Date.now();
  const startOfDay = (d: Date) => { d.setHours(0, 0, 0, 0); return d.getTime(); };
  const endOfDay = (d: Date) => { d.setHours(23, 59, 59, 999); return d.getTime(); };
  if (range === "today") return { from: startOfDay(new Date()), to: endOfDay(new Date()) };
  if (range === "yesterday") { const y = new Date(); y.setDate(y.getDate() - 1); return { from: startOfDay(new Date(y)), to: endOfDay(new Date(y)) }; }
  if (range === "7d") return { from: now - 7 * 86400000, to: now };
  if (range === "30d") return { from: now - 30 * 86400000, to: now };
  if (range === "90d") return { from: now - 90 * 86400000, to: now };
  return null;
}

export default function WebhooksPage() {
  const qc = useQueryClient();
  const { i18n } = useTranslation();
  const { data: webhooks = [], isLoading: whLoading } = useAllWebhooks();
  const { data: events = [], isLoading: evLoading } = useAllWebhookEvents();
  const loading = whLoading || evLoading;

  const [evSearch, setEvSearch] = useState("");
  const [evRange, setEvRange] = useState("all");
  const [evPage, setEvPage] = useState(1);
  const evPageSize = 20;

  const filteredEvents = useMemo(() => {
    const bounds = rangeToMs(evRange);
    return events.filter((e) => {
      const term = evSearch.toLowerCase();
      if (term && !(e.topic || "").toLowerCase().includes(term) && !(e.store_name || "").toLowerCase().includes(term)) return false;
      if (bounds) {
        const t = new Date(e.created_at || 0).getTime();
        if (t < bounds.from || t > bounds.to) return false;
      }
      return true;
    });
  }, [events, evSearch, evRange]);

  useEffect(() => { setEvPage(1); }, [evSearch, evRange]);
  const evTotalPages = Math.max(1, Math.ceil(filteredEvents.length / evPageSize));
  const evPaged = filteredEvents.slice((evPage - 1) * evPageSize, evPage * evPageSize);

  const exportEventsCsv = () => {
    exportCsv(filteredEvents, [
      { key: "store_name", label: "Site", accessor: (e) => e.store_name },
      { key: "topic", label: "Topic", accessor: (e) => e.topic },
      { key: "processing_status", label: "Status", accessor: (e) => e.processing_status },
      { key: "created_at", label: "Received", accessor: (e) => e.created_at },
      { key: "processed_at", label: "Processed", accessor: (e) => e.processed_at },
      { key: "error_message", label: "Error", accessor: (e) => e.error_message ?? "" },
    ], "webhook-events");
  };

  const loadData = () => {
    qc.invalidateQueries({ queryKey: ["webhooks", "all"] });
    qc.invalidateQueries({ queryKey: ["webhook-events", "all"] });
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    return formatDateTime(dateString, i18n.language, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const formatRelativeTime = (dateString: string | null) => {
    if (!dateString) return "Never";
    const diff = Date.now() - new Date(dateString).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed": case "active": return <CheckCircle2 className="h-4 w-4 text-success" />;
      case "failed": return <XCircle className="h-4 w-4 text-destructive" />;
      case "processing": case "pending": return <RefreshCw className="h-4 w-4 text-primary animate-spin" />;
      default: return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusVariant = (status: string): "success" | "error" | "warning" | "pending" | "info" => {
    switch (status) {
      case "completed": case "active": return "success";
      case "failed": return "error";
      case "paused": case "disabled": return "warning";
      default: return "pending";
    }
  };

  const stats = {
    totalWebhooks: webhooks.length,
    activeWebhooks: webhooks.filter((w) => w.status === "active").length,
    failedWebhooks: webhooks.filter((w) => w.status === "failed").length,
    totalEvents: events.length,
    processedEvents: events.filter((e) => e.processing_status === "completed").length,
  };

  return (
    <AppLayout title="Webhooks">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Webhooks</h1>
            <p className="text-muted-foreground">Registered webhooks and incoming events across all sites</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => exportCsv(webhooks, [
              { key: "store_name", label: "Site", accessor: (w) => w.store_name },
              { key: "store_url", label: "Site URL", accessor: (w) => w.store_url },
              { key: "topic", label: "Topic", accessor: (w) => w.topic },
              { key: "status", label: "Status", accessor: (w) => w.status },
              { key: "last_triggered_at", label: "Last Triggered", accessor: (w) => w.last_triggered_at },
              { key: "failure_count", label: "Failures", accessor: (w) => w.failure_count ?? 0 },
              { key: "created_at", label: "Created", accessor: (w) => w.created_at },
            ], "webhooks")} disabled={webhooks.length === 0}>
              <Download className="h-4 w-4 mr-2" />Export CSV
            </Button>
            <Button variant="outline" onClick={loadData} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />Refresh
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card><CardContent className="p-4"><div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center"><Webhook className="h-5 w-5" /></div>
            <div><p className="text-2xl font-semibold">{stats.totalWebhooks}</p><p className="text-xs text-muted-foreground">Total Webhooks</p></div>
          </div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center"><CheckCircle2 className="h-5 w-5 text-success" /></div>
            <div><p className="text-2xl font-semibold">{stats.activeWebhooks}</p><p className="text-xs text-muted-foreground">Active</p></div>
          </div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center"><AlertCircle className="h-5 w-5 text-destructive" /></div>
            <div><p className="text-2xl font-semibold">{stats.failedWebhooks}</p><p className="text-xs text-muted-foreground">Failed</p></div>
          </div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center"><Zap className="h-5 w-5 text-primary" /></div>
            <div><p className="text-2xl font-semibold">{stats.totalEvents}</p><p className="text-xs text-muted-foreground">Total Events</p></div>
          </div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center"><CheckCircle2 className="h-5 w-5 text-success" /></div>
            <div><p className="text-2xl font-semibold">{stats.processedEvents}</p><p className="text-xs text-muted-foreground">Processed</p></div>
          </div></CardContent></Card>
        </div>

        <Tabs defaultValue="webhooks" className="space-y-4">
          <TabsList>
            <TabsTrigger value="webhooks">Registered Webhooks</TabsTrigger>
            <TabsTrigger value="events">Webhook Events</TabsTrigger>
          </TabsList>

          <TabsContent value="webhooks">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Registered Webhooks</CardTitle>
                <CardDescription>Webhooks registered with WooCommerce stores for real-time updates</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {loading ? (
                  <div className="flex items-center justify-center py-8"><RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                ) : webhooks.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Webhook className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No webhooks registered</p><p className="text-sm">Go to a site and click Register Webhooks</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Site</TableHead><TableHead>Topic</TableHead><TableHead>Status</TableHead>
                        <TableHead>Last Triggered</TableHead><TableHead>Failures</TableHead><TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {webhooks.map((webhook) => (
                        <TableRow key={webhook.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{webhook.store_name}</p>
                              <p className="text-xs text-muted-foreground truncate max-w-[150px]">{webhook.store_url}</p>
                            </div>
                          </TableCell>
                          <TableCell><code className="text-sm bg-muted px-1.5 py-0.5 rounded">{webhook.topic}</code></TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getStatusIcon(webhook.status || "pending")}
                              <StatusBadge variant={getStatusVariant(webhook.status || "pending")}>{webhook.status}</StatusBadge>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{formatRelativeTime(webhook.last_triggered_at)}</TableCell>
                          <TableCell>
                            {webhook.failure_count && webhook.failure_count > 0 ? (
                              <span className="text-destructive font-medium">{webhook.failure_count}</span>
                            ) : (
                              <span className="text-muted-foreground">0</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Link href={`/sites/${webhook.store_id}`}>
                              <Button variant="ghost" size="sm"><ExternalLink className="h-4 w-4" /></Button>
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="events">
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <CardTitle className="text-lg">Webhook Events</CardTitle>
                    <CardDescription>Incoming events received from WooCommerce stores</CardDescription>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Input placeholder="Search topic or site" value={evSearch} onChange={(e) => setEvSearch(e.target.value)} className="h-9 w-48" />
                    <Select value={evRange} onValueChange={setEvRange}>
                      <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {RANGE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Button variant="outline" size="sm" onClick={exportEventsCsv} disabled={filteredEvents.length === 0}>
                      <Download className="h-4 w-4 mr-2" />Export CSV
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {loading ? (
                  <div className="flex items-center justify-center py-8"><RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                ) : filteredEvents.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Zap className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No webhook events {events.length > 0 ? "match your filters" : "received"}</p>
                    <p className="text-sm">{events.length > 0 ? "Try adjusting date range or search" : "Events appear here when WooCommerce sends updates"}</p>
                  </div>
                ) : (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Site</TableHead><TableHead>Topic</TableHead><TableHead>Status</TableHead>
                          <TableHead>Received</TableHead><TableHead>Processed</TableHead><TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {evPaged.map((event) => (
                          <TableRow key={event.id}>
                            <TableCell className="font-medium">{event.store_name}</TableCell>
                            <TableCell><code className="text-sm bg-muted px-1.5 py-0.5 rounded">{event.topic}</code></TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {getStatusIcon(event.processing_status || "pending")}
                                <StatusBadge variant={getStatusVariant(event.processing_status || "pending")}>
                                  {event.processing_status || "pending"}
                                </StatusBadge>
                              </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground">{formatDate(event.created_at)}</TableCell>
                            <TableCell className="text-muted-foreground">{event.processed_at ? formatDate(event.processed_at) : "-"}</TableCell>
                            <TableCell>
                              <Link href={`/sites/${event.store_id}`}>
                                <Button variant="ghost" size="sm"><ExternalLink className="h-4 w-4" /></Button>
                              </Link>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <div className="flex items-center justify-between px-4 py-3 border-t">
                      <p className="text-xs text-muted-foreground">
                        Showing {(evPage - 1) * evPageSize + 1}–{Math.min(evPage * evPageSize, filteredEvents.length)} of {filteredEvents.length}
                      </p>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => setEvPage((p) => Math.max(1, p - 1))} disabled={evPage === 1}>Previous</Button>
                        <span className="text-xs text-muted-foreground tabular-nums">Page {evPage} of {evTotalPages}</span>
                        <Button variant="outline" size="sm" onClick={() => setEvPage((p) => Math.min(evTotalPages, p + 1))} disabled={evPage >= evTotalPages}>Next</Button>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}