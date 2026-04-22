import { useState, useEffect, useRef, useMemo } from "react";
import dynamic from "next/dynamic";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Plus, Globe2, ChevronLeft, ChevronRight } from "lucide-react";
import { type StoreWithClient } from "@/services/storeService";
import { useStores } from "@/hooks/queries/useStores";
import { useClients } from "@/hooks/queries/useClients";
import { queryKeys } from "@/lib/query-client";
import { useAuth } from "@/contexts/AuthProvider";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/router";
import { useToast } from "@/hooks/use-toast";
import { useViewPreferences } from "@/hooks/useViewPreferences";
import { AddSiteDialog } from "@/components/project/AddSiteDialog";
import { EditSiteDialog } from "@/components/project/EditSiteDialog";
import { SitesTable } from "@/components/project/SitesTable";
import { ProjectsToolbar, type ViewMode, type StatusFilter, type HealthFilter, type SortOption } from "@/components/project/ProjectsToolbar";
import { CompactSiteRow } from "@/components/project/CompactSiteRow";
import { GridSiteCard } from "@/components/project/GridSiteCard";
import { BulkActionBar } from "@/components/project/BulkActionBar";
import { useSitesUptime } from "@/hooks/queries/useSitesUptime";

const Lottie = dynamic(() => import("lottie-react"), { ssr: false });
const PAGE_SIZE = 50;

interface ProjectPrefs {
  viewMode: ViewMode;
  [key: string]: unknown;
}

