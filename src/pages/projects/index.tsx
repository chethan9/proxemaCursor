import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Plus, Search } from "lucide-react";
import { type StoreWithClient } from "@/services/storeService";
import { useStores } from "@/hooks/queries/useStores";
import { useClients } from "@/hooks/queries/useClients";
import { queryKeys } from "@/lib/query-client";
import { useAuth } from "@/contexts/AuthProvider";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/router";
import { useToast } from "@/hooks/use-toast";
import { AddSiteDialog } from "@/components/project/AddSiteDialog";
import { EditSiteDialog } from "@/components/project/EditSiteDialog";
import { SitesTable } from "@/components/project/SitesTable";

export default function SitesPage() {
  const { isSuperAdmin } = useAuth();
  const qc = useQueryClient();
  const router = useRouter();
  const { toast } = useToast();
  const { data: stores = [], isLoading: loading } = useStores();
  const { data: clients = [] } = useClients();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editStore, setEditStore] = useState<StoreWithClient | null>(null);

  const reloadData = () => {
    qc.invalidateQueries({ queryKey: queryKeys.stores });
    qc.invalidateQueries({ queryKey: queryKeys.clients });
  };

  useEffect(() => {
    if (!router.isReady) return;
    const { wp_connected, wp_error, edit_store } = router.query;
    if (wp_connected === "1" || wp_error) {
      qc.invalidateQueries({ queryKey: queryKeys.stores });
      if (wp_connected === "1") {
        toast({ title: "WordPress connected", description: "Media library access is now active." });
      } else {
        toast({ title: "WordPress authorization failed", description: String(wp_error || "Unknown error"), variant: "destructive" });
      }
    }
    if (edit_store && typeof edit_store === "string") {
      const findAndOpen = () => {
        const s = stores.find(s => s.id === edit_store);
        if (s) { setEditStore(s); setEditOpen(true); }
      };
      findAndOpen();
    }
    if (wp_connected || wp_error || edit_store) {
      const { wp_connected: _w, wp_error: _e, edit_store: _es, ...rest } = router.query;
      router.replace({ pathname: router.pathname, query: rest }, undefined, { shallow: true });
    }
  }, [router.isReady, router.query.wp_connected, router.query.wp_error, router.query.edit_store, stores.length]);

  const openEditDialog = (store: StoreWithClient) => {
    setEditStore(store);
    setEditOpen(true);
  };

  const filteredStores = stores.filter((store) => {
    const matchesSearch =
      store.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      store.url.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || store.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const hasFilters = !!searchQuery || statusFilter !== "all";

  return (
    <AppLayout title="Projects">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Projects</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage WooCommerce store connections and sync status
            </p>
          </div>
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Site
          </Button>
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
            <SitesTable
              stores={filteredStores}
              clients={clients}
              loading={loading}
              hasFilters={hasFilters}
              onEdit={openEditDialog}
            />
          </CardContent>
        </Card>

        <AddSiteDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          clients={clients}
          isSuperAdmin={isSuperAdmin}
          onCreated={reloadData}
        />
        <EditSiteDialog
          open={editOpen}
          onOpenChange={(o) => { setEditOpen(o); if (!o) setEditStore(null); }}
          store={editStore}
          clients={clients}
          isSuperAdmin={isSuperAdmin}
          onSaved={reloadData}
        />
      </div>
    </AppLayout>
  );
}