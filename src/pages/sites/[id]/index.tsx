import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { supabase } from "@/integrations/supabase/client";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Zap,
  AlertCircle,
  Eye,
  Settings,
  Database,
  FileText,
  Timer,
  Trash2,
  Square,
  Copy,
  AlertTriangle,
} from "lucide-react";
import { getStore, updateStore, updateStoreStatus, deleteStore, type Store } from "@/services/storeService";
import {
  getSyncRunsByStore,
  createSyncRun,
  completeSyncRun,
  getProductsByStore,
  getOrdersByStore,
  getCustomersByStore,
  getDataCounts,
  type SyncRun,
  type Product,
  type Order,
  type Customer,
} from "@/services/syncService";
import {
  getWebhooksByStore,
  getWebhookEventsByStore,
  getWebhookStats,
  type Webhook as WebhookType,
  type WebhookEventRow,
} from "@/services/webhookService";

const SYNC_ASPECTS = [
  { id: "products", label: "Products", icon: Package },
  { id: "orders", label: "Orders", icon: ShoppingCart },
  { id: "customers", label: "Customers", icon: Users },
  { id: "categories", label: "Categories", icon: Layers },
  { id: "coupons", label: "Coupons", icon: Ticket },
  { id: "tags", label: "Tags", icon: Tag },
] as const;

const SYNC_INTERVALS = [
  { value: "0", label: "Manual only" },
  { value: "15", label: "Every 15 minutes" },
  { value: "30", label: "Every 30 minutes" },
  { value: "60", label: "Every hour" },
  { value: "360", label: "Every 6 hours" },
  { value: "720", label: "Every 12 hours" },
  { value: "1440", label: "Every 24 hours" },
];

// Simple cache for site data
const siteCache = new Map<string, { data: Store; timestamp: number }>();
const CACHE_TTL = 30000; // 30 seconds