export default function SitesPage() {
  const { isSuperAdmin } = useAuth();
  const qc = useQueryClient();
  const router = useRouter();
  const { toast } = useToast();
  const { data: stores = [], isLoading: loading } = useStores();
  const { data: clients = [] } = useClients();
  const storeIds = useMemo(() => stores.map((s) => s.id), [stores]);
  const { data: uptimeMap = {} } = useSitesUptime(storeIds);
  const { prefs, update } = useViewPreferences<ProjectPrefs>("projects-view", { viewMode: "list" });

  const [searchQuery, setSearchQuery] = useState("");
  const [clientFilter, setClientFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [healthFilter, setHealthFilter] = useState<HealthFilter>("all");
  const [sort, setSort] = useState<SortOption>("last-sync-desc");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [syncingBulk, setSyncingBulk] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editStoreId, setEditStoreId] = useState<string | null>(null);
  const [catData, setCatData] = useState<object | null>(null);
  const [catRotation, setCatRotation] = useState(0);
  const lottieRef = useRef<{ setSpeed: (s: number) => void; goToAndPlay?: (f: number, isFrame?: boolean) => void } | null>(null);
  const handledRef = useRef<string | null>(null);

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

  const isEmpty = !loading && stores.length === 0;

  useEffect(() => {
    if (!isEmpty || catData) return;
    fetch("/cat.json").then((r) => r.json()).then(setCatData).catch(() => {});
  }, [isEmpty, catData]);

  useEffect(() => {
    if (lottieRef.current) lottieRef.current.setSpeed(0.5);
  }, [catData]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, clientFilter, statusFilter, healthFilter, sort]);

  const getClientName = (clientId: string | null) => {
    if (!clientId) return "Unassigned";
    return clients.find((c) => c.id === clientId)?.name || "Unknown";
  };

  const filteredStores = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let list = stores.filter((s) => {
      if (q && !s.name.toLowerCase().includes(q) && !s.url.toLowerCase().includes(q)) return false;
      if (clientFilter !== "all") {
        if (clientFilter === "unassigned" && s.client_id) return false;
        if (clientFilter !== "unassigned" && s.client_id !== clientFilter) return false;
      }
      if (statusFilter !== "all" && s.status !== statusFilter) return false;
      if (healthFilter !== "all") {
        const h = s.health_score;
        if (healthFilter === "unknown" && h != null) return false;
        if (healthFilter === "healthy" && (h == null || h < 80)) return false;
        if (healthFilter === "warning" && (h == null || h < 50 || h >= 80)) return false;
        if (healthFilter === "critical" && (h == null || h >= 50)) return false;
      }
      return true;
    });

    list = [...list].sort((a, b) => {
      switch (sort) {
        case "name-asc": return a.name.localeCompare(b.name);
        case "name-desc": return b.name.localeCompare(a.name);
        case "last-sync-desc": {
          const aT = a.last_sync_at ? new Date(a.last_sync_at).getTime() : 0;
          const bT = b.last_sync_at ? new Date(b.last_sync_at).getTime() : 0;
          return bT - aT;
        }
        case "last-sync-asc": {
          const aT = a.last_sync_at ? new Date(a.last_sync_at).getTime() : Infinity;
          const bT = b.last_sync_at ? new Date(b.last_sync_at).getTime() : Infinity;
          return aT - bT;
        }
        case "health-desc": return (b.health_score ?? -1) - (a.health_score ?? -1);
        case "health-asc": return (a.health_score ?? Infinity) - (b.health_score ?? Infinity);
        case "created-desc": return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
        case "created-asc": return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
        default: return 0;
      }
    });

    return list;
  }, [stores, searchQuery, clientFilter, statusFilter, healthFilter, sort]);

  const totalPages = Math.max(1, Math.ceil(filteredStores.length / PAGE_SIZE));
  const pagedStores = filteredStores.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const hasFilters = !!searchQuery || clientFilter !== "all" || statusFilter !== "all" || healthFilter !== "all";

  const toggleSelect = (id: string) => {
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelected(new Set());

  const handleBulkSync = async () => {
    if (selected.size === 0) return;
    setSyncingBulk(true);
    const ids = Array.from(selected);
    let ok = 0;
    let fail = 0;
    await Promise.all(ids.map(async (id) => {
      try {
        const res = await fetch(`/api/stores/${id}/sync-start`, { method: "POST" });
        if (res.ok) ok++; else fail++;
      } catch {
        fail++;
      }
    }));
    setSyncingBulk(false);
    toast({
      title: "Bulk sync enqueued",
      description: `${ok} started, ${fail} failed`,
      variant: fail > 0 ? "destructive" : "default",
    });
    clearSelection();
    qc.invalidateQueries({ queryKey: queryKeys.stores });
  };

  const handleBulkExport = () => {
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    const list = stores.filter((s) => ids.includes(s.id));
    const headers = ["Name", "URL", "Client", "Status", "Health", "Last Sync", "Created"];
    const rows = list.map((s) => [
      s.name,
      s.url,
      getClientName(s.client_id),
      s.status || "",
      s.health_score ?? "",
      s.last_sync_at || "",
      s.created_at || "",
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sites-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const openEditDialog = (store: StoreWithClient) => {
    setEditStoreId(store.id);
    setEditOpen(true);
  };

  const reloadData = () => {
    qc.invalidateQueries({ queryKey: queryKeys.stores });
    qc.invalidateQueries({ queryKey: queryKeys.clients });
  };

  const setViewMode = (v: ViewMode) => update({ viewMode: v });

  return (
    <AppLayout title="Projects">
      {isEmpty ? (
        <div className="relative min-h-[calc(100vh-4rem)] flex items-center justify-center overflow-hidden">
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
                  const r = lottieRef.current;
                  r?.goToAndPlay?.(0, true);
                  r?.setSpeed?.(0.5);
                }}
                onDOMLoaded={() => lottieRef.current?.setSpeed(0.5)}
                style={{ width: "min(90vw, 900px)", height: "min(70vh, 700px)" }}
              />
            </div>
          )}
          <div className="relative z-10 flex flex-col items-center text-center max-w-md">
            <div className="h-20 w-20 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-5 shadow-sm">
              <Globe2 className="h-10 w-10 text-primary" strokeWidth={1.5} />
            </div>
            <h2 className="text-2xl font-semibold text-foreground">You forgot something.</h2>
            <p className="text-base text-muted-foreground mt-2">(Hint: a site)</p>
            <Button size="lg" className="mt-6" onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Site
            </Button>
          </div>
        </div>
      ) : (
        <div className="p-4 space-y-3">
          <div className="rounded-lg border border-border bg-card p-3">
            <ProjectsToolbar
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              clientId={clientFilter}
              onClientChange={setClientFilter}
              clients={clients}
              stores={stores}
              status={statusFilter}
              onStatusChange={setStatusFilter}
              health={healthFilter}
              onHealthChange={setHealthFilter}
              sort={sort}
              onSortChange={setSort}
              viewMode={prefs.viewMode}
              onViewModeChange={setViewMode}
              onAddSite={() => setAddOpen(true)}
              filteredCount={filteredStores.length}
              totalCount={stores.length}
            />
          </div>

          {filteredStores.length === 0 && !loading ? (
            <div className="rounded-lg border border-border bg-card p-12 text-center text-sm text-muted-foreground">
              No sites match these filters.
              {hasFilters && (
                <Button variant="link" size="sm" className="ml-2"
                  onClick={() => {
                    setSearchQuery("");
                    setClientFilter("all");
                    setStatusFilter("all");
                    setHealthFilter("all");
                  }}>
                  Clear filters
                </Button>
              )}
            </div>
          ) : prefs.viewMode === "list" ? (
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <SitesTable
                stores={pagedStores}
                clients={clients}
                loading={loading}
                hasFilters={hasFilters}
                onEdit={openEditDialog}
                selectedIds={selected}
                onToggleSelect={toggleSelect}
              />
            </div>
          ) : prefs.viewMode === "compact" ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-2.5">
              {pagedStores.map((s) => (
                <CompactSiteRow
                  key={s.id}
                  store={s}
                  clientName={getClientName(s.client_id)}
                  selected={selected.has(s.id)}
                  onToggleSelect={() => toggleSelect(s.id)}
                  onEdit={() => openEditDialog(s)}
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
              {pagedStores.map((s) => (
                <GridSiteCard
                  key={s.id}
                  store={s}
                  clientName={getClientName(s.client_id)}
                  selected={selected.has(s.id)}
                  onToggleSelect={() => toggleSelect(s.id)}
                  onEdit={() => openEditDialog(s)}
                  uptimeHistory={uptimeMap[s.id] || []}
                />
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-1 text-sm">
              <div className="text-muted-foreground">
                Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filteredStores.length)} of {filteredStores.length}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm tabular-nums">{page} / {totalPages}</span>
                <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      <BulkActionBar
        selectedCount={selected.size}
        onSync={handleBulkSync}
        onExport={handleBulkExport}
        onClear={clearSelection}
        syncing={syncingBulk}
      />

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
        site={editStore}
      />
    </AppLayout>
  );
}