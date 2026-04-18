import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/router";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatusBadge, getStatusVariant } from "@/components/ui/status-badge";
import { Plus, Search, Store, ExternalLink, Eye, EyeOff, Heart, AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { getStores, getStore, createStore, type StoreWithClient } from "@/services/storeService";
import { getClients, type Client } from "@/services/clientService";
import { buildWooCommerceAuthUrl, validateStoreUrl, cleanStoreUrl } from "@/lib/woocommerce-auth";
import { browserCache, CACHE_KEYS, CACHE_TTL } from "@/lib/cache";
import { useAuth } from "@/contexts/AuthProvider";

export default function SitesPage() {
  const router = useRouter();
  const { isSuperAdmin } = useAuth();
  const [stores, setStores] = useState<StoreWithClient[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<"oauth" | "manual">("oauth");
  const [showSecrets, setShowSecrets] = useState(false);
  
  const [newStore, setNewStore] = useState({
    name: "",
    url: "",
    consumer_key: "",
    consumer_secret: "",
    client_id: "",
  });

  // Cache-first data loading
  const loadData = useCallback(async (forceRefresh = false) => {
    const cachedStores = browserCache.get<StoreWithClient[]>(CACHE_KEYS.STORES);
    const cachedClients = browserCache.get<Client[]>(CACHE_KEYS.CLIENTS);

    if (cachedStores && cachedClients && !forceRefresh) {
      setStores(cachedStores);
      setClients(cachedClients);
      Promise.all([getStores(), getClients()]).then(([freshStores, freshClients]) => {
        browserCache.set(CACHE_KEYS.STORES, freshStores, CACHE_TTL.MEDIUM);
        browserCache.set(CACHE_KEYS.CLIENTS, freshClients, CACHE_TTL.MEDIUM);
        setStores(freshStores);
        setClients(freshClients);
      }).catch(console.error);
      return;
    }

    setLoading(true);
    const timeoutId = setTimeout(() => {
      console.warn("[Sites] load timeout — releasing loading state");
      setLoading(false);
    }, 8000);

    try {
      const [storesData, clientsData] = await Promise.all([
        getStores(),
        getClients(),
      ]);
      clearTimeout(timeoutId);
      setStores(storesData);
      setClients(clientsData);
      browserCache.set(CACHE_KEYS.STORES, storesData, CACHE_TTL.MEDIUM);
      browserCache.set(CACHE_KEYS.CLIENTS, clientsData, CACHE_TTL.MEDIUM);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  }, []);

  // Prefetch a specific store's data on hover
  const prefetchStore = useCallback((storeId: string) => {
    const cacheKey = CACHE_KEYS.store(storeId);
    if (!browserCache.has(cacheKey)) {
      browserCache.prefetch(cacheKey, () => getStore(storeId), CACHE_TTL.MEDIUM);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const onFocus = () => loadData(true);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [loadData]);

  const handleCreateStore = async () => {
    if (!newStore.name.trim() || !newStore.url.trim()) return;
    
    const validation = validateStoreUrl(newStore.url);
    if (!validation.valid) {
      setUrlError(validation.error || "Invalid URL");
      return;
    }
    
    const cleanedUrl = validation.cleanedUrl || cleanStoreUrl(newStore.url);
    setUrlError(null);
    
    setCreating(true);
    console.log("[AddSite] Starting create with:", { name: newStore.name, url: cleanedUrl, authMode });
    try {
      const store = await createStore({
        name: newStore.name.trim(),
        url: cleanedUrl,
        consumer_key: authMode === "manual" ? newStore.consumer_key.trim() || null : null,
        consumer_secret: authMode === "manual" ? newStore.consumer_secret.trim() || null : null,
        client_id: newStore.client_id || null,
        status: authMode === "manual" && newStore.consumer_key && newStore.consumer_secret ? "connected" : "pending",
      });
      console.log("[AddSite] Store created:", store);

      // Invalidate cache
      browserCache.delete(CACHE_KEYS.STORES);

      if (authMode === "oauth") {
        const authUrl = buildWooCommerceAuthUrl({
          storeUrl: cleanedUrl,
          storeId: store.id,
        });
        console.log("[AddSite] Redirecting to:", authUrl);
        window.location.href = authUrl;
      } else {
        setNewStore({ name: "", url: "", consumer_key: "", consumer_secret: "", client_id: "" });
        setDialogOpen(false);
        await loadData(true);

        // Auto-trigger initial sync + webhook registration for manual key stores
        if (newStore.consumer_key && newStore.consumer_secret) {
          triggerInitialSync(store.id);
        }
      }
    } catch (error) {
      console.error("[AddSite] Error creating store:", error);
      alert(`Error creating store: ${error instanceof Error ? error.message : JSON.stringify(error)}`);
    } finally {
      setCreating(false);
    }
  };

  const triggerInitialSync = async (storeId: string) => {
    try {
      // Register webhooks first
      fetch(`/api/stores/${storeId}/register-webhooks`, { method: "POST" }).catch(console.error);

      // Trigger full sync
      const res = await fetch(`/api/stores/${storeId}/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const err = await res.json();
        console.error("Initial sync failed:", err.message);
      }
    } catch (error) {
      console.error("Initial sync trigger error:", error);
    }
  };

  const filteredStores = stores.filter((store) => {
    const matchesSearch =
      store.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      store.url.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || store.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getClientName = (clientId: string | null) => {
    if (!clientId) return "Unassigned";
    const client = clients.find((c) => c.id === clientId);
    return client?.name || "Unknown";
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Never";
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <AppLayout title="Sites">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Sites</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage WooCommerce store connections and sync status
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) {
              setNewStore({ name: "", url: "", consumer_key: "", consumer_secret: "", client_id: "" });
              setUrlError(null);
              setAuthMode("oauth");
            }
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Site
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Connect WooCommerce Store</DialogTitle>
                <DialogDescription>
                  Add a store and authorize WooSync to access it.
                </DialogDescription>
              </DialogHeader>
              <div className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                <p className="text-xs text-foreground">
                  <span className="font-medium">Disable ad blockers</span> (uBlock, AdGuard, Brave Shields) for this page. They can block the
                  WooCommerce callback and webhook registration, leaving your site stuck in &ldquo;pending&rdquo;.
                </p>
              </div>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className={isSuperAdmin ? "space-y-2" : "space-y-2 col-span-2"}>
                    <Label htmlFor="store-name">Site Name</Label>
                    <Input
                      id="store-name"
                      placeholder="My Store"
                      value={newStore.name}
                      onChange={(e) => setNewStore({ ...newStore, name: e.target.value })}
                    />
                  </div>
                  {isSuperAdmin && (
                    <div className="space-y-2">
                      <Label htmlFor="client">Client (Optional)</Label>
                      <Select
                        value={newStore.client_id}
                        onValueChange={(value) => setNewStore({ ...newStore, client_id: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select client" />
                        </SelectTrigger>
                        <SelectContent>
                          {clients.map((client) => (
                            <SelectItem key={client.id} value={client.id}>
                              {client.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="store-url">Store URL</Label>
                  <Input
                    id="store-url"
                    placeholder="https://mystore.com"
                    value={newStore.url}
                    onChange={(e) => {
                      setNewStore({ ...newStore, url: e.target.value });
                      setUrlError(null);
                    }}
                    className={urlError ? "border-destructive" : ""}
                  />
                  {urlError && (
                    <p className="text-sm text-destructive">{urlError}</p>
                  )}
                  {newStore.url.trim() && !urlError && (
                    <p className="text-xs text-muted-foreground">
                      Will connect to: <span className="font-mono text-foreground">{cleanStoreUrl(newStore.url)}</span>
                    </p>
                  )}
                </div>

                <div className="space-y-3 pt-2">
                  <Label>Authentication Method</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setAuthMode("oauth")}
                      className={`p-3 rounded-lg border text-left transition-colors ${
                        authMode === "oauth"
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-muted-foreground/50"
                      }`}
                    >
                      <p className="font-medium text-sm">OAuth (Recommended)</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Redirect to store for approval
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setAuthMode("manual")}
                      className={`p-3 rounded-lg border text-left transition-colors ${
                        authMode === "manual"
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-muted-foreground/50"
                      }`}
                    >
                      <p className="font-medium text-sm">Manual Keys</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Enter API keys directly
                      </p>
                    </button>
                  </div>
                </div>

                {authMode === "manual" && (
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between">
                      <Label>WooCommerce API Keys</Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowSecrets(!showSecrets)}
                        className="h-8 px-2"
                      >
                        {showSecrets ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                    <Input
                      placeholder="Consumer Key (ck_...)"
                      type={showSecrets ? "text" : "password"}
                      value={newStore.consumer_key}
                      onChange={(e) => setNewStore({ ...newStore, consumer_key: e.target.value })}
                    />
                    <Input
                      placeholder="Consumer Secret (cs_...)"
                      type={showSecrets ? "text" : "password"}
                      value={newStore.consumer_secret}
                      onChange={(e) => setNewStore({ ...newStore, consumer_secret: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Find these in WooCommerce → Settings → Advanced → REST API
                    </p>
                  </div>
                )}

                {authMode === "oauth" && (
                  <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
                    <p>
                      You&apos;ll be redirected to your WooCommerce store to approve access. 
                      API credentials will be generated automatically.
                    </p>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateStore}
                  disabled={creating || !newStore.name.trim() || !newStore.url.trim()}
                >
                  {creating ? "Creating..." : authMode === "oauth" ? "Connect Store" : "Add Site"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Search sites..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="connected">Connected</SelectItem>
                  <SelectItem value="syncing">Syncing</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                {filteredStores.length} site{filteredStores.length !== 1 ? "s" : ""}
              </p>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Site</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Health</TableHead>
                  <TableHead>Last Sync</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && stores.length === 0 ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={`sk-${i}`}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Skeleton className="h-9 w-9 rounded-lg" />
                          <div className="space-y-1.5">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-3 w-48" />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-8 rounded" /></TableCell>
                    </TableRow>
                  ))
                ) : filteredStores.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      {searchQuery || statusFilter !== "all"
                        ? "No sites match your filters"
                        : "No sites yet. Add your first site to get started."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredStores.map((store) => (
                    <TableRow
                      key={store.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => router.push(`/sites/${store.id}`)}
                      onMouseEnter={() => prefetchStore(store.id)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Store className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{store.name}</p>
                            <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                              {store.url}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {getClientName(store.client_id)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge variant={getStatusVariant(store.status)}>
                          {store.status}
                        </StatusBadge>
                      </TableCell>
                      <TableCell>
                        {store.health_score != null ? (
                          <div className="flex items-center gap-2">
                            <Heart className={`h-3.5 w-3.5 ${
                              store.health_score >= 80 ? "text-emerald-500 fill-emerald-500" :
                              store.health_score >= 50 ? "text-amber-500 fill-amber-500" :
                              "text-red-500 fill-red-500"
                            }`} />
                            <span className={`text-sm font-medium ${
                              store.health_score >= 80 ? "text-emerald-600" :
                              store.health_score >= 50 ? "text-amber-600" :
                              "text-red-600"
                            }`}>{store.health_score}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDate(store.last_sync_at)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(store.url, "_blank");
                          }}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}