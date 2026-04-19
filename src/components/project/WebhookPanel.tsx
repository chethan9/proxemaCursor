import { useMemo, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/status-badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Webhook, CheckCircle2, AlertCircle, Zap, Download } from "lucide-react";
import { formatDate, formatRelativeTime } from "./formatters";
import { exportCsv } from "@/lib/exportCsv";
import type { Store } from "@/services/storeService";
import type { Webhook as WebhookType, WebhookEventRow } from "@/services/webhookService";

interface WebhookPanelProps {
  store: Store;
  webhooks: WebhookType[];
  webhookEvents: WebhookEventRow[];
  webhookStats: { total: number; active: number; failed: number; eventsToday: number };
  onRegister: () => void;
  getStatusIcon: (status: string) => React.ReactNode;
}

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

export function WebhookPanel({ store, webhooks, webhookEvents, webhookStats, onRegister, getStatusIcon }: WebhookPanelProps) {
  const [search, setSearch] = useState("");
  const [range, setRange] = useState("all");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const filtered = useMemo(() => {
    const bounds = rangeToMs(range);
    return webhookEvents.filter((e) => {
      if (search && !(e.topic || "").toLowerCase().includes(search.toLowerCase())) return false;
      if (bounds) {
        const t = new Date(e.created_at || 0).getTime();
        if (t < bounds.from || t > bounds.to) return false;
      }
      return true;
    });
  }, [webhookEvents, search, range]);

  useEffect(() => { setPage(1); }, [search, range]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  const handleExport = () => {
    exportCsv(filtered, [
      { key: "topic", label: "Topic", accessor: (e) => e.topic },
      { key: "processing_status", label: "Status", accessor: (e) => e.processing_status },
      { key: "created_at", label: "Received", accessor: (e) => e.created_at },
      { key: "processed_at", label: "Processed", accessor: (e) => e.processed_at },
      { key: "error_message", label: "Error", accessor: (e) => e.error_message ?? "" },
    ], `webhook-events-${store.name}`);
  };

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4"><div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center"><Webhook className="h-5 w-5" /></div>
          <div><p className="text-2xl font-semibold">{webhookStats.total}</p><p className="text-xs text-muted-foreground">Total Webhooks</p></div>
        </div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center"><CheckCircle2 className="h-5 w-5 text-success" /></div>
          <div><p className="text-2xl font-semibold">{webhookStats.active}</p><p className="text-xs text-muted-foreground">Active</p></div>
        </div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center"><AlertCircle className="h-5 w-5 text-destructive" /></div>
          <div><p className="text-2xl font-semibold">{webhookStats.failed}</p><p className="text-xs text-muted-foreground">Failed</p></div>
        </div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center"><Zap className="h-5 w-5 text-primary" /></div>
          <div><p className="text-2xl font-semibold">{webhookStats.eventsToday}</p><p className="text-xs text-muted-foreground">Events Today</p></div>
        </div></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div><CardTitle className="text-lg">Registered Webhooks</CardTitle><CardDescription>Real-time event subscriptions from WooCommerce</CardDescription></div>
            <Button onClick={onRegister} disabled={!store.consumer_key}>
              <Webhook className="h-4 w-4 mr-2" />{webhooks.length > 0 ? "Repair Webhooks" : "Register Webhooks"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {!store.consumer_key ? (
            <div className="text-center py-8 text-muted-foreground">
              <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Store not connected</p><p className="text-sm">Complete OAuth setup to register webhooks</p>
            </div>
          ) : webhooks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Webhook className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No webhooks registered yet</p><p className="text-sm">Click &quot;Register Webhooks&quot; to set up real-time sync</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow><TableHead>Topic</TableHead><TableHead>Status</TableHead><TableHead>Delivery URL</TableHead><TableHead>Last Triggered</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {webhooks.map((webhook) => (
                  <TableRow key={webhook.id}>
                    <TableCell><code className="text-sm bg-muted px-1.5 py-0.5 rounded">{webhook.topic}</code></TableCell>
                    <TableCell>
                      <StatusBadge variant={webhook.status === "active" ? "success" : webhook.status === "failed" ? "error" : "warning"}>
                        {webhook.status}
                      </StatusBadge>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-muted-foreground text-xs font-mono">{webhook.delivery_url}</TableCell>
                    <TableCell className="text-muted-foreground">{formatRelativeTime(webhook.last_triggered_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <CardTitle className="text-lg">Recent Events</CardTitle>
              <CardDescription>Incoming webhook events from WooCommerce</CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Input placeholder="Search topic" value={search} onChange={(e) => setSearch(e.target.value)} className="h-9 w-48" />
              <Select value={range} onValueChange={setRange}>
                <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RANGE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={handleExport} disabled={filtered.length === 0}>
                <Download className="h-4 w-4 mr-2" />Export CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Zap className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No webhook events {webhookEvents.length > 0 ? "match your filters" : "received yet"}</p>
              <p className="text-sm">{webhookEvents.length > 0 ? "Try adjusting search or date range" : "Events will appear here when WooCommerce sends updates"}</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Topic</TableHead><TableHead>Status</TableHead><TableHead>Received</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {paged.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell><code className="text-sm bg-muted px-1.5 py-0.5 rounded">{event.topic}</code></TableCell>
                      <TableCell><div className="flex items-center gap-2">{getStatusIcon(event.processing_status || "pending")}<span className="capitalize">{event.processing_status || "pending"}</span></div></TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(event.created_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex items-center justify-between px-4 py-3 border-t">
                <p className="text-xs text-muted-foreground">
                  Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} of {filtered.length}
                </p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Previous</Button>
                  <span className="text-xs text-muted-foreground tabular-nums">Page {page} of {totalPages}</span>
                  <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>Next</Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </>
  );
}