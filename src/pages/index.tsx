import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge, getStatusVariant } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Users, Store, RefreshCw, Webhook, ArrowRight, Clock, TrendingUp, TrendingDown, CheckCircle2, XCircle, Activity, Heart, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { getClients, type ClientWithStats } from "@/services/clientService";
import { getStores, type StoreWithClient } from "@/services/storeService";
import { getSyncRuns, type SyncRunWithStore } from "@/services/syncService";
import { browserCache, CACHE_KEYS, CACHE_TTL } from "@/lib/cache";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  LineChart,
  Line,
} from "recharts";

interface ActiveSync {
  store_id: string;
  store_name: string;
  aspects: { aspect: string; status: string; records_processed: number | null }[];
  total_aspects: number;
  completed_aspects: number;
  started_at: string;
}

export default function Dashboard() {
  const [clients, setClients] = useState<ClientWithStats[]>([]);
  const [stores, setStores] = useState<StoreWithClient[]>([]);
  const [syncRuns, setSyncRuns] = useState<SyncRunWithStore[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadData() {
      // Check cache FIRST - before any loading state
      const cachedClients = browserCache.get<ClientWithStats[]>(CACHE_KEYS.CLIENTS);
      const cachedStores = browserCache.get<StoreWithClient[]>(CACHE_KEYS.STORES);
      const cachedSyncRuns = browserCache.get<SyncRunWithStore[]>(CACHE_KEYS.SYNC_RUNS);
      
      if (cachedClients && cachedStores && cachedSyncRuns) {
        // Instant render from cache
        setClients(cachedClients);
        setStores(cachedStores);
        setSyncRuns(cachedSyncRuns);
        
        // Background refresh
        Promise.all([
          getClients(),
          getStores(),
          getSyncRuns(100),
        ]).then(([freshClients, freshStores, freshRuns]) => {
          browserCache.set(CACHE_KEYS.CLIENTS, freshClients, CACHE_TTL.MEDIUM);
          browserCache.set(CACHE_KEYS.STORES, freshStores, CACHE_TTL.MEDIUM);
          browserCache.set(CACHE_KEYS.SYNC_RUNS, freshRuns, CACHE_TTL.SHORT);
          setClients(freshClients);
          setStores(freshStores);
          setSyncRuns(freshRuns);
        }).catch(console.error);
        
        return;
      }

      // No cache - show loading
      setLoading(true);
      try {
        const [clientsData, storesData, runsData] = await Promise.all([
          getClients(),
          getStores(),
          getSyncRuns(100),
        ]);
        setClients(clientsData);
        setStores(storesData);
        setSyncRuns(runsData);
        // Cache results
        browserCache.set(CACHE_KEYS.CLIENTS, clientsData, CACHE_TTL.MEDIUM);
        browserCache.set(CACHE_KEYS.STORES, storesData, CACHE_TTL.MEDIUM);
        browserCache.set(CACHE_KEYS.SYNC_RUNS, runsData, CACHE_TTL.SHORT);
      } catch (error) {
        console.error("Error loading dashboard data:", error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Calculate stats
  const stats = {
    clients: clients.length,
    stores: stores.length,
    connectedStores: stores.filter((s) => s.status === "connected").length,
    totalSyncs: syncRuns.length,
    successfulSyncs: syncRuns.filter((r) => r.status === "completed").length,
    failedSyncs: syncRuns.filter((r) => r.status === "failed").length,
    runningSyncs: syncRuns.filter((r) => r.status === "running").length,
    totalRecords: syncRuns.reduce((sum, r) => sum + (r.records_processed || 0), 0),
  };

  const successRate = stats.totalSyncs > 0 
    ? Math.round((stats.successfulSyncs / stats.totalSyncs) * 100) 
    : 0;

  // Health stats
  const healthyStores = stores.filter(s => (s.health_score ?? 0) >= 80);
  const attentionStores = stores.filter(s => s.health_score != null && s.health_score < 80)
    .sort((a, b) => (a.health_score ?? 0) - (b.health_score ?? 0));
  const avgHealth = stores.length > 0 && stores.some(s => s.health_score != null)
    ? Math.round(stores.filter(s => s.health_score != null).reduce((sum, s) => sum + (s.health_score ?? 0), 0) / stores.filter(s => s.health_score != null).length)
    : null;

  // Pie chart data for sync status
  const syncStatusData = [
    { name: "Successful", value: stats.successfulSyncs, color: "#10b981" },
    { name: "Failed", value: stats.failedSyncs, color: "#ef4444" },
    { name: "Running", value: stats.runningSyncs, color: "#3b82f6" },
  ].filter(d => d.value > 0);

  // Bar chart data for syncs by aspect
  const syncsByAspect = syncRuns.reduce((acc, run) => {
    const aspect = run.aspect || "unknown";
    if (!acc[aspect]) {
      acc[aspect] = { aspect, successful: 0, failed: 0 };
    }
    if (run.status === "completed") {
      acc[aspect].successful++;
    } else if (run.status === "failed") {
      acc[aspect].failed++;
    }
    return acc;
  }, {} as Record<string, { aspect: string; successful: number; failed: number }>);

  const aspectChartData = Object.values(syncsByAspect);

  // Line chart data for syncs over time (last 7 days)
  const syncsByDay = syncRuns.reduce((acc, run) => {
    const date = new Date(run.started_at || "").toLocaleDateString("en-US", { 
      month: "short", 
      day: "numeric" 
    });
    if (!acc[date]) {
      acc[date] = { date, successful: 0, failed: 0 };
    }
    if (run.status === "completed") {
      acc[date].successful++;
    } else if (run.status === "failed") {
      acc[date].failed++;
    }
    return acc;
  }, {} as Record<string, { date: string; successful: number; failed: number }>);

  const timelineData = Object.values(syncsByDay).slice(0, 7).reverse();

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">
            Overview of your WooCommerce sync operations
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
              <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
              {successRate >= 90 ? (
                <TrendingUp className="h-4 w-4 text-success" />
              ) : (
                <TrendingDown className="h-4 w-4 text-destructive" />
              )}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {successRate}%
              </div>
              <p className="text-xs text-muted-foreground">
                {stats.successfulSyncs} of {stats.totalSyncs} syncs
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Records Synced</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.totalRecords.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                Total records processed
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Fleet Health + Attention */}
        {avgHealth !== null && (
          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Fleet Health</CardTitle>
                <Heart className={`h-4 w-4 ${avgHealth >= 80 ? "text-emerald-500 fill-emerald-500" : avgHealth >= 50 ? "text-amber-500 fill-amber-500" : "text-red-500 fill-red-500"}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{avgHealth}%</div>
                <p className="text-xs text-muted-foreground">
                  {healthyStores.length} healthy, {attentionStores.length} need attention
                </p>
              </CardContent>
            </Card>
            {attentionStores.length > 0 && (
              <Card className="lg:col-span-2 border-amber-200 bg-amber-50/30">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    <CardTitle className="text-sm font-medium">Sites Needing Attention</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {attentionStores.slice(0, 4).map(store => (
                      <Link key={store.id} href={`/sites/${store.id}`} className="flex items-center justify-between p-2 rounded-lg hover:bg-amber-100/50 transition-colors">
                        <div className="flex items-center gap-2">
                          <Store className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">{store.name}</span>
                        </div>
                        <span className={`text-sm font-bold ${(store.health_score ?? 0) < 50 ? "text-red-600" : "text-amber-600"}`}>
                          {store.health_score}%
                        </span>
                      </Link>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Charts Row */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Sync Status Pie Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Sync Status Distribution</CardTitle>
              <CardDescription>Breakdown of sync run outcomes</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-[200px] flex items-center justify-center">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : syncStatusData.length === 0 ? (
                <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <RefreshCw className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No sync data yet</p>
                  </div>
                </div>
              ) : (
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={syncStatusData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {syncStatusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
              <div className="flex justify-center gap-4 mt-4">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-success" />
                  <span className="text-sm text-muted-foreground">Success</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-destructive" />
                  <span className="text-sm text-muted-foreground">Failed</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-primary" />
                  <span className="text-sm text-muted-foreground">Running</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Syncs by Aspect Bar Chart */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg">Syncs by Data Type</CardTitle>
              <CardDescription>Successful vs failed syncs per aspect</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-[200px] flex items-center justify-center">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : aspectChartData.length === 0 ? (
                <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <RefreshCw className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No sync data yet</p>
                  </div>
                </div>
              ) : (
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={aspectChartData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" />
                      <YAxis 
                        type="category" 
                        dataKey="aspect" 
                        width={80}
                        tick={{ fontSize: 12 }}
                      />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="successful" name="Successful" fill="#10b981" radius={[0, 4, 4, 0]} />
                      <Bar dataKey="failed" name="Failed" fill="#ef4444" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sync Timeline */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Sync Activity Timeline</CardTitle>
            <CardDescription>Daily sync outcomes over the past week</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-[200px] flex items-center justify-center">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : timelineData.length === 0 ? (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No sync activity yet</p>
                </div>
              </div>
            ) : (
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={timelineData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="successful" 
                      name="Successful" 
                      stroke="#10b981" 
                      strokeWidth={2}
                      dot={{ fill: "#10b981" }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="failed" 
                      name="Failed" 
                      stroke="#ef4444" 
                      strokeWidth={2}
                      dot={{ fill: "#ef4444" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

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