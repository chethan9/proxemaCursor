import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/status-badge";
import { Webhook, CheckCircle2, AlertCircle, Zap } from "lucide-react";
import { formatDate, formatRelativeTime } from "./formatters";
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

export function WebhookPanel({ store, webhooks, webhookEvents, webhookStats, onRegister, getStatusIcon }: WebhookPanelProps) {
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
        <CardHeader><CardTitle className="text-lg">Recent Events</CardTitle><CardDescription>Incoming webhook events from WooCommerce</CardDescription></CardHeader>
        <CardContent className="p-0">
          {webhookEvents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Zap className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No webhook events received yet</p><p className="text-sm">Events will appear here when WooCommerce sends updates</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow><TableHead>Topic</TableHead><TableHead>Status</TableHead><TableHead>Received</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {webhookEvents.slice(0, 20).map((event) => (
                  <TableRow key={event.id}>
                    <TableCell><code className="text-sm bg-muted px-1.5 py-0.5 rounded">{event.topic}</code></TableCell>
                    <TableCell><div className="flex items-center gap-2">{getStatusIcon(event.processing_status || "pending")}<span className="capitalize">{event.processing_status || "pending"}</span></div></TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(event.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}