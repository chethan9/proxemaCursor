import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Webhook,
  Zap,
  AlertCircle,
  ExternalLink,
  Download,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useAllWebhooks, useAllWebhookEvents } from "@/hooks/queries/useWebhooks";
import { exportCsv } from "@/lib/exportCsv";

type WebhookRow = Tables<"webhooks"> & { store_name?: string; store_url?: string };
type WebhookEventRow = Tables<"webhook_events"> & { store_name?: string };

export default function WebhooksPage() {
  const qc = useQueryClient();
  const { data: webhooks = [], isLoading: whLoading, isFetching: whFetching } = useAllWebhooks();
  const { data: events = [], isLoading: evLoading, isFetching: evFetching } = useAllWebhookEvents();
  const loading = whLoading || evLoading;
  const fetching = whFetching || evFetching;
  void fetching;
  const loadData = () => {
    qc.invalidateQueries({ queryKey: ["webhooks", "all"] });
    qc.invalidateQueries({ queryKey: ["webhook-events", "all"] });
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
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
      case "completed":
      case "active":
        return <CheckCircle2 className="h-4 w-4 text-success" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-destructive" />;
      case "processing":
      case "pending":
        return <RefreshCw className="h-4 w-4 text-primary animate-spin" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusVariant = (status: string): "success" | "error" | "warning" | "pending" | "info" => {
    switch (status) {
      case "completed":
      case "active":
        return "success";
      case "failed":
        return "error";
      case "paused":
      case "disabled":
        return "warning";
      default:
        return "pending";
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
            <p className="text-muted-foreground">
              Registered webhooks and incoming events across all sites
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportCsv(webhooks, [
                { key: "store_name", label: "Site", accessor: (w) => w.store_name },
                { key: "store_url", label: "Site URL", accessor: (w) => w.store_url },
                { key: "topic", label: "Topic", accessor: (w) => w.topic },
                { key: "status", label: "Status", accessor: (w) => w.status },
                { key: "last_triggered_at", label: "Last Triggered", accessor: (w) => w.last_triggered_at },
                { key: "failure_count", label: "Failures", accessor: (w) => w.failure_count ?? 0 },
                { key: "created_at", label: "Created", accessor: (w) => w.created_at },
              ], "webhooks")}
              disabled={webhooks.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
            <Button variant="outline" onClick={loadData} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                  <Webhook className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-semibold">{stats.totalWebhooks}</p>
                  <p className="text-xs text-muted-foreground">Total Webhooks</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-2xl font-semibold">{stats.activeWebhooks}</p>
                  <p className="text-xs text-muted-foreground">Active</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                  <AlertCircle className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <p className="text-2xl font-semibold">{stats.failedWebhooks}</p>
                  <p className="text-xs text-muted-foreground">Failed</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Zap className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-semibold">{stats.totalEvents}</p>
                  <p className="text-xs text-muted-foreground">Total Events</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-2xl font-semibold">{stats.processedEvents}</p>
                  <p className="text-xs text-muted-foreground">Processed</p>
                </div>
              </div>
            </CardContent>
          </Card>
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
                <CardDescription>
                  Webhooks registered with WooCommerce stores for real-time updates
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : webhooks.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Webhook className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No webhooks registered</p>
                    <p className="text-sm">Go to a site and click Register Webhooks</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Site</TableHead>
                        <TableHead>Topic</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Last Triggered</TableHead>
                        <TableHead>Failures</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {webhooks.map((webhook) => (
                        <TableRow key={webhook.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{webhook.store_name}</p>
                              <p className="text-xs text-muted-foreground truncate max-w-[150px]">
                                {webhook.store_url}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <code className="text-sm bg-muted px-1.5 py-0.5 rounded">
                              {webhook.topic}
                            </code>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getStatusIcon(webhook.status || "pending")}
                              <StatusBadge variant={getStatusVariant(webhook.status || "pending")}>
                                {webhook.status}
                              </StatusBadge>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatRelativeTime(webhook.last_triggered_at)}
                          </TableCell>
                          <TableCell>
                            {webhook.failure_count && webhook.failure_count > 0 ? (
                              <span className="text-destructive font-medium">
                                {webhook.failure_count}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">0</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Link href={`/sites/${webhook.store_id}`}>
                              <Button variant="ghost" size="sm">
                                <ExternalLink className="h-4 w-4" />
                              </Button>
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
                <CardTitle className="text-lg">Webhook Events</CardTitle>
                <CardDescription>
                  Incoming events received from WooCommerce stores
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : events.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Zap className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No webhook events received</p>
                    <p className="text-sm">Events appear here when WooCommerce sends updates</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Site</TableHead>
                        <TableHead>Topic</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Received</TableHead>
                        <TableHead>Processed</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {events.map((event) => (
                        <TableRow key={event.id}>
                          <TableCell className="font-medium">{event.store_name}</TableCell>
                          <TableCell>
                            <code className="text-sm bg-muted px-1.5 py-0.5 rounded">
                              {event.topic}
                            </code>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getStatusIcon(event.processing_status || "pending")}
                              <StatusBadge
                                variant={getStatusVariant(event.processing_status || "pending")}
                              >
                                {event.processing_status || "pending"}
                              </StatusBadge>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatDate(event.created_at)}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {event.processed_at ? formatDate(event.processed_at) : "-"}
                          </TableCell>
                          <TableCell>
                            <Link href={`/sites/${event.store_id}`}>
                              <Button variant="ghost" size="sm">
                                <ExternalLink className="h-4 w-4" />
                              </Button>
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
        </Tabs>
      </div>
    </AppLayout>
  );
}