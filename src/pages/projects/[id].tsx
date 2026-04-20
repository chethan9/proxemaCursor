import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge, getStatusVariant } from "@/components/ui/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft, RefreshCw, Package, ShoppingCart, Users, Clock,
  CheckCircle2, XCircle, AlertCircle, Eye, Settings, Database, FileText,
  Trash2, Copy, AlertTriangle, Zap, Archive,
} from "lucide-react";
import { getStore, updateStore, deleteStore, type Store } from "@/services/storeService";
import {
  getSyncRunsByStore, getProductsByStore, getOrdersByStore, getCustomersByStore,
  type SyncRun, type Product, type Order, type Customer,
} from "@/services/syncService";
import {
  getWebhooksByStore, getWebhookEventsByStore, getWebhookStats,
  type Webhook as WebhookType, type WebhookEventRow,
} from "@/services/webhookService";
import { EntityHistory } from "@/components/EntityHistory";
import { JsonTableView } from "@/components/JsonTableView";
import { SyncPanel } from "@/components/project/SyncPanel";
import { WebhookPanel } from "@/components/project/WebhookPanel";
import { LogsPanel, type CronLog } from "@/components/project/LogsPanel";
import { DeletedRecordsArchive } from "@/components/project/DeletedRecordsArchive";
import { formatDate, formatDuration, formatRelativeTime, formatCurrency } from "@/components/project/formatters";
import { SYNC_INTERVALS } from "@/components/project/constants";

interface SyncProgress { current: number; total: number; aspect: string; }

const siteCache = new Map<string, { data: Store; timestamp: number }>();
const CACHE_TTL = 30000;

