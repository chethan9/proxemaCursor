import { useEffect } from "react";
import { useRouter } from "next/router";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge, getStatusVariant } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Store, RefreshCw, ArrowRight, Clock, TrendingUp, TrendingDown, Activity, Heart, AlertTriangle, Plus } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthProvider";
import { useStores } from "@/hooks/queries/useStores";
import { useSyncRuns } from "@/hooks/queries/useSyncRuns";
import { BrandLogo } from "@/components/BrandLogo";
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

export default function Dashboard() {
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();
  const { data: stores = [], isLoading: sLoading } = useStores();
  const { data: syncRuns = [], isLoading: rLoading } = useSyncRuns(100);

  // Redirect to /projects if user hasn't explicitly chosen "/" as their landing
  useEffect(() => {
    if (authLoading) return;
    if (!user) return;
    const pref = profile?.default_landing_path?.trim();
    if (!pref || pref === "") {
      router.replace("/projects");
    }
  }, [authLoading, user, profile, router]);

  const loading = sLoading || rLoading;

  const stats = {
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

  const healthyStores = stores.filter(s => (s.health_score ?? 0) >= 80);
  const attentionStores = stores.filter(s => s.health_score != null && s.health_score < 80)
    .sort((a, b) => (a.health_score ?? 0) - (b.health_score ?? 0));
  const avgHealth = stores.length > 0 && stores.some(s => s.health_score != null)
    ? Math.round(stores.filter(s => s.health_score != null).reduce((sum, s) => sum + (s.health_score ?? 0), 0) / stores.filter(s => s.health_score != null).length)
    : null;

  const hasSites = stores.length > 0;
  const hasSyncs = syncRuns.length > 0;

  // ---------- EMPTY STATE: no sites ----------
  if (!loading && !hasSites) {
    return (
      <AppLayout title="Dashboard">
        <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-6">
          <div className="max-w-lg text-center space-y-6">
            <BrandLogo size="xl" className="mx-auto" />
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight">Welcome to {useAuth as never && ""}Proxima</h1>
              <p className="text-base text-muted-foreground">
                Add your first site to start monitoring sync health, activity, and fleet-wide insights.
              </p>
            </div>
            <Button size="lg" asChild>
              <Link href="/projects">
                <Plus className="h-4 w-4 mr-2" />
                Add your first site
              </Link>
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  // Charts data (only built when we have syncs)
  const syncStatusData = [
    { name: "Successful", value: stats.successfulSyncs, color: "#10b981" },
    { name: "Failed", value: stats.failedSyncs, color: "#ef4444" },
    { name: "Running", value: stats.runningSyncs, color: "#3b82f6" },
  ].filter(d => d.value > 0);

  const syncsByAspect = syncRuns.reduce((acc, run) => {
    const aspect = run.aspect || "unknown";
    if (!acc[aspect]) acc[aspect] = { aspect, successful: 0, failed: 0 };
    if (run.status === "completed") acc[aspect].successful++;
    else if (run.status === "failed") acc[aspect].failed++;
    return acc;
  }, {} as Record<string, { aspect: string; successful: number; failed: number }>);
  const aspectChartData = Object.values(syncsByAspect);

  const syncsByDay = syncRuns.reduce((acc, run) => {
    const date = new Date(run.started_at || "").toLocaleDateString("en-US", { month: "short", day: "numeric" });
    if (!acc[date]) acc[date] = { date, successful: 0, failed: 0 };
    if (run.status === "completed") acc[date].successful++;
    else if (run.status === "failed") acc[date].failed++;
    return acc;
  }, {} as Record<string, { date: string; successful: number; failed: number }>);
  const timelineData = Object.values(syncsByDay).slice(0, 7).reverse();

  return (
    <AppLayout title="Dashboard">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">
            {hasSyncs ? "Overview of your WooCommerce sync operations" : "Your sites are ready — sync activity will appear here"}
          </p>
        </div>

        {/* KPI Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Active Sites</CardTitle>
              <Store className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.connectedStores}
                <span className="text-sm font-normal text-muted-foreground">/{stats.stores}</span>
              </div>
              <p className="text-xs text-muted-foreground">Connected WooCommerce stores</p>
            </CardContent>
          </Card>

          {avgHealth !== null && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Fleet Health</CardTitle>
                <Heart className={`h-4 w-4 ${avgHealth >= 80 ? "text-emerald-500 fill-emerald-500" : avgHealth >= 50 ? "text-amber-500 fill-amber-500" : "text-red-500 fill-red-500"}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{avgHealth}%</div>
                <p className="text-xs text-muted-foreground">{healthyStores.length} healthy, {attentionStores.length} need attention</p>
              </CardContent>
            </Card>
          )}

          {hasSyncs && (
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
                <div className="text-2xl font-bold">{successRate}%</div>
                <p className="text-xs text-muted-foreground">{stats.successfulSyncs} of {stats.totalSyncs} syncs</p>
              </CardContent>
            </Card>
          )}

          {hasSyncs && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Records Synced</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalRecords.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">Total records processed</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Attention */}
        {attentionStores.length > 0 && (
          <Card className="border-amber-200 bg-amber-50/30">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <CardTitle className="text-sm font-medium">Sites Needing Attention</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 md:grid-cols-2">
                {attentionStores.slice(0, 6).map(store => (
                  <Link key={store.id} href={`/sites/${store.id}/home`} className="flex items-center justify-between p-2 rounded-lg hover:bg-amber-100/50 transition-colors">
                    <div className="flex items-center gap-2 min-w-0">
                      <Store className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-sm font-medium truncate">{store.name}</span>
                    </div>
                    <span className={`text-sm font-bold flex-shrink-0 ${(store.health_score ?? 0) < 50 ? "text-red-600" : "text-amber-600"}`}>
                      {store.health_score}%
                    </span>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* PARTIAL STATE: sites but no syncs */}
        {!loading && hasSites && !hasSyncs && (
          <Card>
            <CardContent className="py-12 text-center">
              <RefreshCw className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-40" />
              <h3 className="text-lg font-medium mb-1">No sync data yet</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Syncs will appear here once they are triggered. You can start one from any site&apos;s page.
              </p>
            </CardContent>
          </Card>
        )}

        {/* FULL STATE: charts + tables */}
        {hasSyncs && (
          <>
            <div className="grid gap-6 lg:grid-cols-3">
              {/* Donut */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Sync Status</CardTitle>
                  <CardDescription>Breakdown of sync outcomes</CardDescription>
                </CardHeader>
                <CardContent>
                  {syncStatusData.length === 0 ? (
                    <div className="h-[220px] flex items-center justify-center text-muted-foreground">
                      <p className="text-sm">No sync data yet</p>
                    </div>
                  ) : (
                    <>
                      <div className="h-[220px] relative">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={syncStatusData}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={90}
                              paddingAngle={2}
                              dataKey="value"
                            >
                              {syncStatusData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                          <span className="text-3xl font-bold tabular-nums">{successRate}%</span>
                          <span className="text-xs text-muted-foreground">success rate</span>
                        </div>
                      </div>
                      <div className="mt-4 space-y-1.5">
                        {syncStatusData.map((d) => (
                          <div key={d.name} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                              <span className="text-muted-foreground">{d.name}</span>
                            </div>
                            <span className="font-medium tabular-nums">{d.value}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Bar Chart */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-lg">Syncs by Data Type</CardTitle>
                  <CardDescription>Successful vs failed syncs per aspect</CardDescription>
                </CardHeader>
                <CardContent>
                  {aspectChartData.length === 0 ? (
                    <div className="h-[260px] flex items-center justify-center text-muted-foreground">
                      <p className="text-sm">No sync data yet</p>
                    </div>
                  ) : (
                    <div className="h-[260px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={aspectChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }} barGap={4} barCategoryGap="20%">
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                          <XAxis
                            dataKey="aspect"
                            tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                            axisLine={{ stroke: "hsl(var(--border))" }}
                            tickLine={false}
                          />
                          <YAxis
                            tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                            axisLine={false}
                            tickLine={false}
                            allowDecimals={false}
                          />
                          <Tooltip
                            cursor={{ fill: "hsl(var(--muted))" }}
                            contentStyle={{
                              backgroundColor: "hsl(var(--background))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "8px",
                              fontSize: "12px",
                            }}
                          />
                          <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }} iconType="circle" />
                          <Bar dataKey="successful" name="Successful" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                          <Bar dataKey="failed" name="Failed" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={40} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Timeline */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Sync Activity Timeline</CardTitle>
                <CardDescription>Daily sync outcomes over the past week</CardDescription>
              </CardHeader>
              <CardContent>
                {timelineData.length === 0 ? (
                  <div className="h-[220px] flex items-center justify-center text-muted-foreground">
                    <p className="text-sm">No sync activity yet</p>
                  </div>
                ) : (
                  <div className="h-[220px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={timelineData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                        <XAxis dataKey="date" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={{ stroke: "hsl(var(--border))" }} tickLine={false} />
                        <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} allowDecimals={false} />
                        <Tooltip contentStyle={{ backgroundColor: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
                        <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }} iconType="circle" />
                        <Line type="monotone" dataKey="successful" name="Successful" stroke="#10b981" strokeWidth={2} dot={{ fill: "#10b981", r: 3 }} />
                        <Line type="monotone" dataKey="failed" name="Failed" stroke="#ef4444" strokeWidth={2} dot={{ fill: "#ef4444", r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent */}
            <div className="grid gap-6 lg:grid-cols-2">
              {stores.length > 0 && (
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle>Recent Sites</CardTitle>
                      <CardDescription>Latest WooCommerce stores</CardDescription>
                    </div>
                    <Button variant="ghost" size="sm" asChild>
                      <Link href="/projects">
                        View all <ArrowRight className="ml-1 h-4 w-4" />
                      </Link>
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {stores.slice(0, 5).map((store) => (
                        <Link
                          key={store.id}
                          href={`/sites/${store.id}/home`}
                          className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="font-medium truncate">{store.name}</p>
                            <p className="text-sm text-muted-foreground truncate">{store.url}</p>
                          </div>
                          <StatusBadge
                            variant={getStatusVariant(store.status || "pending")}
                            pulse={store.status === "syncing"}
                          >
                            {store.status}
                          </StatusBadge>
                        </Link>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {syncRuns.length > 0 && (
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
                              <span>{new Date(run.started_at || "").toLocaleTimeString()}</span>
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
                  </CardContent>
                </Card>
              )}
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}