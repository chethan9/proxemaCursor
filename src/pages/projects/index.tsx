import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
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

const Lottie = dynamic(() => import("lottie-react"), { ssr: false });

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
  const [editStoreId, setEditStoreId] = useState<string | null>(null);
  const [catData, setCatData] = useState<object | null>(null);
  const [catRotation, setCatRotation] = useState(0);
  const lottieRef = useRef<{ setSpeed: (s: number) => void } | null>(null);
  const handledRef = useRef<string | null>(null);

  const reloadData = () => {
    qc.invalidateQueries({ queryKey: queryKeys.stores });
    qc.invalidateQueries({ queryKey: queryKeys.clients });
  };

  const editStore = editStoreId ? stores.find((s) => s.id === editStoreId) || null : null;

  useEffect(() => {
    if (!router.isReady) return;
    const wp = typeof router.query.wp === "string" ? router.query.wp : null;
    const storeParam = typeof router.query.store === "string" ? router.query.store : null;
    if (!wp || !storeParam) return;
    const key = `${wp}:${storeParam}`;
    if (handledRef.current === key) return;
    handledRef.current = key;
    if (wp === "ok") toast({ title: "WordPress connected", description: "Media library access is now active." });
    else if (wp === "rejected") toast({ title: "Authorization cancelled", description: "WordPress access was not granted.", variant: "destructive" });
    else if (wp === "error") toast({ title: "Authorization failed", description: "Unable to save WordPress credentials.", variant: "destructive" });
    else if (wp === "missing") toast({ title: "Authorization incomplete", description: "WordPress did not return credentials.", variant: "destructive" });
    qc.refetchQueries({ queryKey: queryKeys.stores }).then(() => {
      setEditStoreId(storeParam);
      setEditOpen(true);
    });
    const { wp: _w, store: _s, ...rest } = router.query;
    router.replace({ pathname: router.pathname, query: rest }, undefined, { shallow: true });
  }, [router.isReady, router.query.wp, router.query.store]);

  // Load cat lottie only when needed (empty state)
  const isEmpty = !loading && stores.length === 0;
  useEffect(() => {
    if (!isEmpty || catData) return;
    fetch("/cat.json").then((r) => r.json()).then(setCatData).catch(() => {});
  }, [isEmpty, catData]);

  useEffect(() => {
    if (lottieRef.current) lottieRef.current.setSpeed(0.5);
  }, [catData]);

  const openEditDialog = (store: StoreWithClient) => {
    setEditStoreId(store.id);
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
          {!isEmpty && (
            <Button onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Site
            </Button>
          )}
        </div>

        {isEmpty ? (
          <div className="relative min-h-[calc(100vh-12rem)] flex items-center justify-center overflow-hidden">
            {catData && (
              <div
                className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-60"
                style={{ transform: `rotate(${catRotation}deg)`, transition: "transform 0.8s ease-out" }}
              >
                <Lottie
                  lottieRef={lottieRef as never}
                  animationData={catData}
                  loop={false}
                  autoplay
                  onComplete={() => {
                    const next = Math.floor(Math.random() * 360) - 180;
                    setCatRotation(next);
                    if (lottieRef.current) {
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      const r = lottieRef.current as any;
                      r.goToAndPlay?.(0, true);
                      r.setSpeed?.(0.5);
                    }
                  }}
                  onDOMLoaded={() => lottieRef.current?.setSpeed(0.5)}
                  style={{ width: "min(67vw, 675px)", height: "min(52vh, 525px)" }}
                />
              </div>
            )}
            <div className="relative z-10 flex flex-col items-center text-center max-w-md">
              <img
                src="/web-page.png"
                alt=""
                className="h-24 w-24 object-contain mb-2 drop-shadow-sm"
                draggable={false}
              />
              <h2 className="text-2xl font-semibold text-foreground">You forgot something.</h2>
              <p className="text-base text-muted-foreground mt-1">(Hint: a site)</p>
              <Button size="lg" className="mt-5" onClick={() => setAddOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Site
              </Button>
            </div>
          </div>
        ) : (
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
        )}

        <AddSiteDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          clients={clients}
          isSuperAdmin={isSuperAdmin}
          onCreated={reloadData}
        />
        <EditSiteDialog
          open={editOpen}
          onOpenChange={(o) => { setEditOpen(o); if (!o) setEditStoreId(null); }}
          store={editStore}
          clients={clients}
          isSuperAdmin={isSuperAdmin}
          onSaved={reloadData}
        />
      </div>
    </AppLayout>
  );
}