export default function SiteWorkspacePage() {
  const router = useRouter();
  const { id } = router.query;
  const [store, setStore] = useState<Store | null>(null);
  const [syncRuns, setSyncRuns] = useState<SyncRun[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookType[]>([]);
  const [webhookEvents, setWebhookEvents] = useState<WebhookEventRow[]>([]);
  const [webhookStats, setWebhookStats] = useState({ total: 0, active: 0, failed: 0, eventsToday: 0 });
  const [loading, setLoading] = useState(true);

  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  const syncAbortRef = useRef(false);

  const [dataCounts, setDataCounts] = useState<Record<string, number>>({
    products: 0, orders: 0, customers: 0, categories: 0, tags: 0, coupons: 0,
  });

  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [dataTab, setDataTab] = useState<"products" | "orders" | "customers">("products");
  const [loadingData, setLoadingData] = useState(false);

  const [cronLogs, setCronLogs] = useState<CronLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const [selectedItem, setSelectedItem] = useState<Product | Order | Customer | null>(null);
  const [detailType, setDetailType] = useState<"product" | "order" | "customer" | null>(null);
  const [selectedSyncRun, setSelectedSyncRun] = useState<SyncRun | null>(null);

  const [syncInterval, setSyncInterval] = useState<string>("0");
  const [savingSettings, setSavingSettings] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [triggeringCron, setTriggeringCron] = useState(false);
  const [cronResult, setCronResult] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("sync");

  useEffect(() => {
    const t = router.query.tab;
    if (typeof t === "string" && ["sync", "data", "webhooks", "logs", "history", "archive", "settings"].includes(t)) {
      setActiveTab(t);
    }
  }, [router.query.tab]);

  const getExtendedDataCounts = async (storeId: string) => {
    const [p, o, c, cat, tg, cp] = await Promise.all([
      supabase.from("products").select("id", { count: "exact", head: true }).eq("store_id", storeId),
      supabase.from("orders").select("id", { count: "exact", head: true }).eq("store_id", storeId),
      supabase.from("customers").select("id", { count: "exact", head: true }).eq("store_id", storeId),
      supabase.from("categories").select("id", { count: "exact", head: true }).eq("store_id", storeId),
      supabase.from("tags").select("id", { count: "exact", head: true }).eq("store_id", storeId),
      supabase.from("coupons").select("id", { count: "exact", head: true }).eq("store_id", storeId),
    ]);
    return {
      products: p.count || 0, orders: o.count || 0, customers: c.count || 0,
      categories: cat.count || 0, tags: tg.count || 0, coupons: cp.count || 0,
    };
  };

  const loadData = async () => {
    if (!id || typeof id !== "string") return;
    const cached = siteCache.get(id);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) setStore(cached.data);
    if (!cached) setLoading(true);

    try {
      const [storeData, runsData, webhooksData, eventsData, stats] = await Promise.all([
        getStore(id), getSyncRunsByStore(id), getWebhooksByStore(id),
        getWebhookEventsByStore(id, 50), getWebhookStats(id),
      ]);
      const counts = await getExtendedDataCounts(id);
      setStore(storeData);
      setSyncRuns(runsData);
      setWebhooks(webhooksData);
      setWebhookEvents(eventsData);
      setWebhookStats(stats);
      setDataCounts(counts);
      setSyncInterval(storeData?.sync_interval?.toString() || "0");
      if (storeData) siteCache.set(id, { data: storeData, timestamp: Date.now() });

      const hasRunning = runsData.some(r => r.status === "running");
      if (hasRunning && !syncing) {
        setSyncing(true);
        const recent = runsData.slice(0, 6);
        const done = recent.filter(r => r.status === "completed" || r.status === "failed").length;
        const running = recent.find(r => r.status === "running");
        const total = recent.reduce((s, r) => s + (r.records_processed || 0), 0);
        setSyncProgress({
          current: Math.min(done, 6), total: 6,
          aspect: running ? `Syncing ${running.aspect}... (${total.toLocaleString()} records)` : "Syncing...",
        });
      } else if (!hasRunning && syncing) {
        const recent = runsData.slice(0, 6);
        const total = recent.reduce((s, r) => s + (r.records_processed || 0), 0);
        setSyncProgress({ current: 6, total: 6, aspect: `Done — ${total.toLocaleString()} records synced` });
        setTimeout(() => { setSyncing(false); setSyncProgress(null); }, 3000);
      }
    } catch (error) {
      console.error("Error loading site data:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadDataTab = async (tab: "products" | "orders" | "customers") => {
    if (!id || typeof id !== "string") return;
    setLoadingData(true);
    try {
      if (tab === "products") setProducts(await getProductsByStore(id));
      else if (tab === "orders") setOrders(await getOrdersByStore(id));
      else setCustomers(await getCustomersByStore(id));
    } catch (error) {
      console.error(`Error loading ${tab}:`, error);
    } finally {
      setLoadingData(false);
    }
  };

  const loadCronLogs = async () => {
    if (!id || typeof id !== "string") return;
    setLoadingLogs(true);
    try {
      const { data, error } = await supabase
        .from("cron_logs").select("*").eq("store_id", id)
        .order("started_at", { ascending: false }).limit(100);
      if (error) throw error;
      setCronLogs((data || []).map(log => ({ ...log, metadata: (log.metadata as Record<string, unknown>) || {} })));
    } catch (error) {
      console.error("Error loading cron logs:", error);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => { loadData(); }, [id]);
  useEffect(() => {
    if (!syncing || !id) return;
    const iv = setInterval(() => loadData(), 2000);
    return () => clearInterval(iv);
  }, [syncing, id]);
  useEffect(() => { if (id) loadDataTab(dataTab); }, [dataTab, id]);
  useEffect(() => { if (id) loadCronLogs(); }, [id]);

  const handleSyncAll = async () => {
    if (!store || syncing) return;
    setSyncing(true);
    setSyncProgress({ current: 0, total: 6, aspect: "Starting sync..." });
    syncAbortRef.current = false;
    try {
      const res = await fetch(`/api/stores/${store.id}/sync`, { method: "POST", headers: { "Content-Type": "application/json" } });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message || "Sync failed"); }
      const r = await res.json();
      setSyncProgress({
        current: 6, total: 6,
        aspect: `Done — ${r.totals?.processed?.toLocaleString() || 0} records (${r.totals?.created || 0} new, ${r.totals?.updated || 0} updated)`,
      });
      await loadData();
    } catch (error) {
      setSyncProgress({ current: 0, total: 6, aspect: error instanceof Error ? error.message : "Sync failed" });
    } finally {
      setTimeout(() => { setSyncing(false); setSyncProgress(null); }, 3000);
    }
  };

  const handleCancelSync = async () => {
    if (!store) return;
    syncAbortRef.current = true;
    try { await fetch(`/api/stores/${store.id}/sync`, { method: "PATCH" }); await loadData(); }
    catch (error) { console.error("Cancel error:", error); }
    finally { setSyncing(false); setSyncProgress(null); }
  };

  const handleSyncAspect = async (aspect: string) => {
    if (!store || syncing) return;
    setSyncing(true);
    setSyncProgress({ current: 0, total: 1, aspect: `Syncing ${aspect}...` });
    try {
      const res = await fetch(`/api/stores/${store.id}/sync`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ aspect }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message || "Sync failed"); }
      const r = await res.json();
      const ar = r.results?.[aspect];
      setSyncProgress({ current: 1, total: 1, aspect: `Done — ${ar?.processed?.toLocaleString() || 0} ${aspect} synced` });
      await loadData();
    } catch (error) {
      setSyncProgress({ current: 0, total: 1, aspect: error instanceof Error ? error.message : "Sync failed" });
    } finally {
      setTimeout(() => { setSyncing(false); setSyncProgress(null); }, 3000);
    }
  };

  const handleRegisterWebhooks = async () => {
    if (!store) return;
    try { await fetch(`/api/stores/${store.id}/register-webhooks`, { method: "POST" }); await loadData(); }
    catch (error) { console.error("Error registering webhooks:", error); }
  };

  const handleSaveSettings = async () => {
    if (!store) return;
    setSavingSettings(true);
    try {
      const interval = parseInt(syncInterval, 10);
      const nextSync = interval > 0 ? new Date(Date.now() + interval * 60 * 1000).toISOString() : null;
      await updateStore(store.id, { sync_interval: interval || null, next_sync_at: nextSync });
      await loadData();
    } finally { setSavingSettings(false); }
  };

  const handleDeleteStore = async () => {
    if (!store || deleteConfirmation !== store.name) return;
    setDeleting(true);
    try { await deleteStore(store.id); siteCache.delete(store.id); router.push("/projects"); }
    finally { setDeleting(false); }
  };

  const handleTriggerCron = async () => {
    setTriggeringCron(true); setCronResult(null);
    try {
      const res = await fetch("/api/cron/sync-scheduler");
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Trigger failed");
      const mine = data.results?.find((r: { store_id: string; status: string; records_processed?: number }) => r.store_id === store?.id);
      setCronResult(mine
        ? `Scheduler ran. This site: ${mine.status} (${mine.records_processed?.toLocaleString() || 0} records)`
        : `Scheduler ran but this site was not due yet (${data.stores_synced} store(s) processed). Next sync: ${store?.next_sync_at ? formatDate(store.next_sync_at) : "not scheduled"}.`);
      await loadData(); await loadCronLogs();
    } catch (err) {
      setCronResult(err instanceof Error ? err.message : "Failed to trigger scheduler");
    } finally { setTriggeringCron(false); }
  };

  const handleClearSyncHistory = async () => {
    if (!store) return;
    const { error } = await supabase.from("sync_runs").delete().eq("store_id", store.id);
    if (!error) { setSyncRuns([]); await loadData(); }
  };

  const copyToClipboard = (text: string) => navigator.clipboard.writeText(text);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed": case "active": return <CheckCircle2 className="h-4 w-4 text-success" />;
      case "failed": return <XCircle className="h-4 w-4 text-destructive" />;
      case "running": case "pending": return <RefreshCw className="h-4 w-4 text-primary animate-spin" />;
      default: return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const openDetail = (item: Product | Order | Customer, type: "product" | "order" | "customer") => {
    setSelectedItem(item); setDetailType(type);
  };

  const totalRecords = Object.values(dataCounts).reduce((a, b) => a + b, 0);

  if (loading) {
    return (
      <AppLayout title="Site">
        <div className="p-6 space-y-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-full max-w-2xl" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-80 w-full" />
        </div>
      </AppLayout>
    );
  }

  if (!store) {
    return (
      <AppLayout title="Site">
        <div className="p-6">
          <p className="text-muted-foreground">Site not found.</p>
          <Link href="/projects"><Button variant="outline" className="mt-4"><ArrowLeft className="h-4 w-4 mr-2" />Back to Sites</Button></Link>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Site">
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/projects"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold">{store.name}</h1>
              <StatusBadge variant={getStatusVariant(store.status)}>{store.status}</StatusBadge>
              <code className="text-xs bg-muted px-2 py-1 rounded font-mono flex items-center gap-1">
                {store.id.substring(0, 8).toUpperCase()}
                <button onClick={() => copyToClipboard(store.id)} className="hover:text-primary"><Copy className="h-3 w-3" /></button>
              </code>
            </div>
            <p className="text-sm text-muted-foreground">{store.url}</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="sync"><RefreshCw className="h-4 w-4 mr-2" />Sync Engine</TabsTrigger>
            <TabsTrigger value="data">
              <Database className="h-4 w-4 mr-2" />Data
              {totalRecords > 0 && <span className="ml-2 bg-primary/20 text-primary text-xs px-1.5 py-0.5 rounded-full">{totalRecords}</span>}
            </TabsTrigger>
            <TabsTrigger value="webhooks">
              Webhooks
              {webhookStats.active > 0 && <span className="ml-2 bg-success/20 text-success text-xs px-1.5 py-0.5 rounded-full">{webhookStats.active}</span>}
            </TabsTrigger>
            <TabsTrigger value="logs"><FileText className="h-4 w-4 mr-2" />Logs</TabsTrigger>
            <TabsTrigger value="history"><Clock className="h-4 w-4 mr-2" />History</TabsTrigger>
            <TabsTrigger value="archive"><Archive className="h-4 w-4 mr-2" />Deleted</TabsTrigger>
            <TabsTrigger value="settings"><Settings className="h-4 w-4 mr-2" />Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="sync" className="space-y-6">
            <SyncPanel
              store={store} syncing={syncing} syncProgress={syncProgress}
              dataCounts={dataCounts} syncRuns={syncRuns}
              onSyncAll={handleSyncAll} onCancelSync={handleCancelSync}
              onSyncAspect={handleSyncAspect} onClearHistory={handleClearSyncHistory}
              onSelectRun={setSelectedSyncRun} getStatusIcon={getStatusIcon}
            />
          </TabsContent>

          <TabsContent value="data" className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <Card className={`cursor-pointer transition-colors ${dataTab === "products" ? "ring-2 ring-primary" : ""}`} onClick={() => setDataTab("products")}>
                <CardContent className="p-4"><div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center"><Package className="h-5 w-5 text-primary" /></div>
                  <div><p className="text-2xl font-semibold">{dataCounts.products}</p><p className="text-xs text-muted-foreground">Products</p></div>
                </div></CardContent>
              </Card>
              <Card className={`cursor-pointer transition-colors ${dataTab === "orders" ? "ring-2 ring-primary" : ""}`} onClick={() => setDataTab("orders")}>
                <CardContent className="p-4"><div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center"><ShoppingCart className="h-5 w-5 text-success" /></div>
                  <div><p className="text-2xl font-semibold">{dataCounts.orders}</p><p className="text-xs text-muted-foreground">Orders</p></div>
                </div></CardContent>
              </Card>
              <Card className={`cursor-pointer transition-colors ${dataTab === "customers" ? "ring-2 ring-primary" : ""}`} onClick={() => setDataTab("customers")}>
                <CardContent className="p-4"><div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-warning/10 flex items-center justify-center"><Users className="h-5 w-5 text-warning" /></div>
                  <div><p className="text-2xl font-semibold">{dataCounts.customers}</p><p className="text-xs text-muted-foreground">Customers</p></div>
                </div></CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader><CardTitle className="text-lg capitalize">{dataTab}</CardTitle><CardDescription>Synced {dataTab} from WooCommerce</CardDescription></CardHeader>
              <CardContent className="p-0">
                {loadingData ? (
                  <div className="flex items-center justify-center py-8"><RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                ) : dataTab === "products" ? (
                  <Table>
                    <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>SKU</TableHead><TableHead>Price</TableHead><TableHead>Stock</TableHead><TableHead>Status</TableHead><TableHead>Synced</TableHead><TableHead></TableHead></TableRow></TableHeader>
                    <TableBody>
                      {products.length === 0 ? (
                        <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No products synced yet.</TableCell></TableRow>
                      ) : products.map((p) => (
                        <TableRow key={p.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openDetail(p, "product")}>
                          <TableCell className="font-medium max-w-[200px] truncate">{p.name}</TableCell>
                          <TableCell className="font-mono text-sm">{p.sku || "-"}</TableCell>
                          <TableCell>{formatCurrency(Number(p.price))}</TableCell>
                          <TableCell>{p.stock_quantity ?? "-"}</TableCell>
                          <TableCell><StatusBadge variant={p.status === "publish" ? "success" : "warning"}>{p.status}</StatusBadge></TableCell>
                          <TableCell className="text-muted-foreground">{formatRelativeTime(p.synced_at)}</TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}><Button variant="ghost" size="sm" onClick={() => openDetail(p, "product")}><Eye className="h-4 w-4" /></Button></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : dataTab === "orders" ? (
                  <Table>
                    <TableHeader><TableRow><TableHead>Order #</TableHead><TableHead>Status</TableHead><TableHead>Customer</TableHead><TableHead>Total</TableHead><TableHead>Date</TableHead><TableHead></TableHead></TableRow></TableHeader>
                    <TableBody>
                      {orders.length === 0 ? (
                        <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No orders synced yet.</TableCell></TableRow>
                      ) : orders.map((o) => (
                        <TableRow key={o.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openDetail(o, "order")}>
                          <TableCell className="font-mono">#{o.order_number || o.woo_id}</TableCell>
                          <TableCell><StatusBadge variant={getStatusVariant(o.status || "pending")}>{o.status}</StatusBadge></TableCell>
                          <TableCell>
                            {(o.billing as { first_name?: string; last_name?: string } | null)?.first_name || ""}{" "}
                            {(o.billing as { first_name?: string; last_name?: string } | null)?.last_name || "Guest"}
                          </TableCell>
                          <TableCell>{formatCurrency(Number(o.total), o.currency || "USD")}</TableCell>
                          <TableCell className="text-muted-foreground">{formatDate(o.date_created)}</TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}><Button variant="ghost" size="sm" onClick={() => openDetail(o, "order")}><Eye className="h-4 w-4" /></Button></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <Table>
                    <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Orders</TableHead><TableHead>Total Spent</TableHead><TableHead>Joined</TableHead><TableHead></TableHead></TableRow></TableHeader>
                    <TableBody>
                      {customers.length === 0 ? (
                        <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No customers synced yet.</TableCell></TableRow>
                      ) : customers.map((c) => (
                        <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openDetail(c, "customer")}>
                          <TableCell className="font-medium">{c.first_name} {c.last_name}</TableCell>
                          <TableCell className="text-muted-foreground">{c.email}</TableCell>
                          <TableCell>{c.orders_count ?? 0}</TableCell>
                          <TableCell>{formatCurrency(Number(c.total_spent))}</TableCell>
                          <TableCell className="text-muted-foreground">{formatDate(c.date_created)}</TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}><Button variant="ghost" size="sm" onClick={() => openDetail(c, "customer")}><Eye className="h-4 w-4" /></Button></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="webhooks" className="space-y-6">
            <WebhookPanel
              store={store} webhooks={webhooks} webhookEvents={webhookEvents}
              webhookStats={webhookStats} onRegister={handleRegisterWebhooks}
              getStatusIcon={getStatusIcon}
            />
          </TabsContent>

          <TabsContent value="logs" className="space-y-6">
            <LogsPanel cronLogs={cronLogs} loadingLogs={loadingLogs} onRefresh={loadCronLogs} />
          </TabsContent>

          <TabsContent value="history" className="space-y-6">
            <Card>
              <CardHeader><CardTitle className="text-lg">Entity Change History</CardTitle><CardDescription>All tracked changes from webhooks and syncs</CardDescription></CardHeader>
              <CardContent><EntityHistory storeId={store.id} title="All Changes" /></CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="archive" className="space-y-6">
            <DeletedRecordsArchive storeId={store.id} />
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardHeader><CardTitle className="text-lg">Connection Details</CardTitle><CardDescription>API connection and sync configuration</CardDescription></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><p className="text-sm font-medium">Store URL</p><p className="text-sm text-muted-foreground">{store.url}</p></div>
                  <div><p className="text-sm font-medium">API Status</p><StatusBadge variant={store.consumer_key ? "success" : "warning"}>{store.consumer_key ? "Connected" : "Not Connected"}</StatusBadge></div>
                  <div><p className="text-sm font-medium">Last Sync</p><p className="text-sm text-muted-foreground">{store.last_sync_at ? formatDate(store.last_sync_at) : "Never"}</p></div>
                  <div><p className="text-sm font-medium">Created</p><p className="text-sm text-muted-foreground">{formatDate(store.created_at)}</p></div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-lg">Scheduled Sync</CardTitle><CardDescription>Configure automatic data synchronization</CardDescription></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="sync-interval">Sync Interval</Label>
                  <Select value={syncInterval} onValueChange={setSyncInterval}>
                    <SelectTrigger id="sync-interval" className="w-full max-w-xs"><SelectValue placeholder="Select interval" /></SelectTrigger>
                    <SelectContent>
                      {SYNC_INTERVALS.map((i) => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Data will sync automatically at this interval.</p>
                </div>

                {store.next_sync_at && parseInt(syncInterval) > 0 && (() => {
                  const nextSync = new Date(store.next_sync_at).getTime();
                  const now = Date.now();
                  const overdue = nextSync < now;
                  const mins = Math.floor((now - nextSync) / 60000);
                  const last = cronLogs[0];
                  return (
                    <div className={`rounded-lg p-3 space-y-2 ${overdue ? "bg-warning/10 border border-warning/30" : "bg-muted/50"}`}>
                      <div className="flex items-start gap-2">
                        {overdue ? <AlertTriangle className="h-4 w-4 text-warning mt-0.5" /> : <Clock className="h-4 w-4 text-muted-foreground mt-0.5" />}
                        <div className="flex-1 text-sm space-y-1">
                          <p>
                            <span className="font-medium">Next scheduled sync:</span>{" "}
                            <span className={overdue ? "text-warning font-medium" : "text-muted-foreground"}>
                              {formatDate(store.next_sync_at)}{overdue && ` (overdue by ${mins}m)`}
                            </span>
                          </p>
                          {last && <p className="text-xs text-muted-foreground">Last scheduler run: <span className="font-medium">{formatRelativeTime(last.started_at)}</span> ({last.status})</p>}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                <div className="flex items-center gap-2">
                  <Button onClick={handleSaveSettings} disabled={savingSettings}>
                    {savingSettings ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Settings className="h-4 w-4 mr-2" />}Save Settings
                  </Button>
                  <Button variant="outline" onClick={handleTriggerCron} disabled={triggeringCron}>
                    {triggeringCron ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Zap className="h-4 w-4 mr-2" />}Run Scheduler Now
                  </Button>
                </div>

                {cronResult && <div className="bg-muted/50 rounded-lg p-3 text-sm">{cronResult}</div>}
              </CardContent>
            </Card>

            <Card className="border-destructive/50">
              <CardHeader>
                <CardTitle className="text-lg text-destructive flex items-center gap-2"><AlertTriangle className="h-5 w-5" />Danger Zone</CardTitle>
                <CardDescription>Irreversible actions. Proceed with caution.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-destructive/10 rounded-lg p-4 space-y-4">
                  <div>
                    <p className="font-medium text-destructive">Delete this site</p>
                    <p className="text-sm text-muted-foreground">This will permanently delete the site and all associated data.</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="delete-confirm" className="text-destructive">Type <strong>{store.name}</strong> to confirm</Label>
                    <Input id="delete-confirm" value={deleteConfirmation} onChange={(e) => setDeleteConfirmation(e.target.value)} placeholder={store.name} className="max-w-xs" />
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" disabled={deleteConfirmation !== store.name || deleting}>
                        {deleting ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}Delete Site
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. This will permanently delete <strong>{store.name}</strong> and remove all associated data.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteStore} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                          Yes, delete permanently
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={!!selectedSyncRun} onOpenChange={() => setSelectedSyncRun(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="capitalize">{selectedSyncRun?.aspect} Sync Details</DialogTitle>
            <DialogDescription>Full sync run information</DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><p className="text-sm font-medium">Status</p><StatusBadge variant={getStatusVariant(selectedSyncRun?.status || "pending")}>{selectedSyncRun?.status}</StatusBadge></div>
              <div><p className="text-sm font-medium">Records Processed</p><p className="text-sm text-muted-foreground">{selectedSyncRun?.records_processed || 0}</p></div>
              <div><p className="text-sm font-medium">Records Created</p><p className="text-sm text-muted-foreground">{selectedSyncRun?.records_created || 0}</p></div>
              <div><p className="text-sm font-medium">Records Updated</p><p className="text-sm text-muted-foreground">{selectedSyncRun?.records_updated || 0}</p></div>
              <div><p className="text-sm font-medium">Started</p><p className="text-sm text-muted-foreground">{formatDate(selectedSyncRun?.started_at || null)}</p></div>
              <div><p className="text-sm font-medium">Completed</p><p className="text-sm text-muted-foreground">{formatDate(selectedSyncRun?.completed_at || null)}</p></div>
            </div>
            {selectedSyncRun?.error_message && (
              <div className="bg-destructive/10 rounded-lg p-3">
                <p className="text-sm font-medium text-destructive">Error Message</p>
                <p className="text-sm text-destructive">{selectedSyncRun.error_message}</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedItem} onOpenChange={() => setSelectedItem(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="capitalize">{detailType} Details</DialogTitle>
            <DialogDescription>Complete synced data from WooCommerce</DialogDescription>
          </DialogHeader>
          <div className="mt-4"><JsonTableView data={selectedItem} /></div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}