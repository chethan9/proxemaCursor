import { useEffect, useState } from "react";
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
import { Plus, Search, Store, ExternalLink, Eye, EyeOff } from "lucide-react";
import { getStores, createStore, type Store as StoreType } from "@/services/storeService";
import { getClients, type Client } from "@/services/clientService";

export default function SitesPage() {
  const router = useRouter();
  const [stores, setStores] = useState<StoreType[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showSecrets, setShowSecrets] = useState(false);
  
  const [newStore, setNewStore] = useState({
    name: "",
    url: "",
    consumer_key: "",
    consumer_secret: "",
    client_id: "",
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [storesData, clientsData] = await Promise.all([
        getStores(),
        getClients(),
      ]);
      setStores(storesData);
      setClients(clientsData);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateStore = async () => {
    if (!newStore.name.trim() || !newStore.url.trim()) return;
    setCreating(true);
    try {
      await createStore({
        name: newStore.name.trim(),
        url: newStore.url.trim(),
        consumer_key: newStore.consumer_key.trim() || null,
        consumer_secret: newStore.consumer_secret.trim() || null,
        client_id: newStore.client_id || null,
        status: "pending",
      });
      setNewStore({ name: "", url: "", consumer_key: "", consumer_secret: "", client_id: "" });
      setDialogOpen(false);
      await loadData();
    } catch (error) {
      console.error("Error creating store:", error);
    } finally {
      setCreating(false);
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
    <AppLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Sites</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage WooCommerce store connections and sync status
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Site
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Add WooCommerce Site</DialogTitle>
                <DialogDescription>
                  Connect a new WooCommerce store by providing API credentials.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="store-name">Site Name</Label>
                    <Input
                      id="store-name"
                      placeholder="My Store"
                      value={newStore.name}
                      onChange={(e) => setNewStore({ ...newStore, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="client">Client</Label>
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
                </div>
                <div className="space-y-2">
                  <Label htmlFor="store-url">Store URL</Label>
                  <Input
                    id="store-url"
                    placeholder="https://mystore.com"
                    value={newStore.url}
                    onChange={(e) => setNewStore({ ...newStore, url: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>WooCommerce API Keys</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowSecrets(!showSecrets)}
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
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateStore}
                  disabled={creating || !newStore.name.trim() || !newStore.url.trim()}
                >
                  {creating ? "Adding..." : "Add Site"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search sites..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
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
                  <TableHead>Last Sync</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Loading sites...
                    </TableCell>
                  </TableRow>
                ) : filteredStores.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
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