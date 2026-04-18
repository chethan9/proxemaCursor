import { useEffect, useState } from "react";
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
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Plus, Search, Building2, Trash2, Pencil, ExternalLink } from "lucide-react";
import { useRouter } from "next/router";
import { getClients, createClient, updateClient, deleteClient, type Client } from "@/services/clientService";
import { getStoresByClient } from "@/services/storeService";
import { browserCache, CACHE_KEYS, CACHE_TTL } from "@/lib/cache";

export default function ClientsPage() {
  const router = useRouter();
  const [clients, setClients] = useState<(Client & { siteCount: number })[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [creating, setCreating] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [editName, setEditName] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const loadClients = async (skipCache = false) => {
    if (!skipCache) {
      const cached = browserCache.get<(Client & { siteCount: number })[]>(CACHE_KEYS.CLIENTS + ":with_counts");
      if (cached) {
        setClients(cached);
        setLoading(false);
        return;
      }
    }
    setLoading(true);
    try {
      const data = await getClients();
      const withCounts = await Promise.all(
        data.map(async (c) => {
          const stores = await getStoresByClient(c.id);
          return { ...c, siteCount: stores.length };
        })
      );
      setClients(withCounts);
      browserCache.set(CACHE_KEYS.CLIENTS + ":with_counts", withCounts, CACHE_TTL.MEDIUM);
    } catch (error) {
      console.error("Error loading clients:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClients();
  }, []);

  const handleCreateClient = async () => {
    if (!newClientName.trim()) return;
    setCreating(true);
    try {
      await createClient({ name: newClientName.trim() });
      setNewClientName("");
      setDialogOpen(false);
      browserCache.delete(CACHE_KEYS.CLIENTS);
      browserCache.delete(CACHE_KEYS.CLIENTS + ":with_counts");
      await loadClients(true);
    } catch (error) {
      console.error("Error creating client:", error);
    } finally {
      setCreating(false);
    }
  };

  const openEdit = (client: Client) => {
    setEditingClient(client);
    setEditName(client.name);
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingClient || !editName.trim()) return;
    setSavingEdit(true);
    try {
      await updateClient(editingClient.id, { name: editName.trim() });
      setEditOpen(false);
      setEditingClient(null);
      browserCache.delete(CACHE_KEYS.CLIENTS);
      browserCache.delete(CACHE_KEYS.CLIENTS + ":with_counts");
      await loadClients(true);
    } catch (error) {
      console.error("Error updating client:", error);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteClient = async (id: string) => {
    if (!confirm("Are you sure you want to delete this client? Linked sites will be unassigned.")) return;
    try {
      await deleteClient(id);
      browserCache.delete(CACHE_KEYS.CLIENTS);
      browserCache.delete(CACHE_KEYS.CLIENTS + ":with_counts");
      await loadClients(true);
    } catch (error) {
      console.error("Error deleting client:", error);
    }
  };

  const filteredClients = clients.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

  return (
    <AppLayout title="Clients">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Clients</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage your agency clients and their WooCommerce sites
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Client
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Client</DialogTitle>
                <DialogDescription>Create a new client to organize their WooCommerce sites.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Client Name</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Acme Corporation"
                    value={newClientName}
                    onChange={(e) => setNewClientName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleCreateClient()}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleCreateClient} disabled={creating || !newClientName.trim()}>
                  {creating ? "Creating..." : "Create Client"}
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
                  placeholder="Search clients..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <p className="text-sm text-muted-foreground">
                {filteredClients.length} client{filteredClients.length !== 1 ? "s" : ""}
              </p>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client Name</TableHead>
                  <TableHead className="text-center">Sites</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-[160px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Loading clients...</TableCell>
                  </TableRow>
                ) : filteredClients.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      {searchQuery ? "No clients match your search" : "No clients yet. Add your first client to get started."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredClients.map((client) => (
                    <TableRow key={client.id} className="cursor-pointer" onClick={() => router.push(`/clients/${client.id}`)}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Building2 className="h-4 w-4 text-primary" />
                          </div>
                          <span className="font-medium">{client.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="inline-flex items-center justify-center h-6 min-w-[24px] px-2 rounded-full bg-secondary text-secondary-foreground text-sm font-medium">
                          {client.siteCount}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(client.created_at)}</TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="Open"
                          onClick={() => router.push(`/clients/${client.id}`)}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="Edit name"
                          onClick={() => openEdit(client)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          title="Delete"
                          onClick={() => handleDeleteClient(client.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Client</DialogTitle>
              <DialogDescription>Update the client name.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Client Name</Label>
                <Input
                  id="edit-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSaveEdit()}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
              <Button onClick={handleSaveEdit} disabled={savingEdit || !editName.trim()}>
                {savingEdit ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}