export default function SiteWorkspacePage() {
  const router = useRouter();
  const { id } = router.query;
  const [store, setStore] = useState<Store | null>(null);
  const [syncRuns, setSyncRuns] = useState<SyncRun[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookType[]>([]);
  const [webhookEvents, setWebhookEvents] = useState<WebhookEventRow[]>([]);
  const [webhookStats, setWebhookStats] = useState({ total: 0, active: 0, failed: 0, eventsToday: 0 });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [registeringWebhooks, setRegisteringWebhooks] = useState(false);
  
  // Data tab state
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [dataCounts, setDataCounts] = useState({ products: 0, orders: 0, customers: 0 });
  const [dataTab, setDataTab] = useState<"products" | "orders" | "customers">("products");
  const [loadingData, setLoadingData] = useState(false);
  
  // Logs state
  const [cronLogs, setCronLogs] = useState<{
    id: string;
    job_type: string;
    store_id: string | null;
    status: string;
    message: string | null;
    error_message: string | null;
    started_at: string;
    completed_at: string | null;
    metadata: Record<string, unknown>;
  }[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  
  // Detail modal state
  const [selectedItem, setSelectedItem] = useState<Product | Order | Customer | null>(null);
  const [detailType, setDetailType] = useState<"product" | "order" | "customer" | null>(null);
  
  // Sync run detail modal
  const [selectedSyncRun, setSelectedSyncRun] = useState<SyncRun | null>(null);
  
  // Settings state
  const [syncInterval, setSyncInterval] = useState<string>("0");
  const [savingSettings, setSavingSettings] = useState(false);
  
  // Delete state
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);

  const loadData = async () => {
    if (!id || typeof id !== "string") return;
    
    // Check cache first
    const cached = siteCache.get(id);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      setStore(cached.data);
    }
    
    setLoading(true);
    try {
      const [storeData, runsData, webhooksData, eventsData, stats, counts] = await Promise.all([
        getStore(id),
        getSyncRunsByStore(id),
        getWebhooksByStore(id),
        getWebhookEventsByStore(id, 50),
        getWebhookStats(id),
        getDataCounts(id),
      ]);
      setStore(storeData);
      setSyncRuns(runsData);
      setWebhooks(webhooksData);
      setWebhookEvents(eventsData);
      setWebhookStats(stats);
      setDataCounts(counts);
      setSyncInterval(storeData?.sync_interval?.toString() || "0");
      
      // Update cache
      if (storeData) {
        siteCache.set(id, { data: storeData, timestamp: Date.now() });
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
      switch (tab) {
        case "products":
          const productsData = await getProductsByStore(id);
          setProducts(productsData);
          break;
        case "orders":
          const ordersData = await getOrdersByStore(id);
          setOrders(ordersData);
          break;
        case "customers":
          const customersData = await getCustomersByStore(id);
          setCustomers(customersData);
          break;
      }
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
        .from("cron_logs")
        .select("*")
        .eq("store_id", id)
        .order("started_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      setCronLogs((data || []).map(log => ({
        ...log,
        metadata: (log.metadata as Record<string, unknown>) || {}
      })));
    } catch (error) {
      console.error("Error loading cron logs:", error);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  useEffect(() => {
    if (id) {
      loadDataTab(dataTab);
    }
  }, [dataTab, id]);

  useEffect(() => {
    if (id) {
      loadCronLogs();
    }
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

  const handleStopSync = async (runId: string) => {
    try {
      const { error } = await supabase
        .from("sync_runs")
        .update({
          status: "failed",
          error_message: "Manually stopped by user",
          completed_at: new Date().toISOString(),
        })
        .eq("id", runId);

      if (error) throw error;
      
      if (store) {
        await updateStoreStatus(store.id, "connected");
      }
      
      await loadData();
    } catch (error) {
      console.error("Error stopping sync:", error);
    }
  };

  const handleRegisterWebhooks = async () => {
    if (!store) return;
    setRegisteringWebhooks(true);
    try {
      const response = await fetch(`/api/stores/${store.id}/register-webhooks`, {
        method: "POST",
      });
      const result = await response.json();
      console.log("Webhook registration result:", result);
      await loadData();
    } catch (error) {
      console.error("Error registering webhooks:", error);
    } finally {
      setRegisteringWebhooks(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!store) return;
    setSavingSettings(true);
    try {
      const interval = parseInt(syncInterval, 10);
      const nextSync = interval > 0 
        ? new Date(Date.now() + interval * 60 * 1000).toISOString()
        : null;
      
      await updateStore(store.id, {
        sync_interval: interval || null,
        next_sync_at: nextSync,
      });
      
      await loadData();
    } catch (error) {
      console.error("Error saving settings:", error);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleDeleteStore = async () => {
    if (!store || deleteConfirmation !== store.name) return;
    setDeleting(true);
    try {
      await deleteStore(store.id);
      siteCache.delete(store.id);
      router.push("/sites");
    } catch (error) {
      console.error("Error deleting store:", error);
    } finally {
      setDeleting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const formatDuration = (start: string, end: string | null) => {
    if (!end) return "Running...";
    const ms = new Date(end).getTime() - new Date(start).getTime();
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
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

  const formatCurrency = (amount: number | null, currency = "USD") => {
    if (amount === null) return "-";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(amount);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
      case "active":
        return <CheckCircle2 className="h-4 w-4 text-success" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-destructive" />;
      case "running":
      case "pending":
        return <RefreshCw className="h-4 w-4 text-primary animate-spin" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getWebhookStatusVariant = (status: string) => {
    switch (status) {
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

  const openDetail = (item: Product | Order | Customer, type: "product" | "order" | "customer") => {
    setSelectedItem(item);
    setDetailType(type);
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
              <code className="text-xs bg-muted px-2 py-1 rounded font-mono flex items-center gap-1">
                {store.id.substring(0, 8).toUpperCase()}
                <button onClick={() => copyToClipboard(store.id)} className="hover:text-primary">
                  <Copy className="h-3 w-3" />
                </button>
              </code>
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
            <TabsTrigger value="data" className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              Data
              {dataCounts.products + dataCounts.orders + dataCounts.customers > 0 && (
                <span className="bg-primary/20 text-primary text-xs px-1.5 py-0.5 rounded-full">
                  {dataCounts.products + dataCounts.orders + dataCounts.customers}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="webhooks" className="flex items-center gap-2">
              Webhooks
              {webhookStats.active > 0 && (
                <span className="bg-success/20 text-success text-xs px-1.5 py-0.5 rounded-full">
                  {webhookStats.active}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="logs" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Logs
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
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
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {syncRuns.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No sync runs yet. Click a sync button to start.
                        </TableCell>
                      </TableRow>
                    ) : (
                      syncRuns.slice(0, 20).map((run) => (
                        <TableRow 
                          key={run.id} 
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => setSelectedSyncRun(run)}
                        >
                          <TableCell className="font-medium capitalize">{run.aspect}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getStatusIcon(run.status || "pending")}
                              <span className="capitalize">{run.status}</span>
                            </div>
                          </TableCell>
                          <TableCell>{run.records_processed || "-"}</TableCell>
                          <TableCell className="font-mono text-sm">
                            {formatDuration(run.started_at || "", run.completed_at)}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatDate(run.started_at)}
                          </TableCell>
                          <TableCell>
                            {run.status === "running" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-destructive hover:text-destructive"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStopSync(run.id);
                                }}
                              >
                                <Square className="h-3 w-3 mr-1" />
                                Stop
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="data" className="space-y-6">
            {/* Data Stats */}
            <div className="grid grid-cols-3 gap-4">
              <Card 
                className={`cursor-pointer transition-colors ${dataTab === "products" ? "ring-2 ring-primary" : ""}`}
                onClick={() => setDataTab("products")}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Package className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-2xl font-semibold">{dataCounts.products}</p>
                      <p className="text-xs text-muted-foreground">Products</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card 
                className={`cursor-pointer transition-colors ${dataTab === "orders" ? "ring-2 ring-primary" : ""}`}
                onClick={() => setDataTab("orders")}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center">
                      <ShoppingCart className="h-5 w-5 text-success" />
                    </div>
                    <div>
                      <p className="text-2xl font-semibold">{dataCounts.orders}</p>
                      <p className="text-xs text-muted-foreground">Orders</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card 
                className={`cursor-pointer transition-colors ${dataTab === "customers" ? "ring-2 ring-primary" : ""}`}
                onClick={() => setDataTab("customers")}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-warning/10 flex items-center justify-center">
                      <Users className="h-5 w-5 text-warning" />
                    </div>
                    <div>
                      <p className="text-2xl font-semibold">{dataCounts.customers}</p>
                      <p className="text-xs text-muted-foreground">Customers</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Data Table */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg capitalize">{dataTab}</CardTitle>
                <CardDescription>Synced {dataTab} from WooCommerce</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {loadingData ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : dataTab === "products" ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>Stock</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Synced</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {products.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                            No products synced yet. Run a products sync to fetch data.
                          </TableCell>
                        </TableRow>
                      ) : (
                        products.map((product) => (
                          <TableRow key={product.id}>
                            <TableCell className="font-medium">{product.name}</TableCell>
                            <TableCell className="font-mono text-sm">{product.sku || "-"}</TableCell>
                            <TableCell>{formatCurrency(Number(product.price))}</TableCell>
                            <TableCell>{product.stock_quantity ?? "-"}</TableCell>
                            <TableCell>
                              <StatusBadge variant={product.status === "publish" ? "success" : "warning"}>
                                {product.status}
                              </StatusBadge>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {formatRelativeTime(product.synced_at)}
                            </TableCell>
                            <TableCell>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => openDetail(product, "product")}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                ) : dataTab === "orders" ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Order #</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orders.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            No orders synced yet. Run an orders sync to fetch data.
                          </TableCell>
                        </TableRow>
                      ) : (
                        orders.map((order) => (
                          <TableRow key={order.id}>
                            <TableCell className="font-mono">#{order.order_number || order.woo_id}</TableCell>
                            <TableCell>
                              <StatusBadge variant={getStatusVariant(order.status || "pending")}>
                                {order.status}
                              </StatusBadge>
                            </TableCell>
                            <TableCell>
                              {(order.billing as { first_name?: string; last_name?: string } | null)?.first_name || ""}{" "}
                              {(order.billing as { first_name?: string; last_name?: string } | null)?.last_name || "Guest"}
                            </TableCell>
                            <TableCell>{formatCurrency(Number(order.total), order.currency || "USD")}</TableCell>
                            <TableCell className="text-muted-foreground">
                              {formatDate(order.date_created)}
                            </TableCell>
                            <TableCell>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => openDetail(order, "order")}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Orders</TableHead>
                        <TableHead>Total Spent</TableHead>
                        <TableHead>Joined</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {customers.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            No customers synced yet. Run a customers sync to fetch data.
                          </TableCell>
                        </TableRow>
                      ) : (
                        customers.map((customer) => (
                          <TableRow key={customer.id}>
                            <TableCell className="font-medium">
                              {customer.first_name} {customer.last_name}
                            </TableCell>
                            <TableCell className="text-muted-foreground">{customer.email}</TableCell>
                            <TableCell>{customer.orders_count ?? 0}</TableCell>
                            <TableCell>{formatCurrency(Number(customer.total_spent))}</TableCell>
                            <TableCell className="text-muted-foreground">
                              {formatDate(customer.date_created)}
                            </TableCell>
                            <TableCell>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => openDetail(customer, "customer")}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="webhooks" className="space-y-6">
            {/* Webhook Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                      <Webhook className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-2xl font-semibold">{webhookStats.total}</p>
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
                      <p className="text-2xl font-semibold">{webhookStats.active}</p>
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
                      <p className="text-2xl font-semibold">{webhookStats.failed}</p>
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
                      <p className="text-2xl font-semibold">{webhookStats.eventsToday}</p>
                      <p className="text-xs text-muted-foreground">Events Today</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Registered Webhooks */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Registered Webhooks</CardTitle>
                    <CardDescription>Real-time event subscriptions from WooCommerce</CardDescription>
                  </div>
                  <Button
                    onClick={handleRegisterWebhooks}
                    disabled={registeringWebhooks || !store.consumer_key}
                  >
                    {registeringWebhooks ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Webhook className="h-4 w-4 mr-2" />
                    )}
                    {webhooks.length > 0 ? "Repair Webhooks" : "Register Webhooks"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {!store.consumer_key ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>Store not connected</p>
                    <p className="text-sm">Complete OAuth setup to register webhooks</p>
                  </div>
                ) : webhooks.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Webhook className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No webhooks registered yet</p>
                    <p className="text-sm">Click &quot;Register Webhooks&quot; to set up real-time sync</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Topic</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Last Triggered</TableHead>
                        <TableHead>Failures</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {webhooks.map((webhook) => (
                        <TableRow key={webhook.id}>
                          <TableCell>
                            <code className="text-sm bg-muted px-1.5 py-0.5 rounded">
                              {webhook.topic}
                            </code>
                          </TableCell>
                          <TableCell>
                            <StatusBadge variant={getWebhookStatusVariant(webhook.status || "pending")}>
                              {webhook.status}
                            </StatusBadge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatRelativeTime(webhook.last_triggered_at)}
                          </TableCell>
                          <TableCell>
                            {webhook.failure_count && webhook.failure_count > 0 ? (
                              <span className="text-destructive">{webhook.failure_count}</span>
                            ) : (
                              <span className="text-muted-foreground">0</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Webhook Events */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Recent Events</CardTitle>
                <CardDescription>Incoming webhook events from WooCommerce</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {webhookEvents.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Zap className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No webhook events received yet</p>
                    <p className="text-sm">Events will appear here when WooCommerce sends updates</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Topic</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Received</TableHead>
                        <TableHead>Processed</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {webhookEvents.slice(0, 20).map((event) => (
                        <TableRow key={event.id}>
                          <TableCell>
                            <code className="text-sm bg-muted px-1.5 py-0.5 rounded">
                              {event.topic}
                            </code>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getStatusIcon(event.processing_status || "pending")}
                              <span className="capitalize">{event.processing_status || "pending"}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatDate(event.created_at)}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {event.processed_at ? formatDate(event.processed_at) : "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="logs" className="space-y-6">
            {/* Logs Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                      <Timer className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-2xl font-semibold">{cronLogs.length}</p>
                      <p className="text-xs text-muted-foreground">Total Jobs</p>
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
                      <p className="text-2xl font-semibold">
                        {cronLogs.filter((l) => l.status === "completed").length}
                      </p>
                      <p className="text-xs text-muted-foreground">Completed</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                      <XCircle className="h-5 w-5 text-destructive" />
                    </div>
                    <div>
                      <p className="text-2xl font-semibold">
                        {cronLogs.filter((l) => l.status === "failed").length}
                      </p>
                      <p className="text-xs text-muted-foreground">Failed</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <RefreshCw className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-2xl font-semibold">
                        {cronLogs.filter((l) => l.status === "started").length}
                      </p>
                      <p className="text-xs text-muted-foreground">Running</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Cron Job History */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Scheduled Sync Jobs</CardTitle>
                    <CardDescription>History of automated sync executions</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={loadCronLogs} disabled={loadingLogs}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${loadingLogs ? "animate-spin" : ""}`} />
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {loadingLogs ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : cronLogs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Timer className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No scheduled sync jobs yet</p>
                    <p className="text-sm">Configure a sync interval in Settings to enable automatic syncing</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Job Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Message</TableHead>
                        <TableHead>Started</TableHead>
                        <TableHead>Duration</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cronLogs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell>
                            <code className="text-sm bg-muted px-1.5 py-0.5 rounded">
                              {log.job_type}
                            </code>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {log.status === "completed" && <CheckCircle2 className="h-4 w-4 text-success" />}
                              {log.status === "failed" && <XCircle className="h-4 w-4 text-destructive" />}
                              {log.status === "started" && <RefreshCw className="h-4 w-4 text-primary animate-spin" />}
                              <StatusBadge
                                variant={
                                  log.status === "completed"
                                    ? "success"
                                    : log.status === "failed"
                                    ? "error"
                                    : "pending"
                                }
                              >
                                {log.status}
                              </StatusBadge>
                            </div>
                          </TableCell>
                          <TableCell className="max-w-xs">
                            <p className="truncate text-sm">
                              {log.error_message || log.message || "-"}
                            </p>
                            {log.error_message && (
                              <p className="text-xs text-destructive truncate">{log.error_message}</p>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatDate(log.started_at)}
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {log.completed_at
                              ? formatDuration(log.started_at, log.completed_at)
                              : "Running..."}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Error Logs */}
            {cronLogs.filter((l) => l.status === "failed").length > 0 && (
              <Card className="border-destructive/50">
                <CardHeader>
                  <CardTitle className="text-lg text-destructive flex items-center gap-2">
                    <AlertCircle className="h-5 w-5" />
                    Error Logs
                  </CardTitle>
                  <CardDescription>Recent sync failures and errors</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Time</TableHead>
                        <TableHead>Job Type</TableHead>
                        <TableHead>Error Message</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cronLogs
                        .filter((l) => l.status === "failed")
                        .slice(0, 10)
                        .map((log) => (
                          <TableRow key={log.id}>
                            <TableCell className="text-muted-foreground">
                              {formatDate(log.started_at)}
                            </TableCell>
                            <TableCell>
                              <code className="text-sm bg-muted px-1.5 py-0.5 rounded">
                                {log.job_type}
                              </code>
                            </TableCell>
                            <TableCell className="text-destructive">
                              {log.error_message || "Unknown error"}
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Connection Details</CardTitle>
                <CardDescription>API connection and sync configuration</CardDescription>
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
                      {store.consumer_key ? "Connected" : "Not Connected"}
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

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Scheduled Sync</CardTitle>
                <CardDescription>Configure automatic data synchronization</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="sync-interval">Sync Interval</Label>
                  <Select value={syncInterval} onValueChange={setSyncInterval}>
                    <SelectTrigger id="sync-interval" className="w-full max-w-xs">
                      <SelectValue placeholder="Select interval" />
                    </SelectTrigger>
                    <SelectContent>
                      {SYNC_INTERVALS.map((interval) => (
                        <SelectItem key={interval.value} value={interval.value}>
                          {interval.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Even without webhook events, data will sync at this interval.
                  </p>
                </div>

                {store.next_sync_at && parseInt(syncInterval) > 0 && (
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-sm">
                      <span className="font-medium">Next scheduled sync:</span>{" "}
                      <span className="text-muted-foreground">{formatDate(store.next_sync_at)}</span>
                    </p>
                  </div>
                )}

                <Button onClick={handleSaveSettings} disabled={savingSettings}>
                  {savingSettings ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Settings className="h-4 w-4 mr-2" />
                  )}
                  Save Settings
                </Button>
              </CardContent>
            </Card>

            {/* Danger Zone */}
            <Card className="border-destructive/50">
              <CardHeader>
                <CardTitle className="text-lg text-destructive flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Danger Zone
                </CardTitle>
                <CardDescription>
                  Irreversible actions. Proceed with caution.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-destructive/10 rounded-lg p-4 space-y-4">
                  <div>
                    <p className="font-medium text-destructive">Delete this site</p>
                    <p className="text-sm text-muted-foreground">
                      This will permanently delete the site and all associated data including:
                    </p>
                    <ul className="text-sm text-muted-foreground list-disc list-inside mt-2">
                      <li>All synced products, orders, and customers</li>
                      <li>All sync run history</li>
                      <li>All registered webhooks and events</li>
                      <li>All cron job logs</li>
                    </ul>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="delete-confirm" className="text-destructive">
                      Type <strong>{store.name}</strong> to confirm deletion
                    </Label>
                    <Input
                      id="delete-confirm"
                      value={deleteConfirmation}
                      onChange={(e) => setDeleteConfirmation(e.target.value)}
                      placeholder={store.name}
                      className="max-w-xs"
                    />
                  </div>
                  
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="destructive"
                        disabled={deleteConfirmation !== store.name || deleting}
                      >
                        {deleting ? (
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4 mr-2" />
                        )}
                        Delete Site
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. This will permanently delete{" "}
                          <strong>{store.name}</strong> and remove all associated data from our servers.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDeleteStore}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
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

      {/* Sync Run Detail Modal */}
      <Dialog open={!!selectedSyncRun} onOpenChange={() => setSelectedSyncRun(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="capitalize">
              {selectedSyncRun?.aspect} Sync Details
            </DialogTitle>
            <DialogDescription>
              Full sync run information and metadata
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium">Status</p>
                <StatusBadge variant={getStatusVariant(selectedSyncRun?.status || "pending")}>
                  {selectedSyncRun?.status}
                </StatusBadge>
              </div>
              <div>
                <p className="text-sm font-medium">Records Processed</p>
                <p className="text-sm text-muted-foreground">{selectedSyncRun?.records_processed || 0}</p>
              </div>
              <div>
                <p className="text-sm font-medium">Records Created</p>
                <p className="text-sm text-muted-foreground">{selectedSyncRun?.records_created || 0}</p>
              </div>
              <div>
                <p className="text-sm font-medium">Records Updated</p>
                <p className="text-sm text-muted-foreground">{selectedSyncRun?.records_updated || 0}</p>
              </div>
              <div>
                <p className="text-sm font-medium">Started</p>
                <p className="text-sm text-muted-foreground">{formatDate(selectedSyncRun?.started_at || null)}</p>
              </div>
              <div>
                <p className="text-sm font-medium">Completed</p>
                <p className="text-sm text-muted-foreground">{formatDate(selectedSyncRun?.completed_at || null)}</p>
              </div>
            </div>
            {selectedSyncRun?.error_message && (
              <div className="bg-destructive/10 rounded-lg p-3">
                <p className="text-sm font-medium text-destructive">Error Message</p>
                <p className="text-sm text-destructive">{selectedSyncRun.error_message}</p>
              </div>
            )}
            <div>
              <p className="text-sm font-medium mb-2">Raw Data</p>
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs font-mono">
                {JSON.stringify(selectedSyncRun, null, 2)}
              </pre>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail Modal */}
      <Dialog open={!!selectedItem} onOpenChange={() => setSelectedItem(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="capitalize">{detailType} Details</DialogTitle>
            <DialogDescription>
              Complete synced data from WooCommerce
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs font-mono">
              {JSON.stringify(selectedItem, null, 2)}
            </pre>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}