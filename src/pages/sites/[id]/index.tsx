import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
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
import { StatusBadge, getStatusVariant } from "@/components/ui/status-badge";
import {
  ArrowLeft,
  RefreshCw,
  Package,
  ShoppingCart,
  Users,
  Tag,
  Ticket,
  Layers,
  Play,
  Clock,
  CheckCircle2,
  XCircle,
  Webhook,
} from "lucide-react";
import { getStore, updateStoreStatus, type Store } from "@/services/storeService";
import { getSyncRunsByStore, createSyncRun, completeSyncRun, type SyncRun } from "@/services/syncService";

const SYNC_ASPECTS = [
  { id: "products", label: "Products", icon: Package },
  { id: "orders", label: "Orders", icon: ShoppingCart },
  { id: "customers", label: "Customers", icon: Users },
  { id: "categories", label: "Categories", icon: Layers },
  { id: "coupons", label: "Coupons", icon: Ticket },
  { id: "tags", label: "Tags", icon: Tag },
] as const;

export default function SiteWorkspacePage() {
  const router = useRouter();
  const { id } = router.query;
  const [store, setStore] = useState<Store | null>(null);
  const [syncRuns, setSyncRuns] = useState<SyncRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);

  const loadData = async () => {
    if (!id || typeof id !== "string") return;
    setLoading(true);
    try {
      const [storeData, runsData] = await Promise.all([
        getStore(id),
        getSyncRunsByStore(id),
      ]);
      setStore(storeData);
      setSyncRuns(runsData);
    } catch (error) {
      console.error("Error loading site data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const handleSync = async (aspect: string) => {
    if (!store || syncing) return;
    setSyncing(aspect);
    try {
      await updateStoreStatus(store.id, "syncing");
      const run = await createSyncRun({
        store_id: store.id,
        aspect,
        status: "running",
        started_at: new Date().toISOString(),
      });

      // Simulate sync (in real app, this would call WooCommerce API)
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const recordsProcessed = Math.floor(Math.random() * 100) + 10;
      await completeSyncRun(run.id, {
        status: "completed",
        records_processed: recordsProcessed,
      });

      await updateStoreStatus(store.id, "connected");
      await loadData();
    } catch (error) {
      console.error("Sync error:", error);
      if (store) {
        await updateStoreStatus(store.id, "error");
      }
    } finally {
      setSyncing(null);
    }
  };

  const handleSyncAll = async () => {
    for (const aspect of SYNC_ASPECTS) {
      await handleSync(aspect.id);
    }
  };

  const formatDuration = (start: string, end: string | null) => {
    if (!end) return "Running...";
    const ms = new Date(end).getTime() - new Date(start).getTime();
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-success" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-destructive" />;
      case "running":
        return <RefreshCw className="h-4 w-4 text-primary animate-spin" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="p-6 flex items-center justify-center h-[calc(100vh-4rem)]">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  if (!store) {
    return (
      <AppLayout>
        <div className="p-6">
          <p className="text-muted-foreground">Site not found.</p>
          <Link href="/sites">
            <Button variant="outline" className="mt-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Sites
            </Button>
          </Link>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/sites">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold">{store.name}</h1>
              <StatusBadge variant={getStatusVariant(store.status)}>{store.status}</StatusBadge>
            </div>
            <p className="text-sm text-muted-foreground">{store.url}</p>
          </div>
          <Button onClick={handleSyncAll} disabled={!!syncing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
            Sync All
          </Button>
        </div>

        <Tabs defaultValue="sync" className="space-y-6">
          <TabsList>
            <TabsTrigger value="sync">Sync Engine</TabsTrigger>
            <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="sync" className="space-y-6">
            {/* Sync Aspects Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {SYNC_ASPECTS.map((aspect) => {
                const Icon = aspect.icon;
                const isActive = syncing === aspect.id;
                const lastRun = syncRuns.find((r) => r.aspect === aspect.id);
                return (
                  <Card key={aspect.id} className="relative overflow-hidden">
                    <CardContent className="p-4">
                      <div className="flex flex-col items-center text-center space-y-2">
                        <div
                          className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                            isActive ? "bg-primary text-primary-foreground" : "bg-muted"
                          }`}
                        >
                          <Icon className={`h-5 w-5 ${isActive ? "animate-pulse" : ""}`} />
                        </div>
                        <p className="font-medium text-sm">{aspect.label}</p>
                        {lastRun && (
                          <p className="text-xs text-muted-foreground">
                            {lastRun.records_processed || 0} records
                          </p>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full"
                          onClick={() => handleSync(aspect.id)}
                          disabled={!!syncing}
                        >
                          {isActive ? (
                            <RefreshCw className="h-3 w-3 animate-spin" />
                          ) : (
                            <Play className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Sync History */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Sync History</CardTitle>
                <CardDescription>Recent sync operations for this site</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Aspect</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Records</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Started</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {syncRuns.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          No sync runs yet. Click a sync button to start.
                        </TableCell>
                      </TableRow>
                    ) : (
                      syncRuns.slice(0, 20).map((run) => (
                        <TableRow key={run.id}>
                          <TableCell className="font-medium capitalize">{run.aspect}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getStatusIcon(run.status)}
                              <span className="capitalize">{run.status}</span>
                            </div>
                          </TableCell>
                          <TableCell>{run.records_processed || "-"}</TableCell>
                          <TableCell className="font-mono text-sm">
                            {formatDuration(run.started_at, run.completed_at)}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatDate(run.started_at)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="webhooks" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Webhook Configuration</CardTitle>
                    <CardDescription>Manage real-time event subscriptions</CardDescription>
                  </div>
                  <Button variant="outline">
                    <Webhook className="h-4 w-4 mr-2" />
                    Register Webhooks
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <Webhook className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No webhooks registered yet</p>
                  <p className="text-sm">Click "Register Webhooks" to set up real-time sync</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Site Settings</CardTitle>
                <CardDescription>Configure connection and sync preferences</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium">Store URL</p>
                    <p className="text-sm text-muted-foreground">{store.url}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">API Status</p>
                    <StatusBadge variant={store.consumer_key ? "success" : "warning"}>
                      {store.consumer_key ? "Configured" : "Not Configured"}
                    </StatusBadge>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Last Sync</p>
                    <p className="text-sm text-muted-foreground">
                      {store.last_sync_at ? formatDate(store.last_sync_at) : "Never"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Created</p>
                    <p className="text-sm text-muted-foreground">{formatDate(store.created_at)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}