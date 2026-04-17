import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge, getStatusVariant } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Users, Store, RefreshCw, Webhook, ArrowRight, Clock } from "lucide-react";
import Link from "next/link";
import { getClients, type ClientWithStats } from "@/services/clientService";
import { getStores, type StoreWithClient } from "@/services/storeService";
import { getSyncRuns, type SyncRunWithStore } from "@/services/syncService";

export default function Dashboard() {
  const [clients, setClients] = useState<ClientWithStats[]>([]);
  const [stores, setStores] = useState<StoreWithClient[]>([]);
  const [syncRuns, setSyncRuns] = useState<SyncRunWithStore[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [clientsData, storesData, runsData] = await Promise.all([
          getClients(),
          getStores(),
          getSyncRuns(10),
        ]);
        setClients(clientsData);
        setStores(storesData);
        setSyncRuns(runsData);
      } catch (error) {
        console.error("Error loading dashboard data:", error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const stats = {
    clients: clients.length,
    stores: stores.length,
    connectedStores: stores.filter((s) => s.status === "connected").length,
    recentSyncs: syncRuns.length,
    failedSyncs: syncRuns.filter((r) => r.status === "failed").length,
  };

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">
            Overview of your WooCommerce integrations
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.clients}</div>
              <p className="text-xs text-muted-foreground">
                Organizations managed
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Active Sites</CardTitle>
              <Store className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.connectedStores}
                <span className="text-sm font-normal text-muted-foreground">
                  /{stats.stores}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Connected WooCommerce stores
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Recent Syncs</CardTitle>
              <RefreshCw className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.recentSyncs}</div>
              <p className="text-xs text-muted-foreground">
                {stats.failedSyncs > 0 && (
                  <span className="text-destructive">
                    {stats.failedSyncs} failed •{" "}
                  </span>
                )}
                Last 24 hours
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Webhooks</CardTitle>
              <Webhook className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">—</div>
              <p className="text-xs text-muted-foreground">Events today</p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Recent Stores */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Recent Sites</CardTitle>
                <CardDescription>Latest WooCommerce stores</CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/sites">
                  View all <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-12 bg-muted animate-pulse rounded" />
                  ))}
                </div>
              ) : stores.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <Store className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No sites yet</p>
                  <Button variant="link" asChild className="mt-2">
                    <Link href="/sites">Add your first site</Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {stores.slice(0, 5).map((store) => (
                    <div
                      key={store.id}
                      className="flex items-center justify-between p-3 rounded-lg border"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{store.name}</p>
                        <p className="text-sm text-muted-foreground truncate">
                          {store.url}
                        </p>
                      </div>
                      <StatusBadge
                        variant={getStatusVariant(store.status || "pending")}
                        pulse={store.status === "syncing"}
                      >
                        {store.status}
                      </StatusBadge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Sync Runs */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Recent Sync Runs</CardTitle>
                <CardDescription>Latest sync operations</CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/sync-runs">
                  View all <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-12 bg-muted animate-pulse rounded" />
                  ))}
                </div>
              ) : syncRuns.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <RefreshCw className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No sync runs yet</p>
                  <p className="text-sm">Syncs will appear here when triggered</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {syncRuns.slice(0, 5).map((run) => (
                    <div
                      key={run.id}
                      className="flex items-center justify-between p-3 rounded-lg border"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{run.store_name}</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span className="capitalize">{run.aspect}</span>
                          <span>•</span>
                          <Clock className="h-3 w-3" />
                          <span>
                            {new Date(run.started_at || "").toLocaleTimeString()}
                          </span>
                        </div>
                      </div>
                      <StatusBadge
                        variant={getStatusVariant(run.status || "running")}
                        pulse={run.status === "running"}
                      >
                        {run.status}
                      </StatusBadge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}