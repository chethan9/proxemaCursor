import { useState } from "react";
import { useRouter } from "next/router";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge, getStatusVariant } from "@/components/ui/status-badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Store, ExternalLink, Heart, Pencil, Package, ShoppingCart, Users, Tag, FolderTree, Ticket, Rocket, PlayCircle, AlertTriangle, Trash2, BarChart3 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-client";
import { getStore, type StoreWithClient } from "@/services/storeService";
import type { Client } from "@/services/clientService";
import { useAllActiveSyncs } from "@/hooks/queries/useAllActiveSyncs";
import { useDeleteStore } from "@/hooks/queries/useStores";
import { useToast } from "@/hooks/use-toast";
import { IncompleteSiteDialog } from "./IncompleteSiteDialog";
import { useAuth } from "@/contexts/AuthProvider";
import { useTranslation } from "next-i18next";
import { formatDateTime } from "@/lib/format-number";

interface Props {
  stores: StoreWithClient[];
  clients: Client[];
  loading: boolean;
  hasFilters: boolean;
  onEdit: (store: StoreWithClient) => void;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
}

const ASPECT_ICON: Record<string, typeof Package> = {
  products: Package, orders: ShoppingCart, customers: Users,
  categories: FolderTree, tags: Tag, coupons: Ticket,
};

const formatDate = (dateString: string | null, locale?: string) => {
  if (!dateString) return "Never";
  return formatDateTime(dateString, locale, {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
};

export function SitesTable({ stores, clients, loading, hasFilters, onEdit, selectedIds, onToggleSelect }: Props) {
  const router = useRouter();
  const { i18n } = useTranslation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { isSuperAdmin } = useAuth();
  const { data: activeSyncs = [] } = useAllActiveSyncs();
  const deleteStoreMutation = useDeleteStore();
  const syncMap = new Map(activeSyncs.map((s) => [s.store_id, s]));

  const [editingIncomplete, setEditingIncomplete] = useState<StoreWithClient | null>(null);
  const [deletingStore, setDeletingStore] = useState<StoreWithClient | null>(null);
  const [deleting, setDeleting] = useState(false);

  const prefetchStore = (storeId: string) => {
    qc.prefetchQuery({
      queryKey: queryKeys.store(storeId),
      queryFn: () => getStore(storeId),
      staleTime: 60_000,
    });
  };

  const getClientName = (clientId: string | null) => {
    if (!clientId) return "Unassigned";
    return clients.find((c) => c.id === clientId)?.name || "Unknown";
  };

  const handleConfirmDelete = async () => {
    if (!deletingStore) return;
    setDeleting(true);
    try {
      const result = await deleteStoreMutation.mutateAsync(deletingStore.id);
      const counts = result.record_counts || {};
      const totalRecords = Object.values(counts).reduce((sum, n) => sum + (n || 0), 0);
      const parts: string[] = [];
      if (counts.products) parts.push(`${counts.products} products`);
      if (counts.orders) parts.push(`${counts.orders} orders`);
      if (counts.customers) parts.push(`${counts.customers} customers`);
      if (counts.categories) parts.push(`${counts.categories} categories`);
      if (counts.tags) parts.push(`${counts.tags} tags`);
      if (counts.coupons) parts.push(`${counts.coupons} coupons`);
      if (counts.sync_runs) parts.push(`${counts.sync_runs} sync runs`);
      if (result.webhooks_removed > 0) parts.push(`${result.webhooks_removed} webhook${result.webhooks_removed === 1 ? "" : "s"}`);
      const apiKeyNote = result.api_key_removed ? " · API key revoked" : "";
      toast({
        title: totalRecords > 0 ? `Removed ${deletingStore.name} and all its data` : `Removed ${deletingStore.name}`,
        description: parts.length > 0 ? `Deleted: ${parts.join(", ")}${apiKeyNote}` : (apiKeyNote || "Site removed."),
      });
      setDeletingStore(null);
    } catch (e) {
      toast({ title: "Delete failed", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  const handleRowKey = (e: React.KeyboardEvent, store: StoreWithClient, isIncomplete: boolean) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (isIncomplete) router.push(`/sites/connect/${store.id}?resume=1`);
      else router.push(`/sites/${store.id}/home`);
    }
  };

  return (
    <TooltipProvider delayDuration={200}>
      <Table>
        <TableHeader>
          <TableRow>
            {onToggleSelect && <TableHead className="w-10"></TableHead>}
            <TableHead>Site</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Health</TableHead>
            <TableHead>Last Sync</TableHead>
            <TableHead className="w-[200px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading && stores.length === 0 ? (
            Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={`sk-${i}`}>
                {onToggleSelect && <TableCell></TableCell>}
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
          ) : stores.length === 0 ? (
            <TableRow>
              <TableCell colSpan={onToggleSelect ? 7 : 6} className="text-center py-8 text-muted-foreground">
                {hasFilters ? "No sites match your filters" : "No sites yet. Add your first site to get started."}
              </TableCell>
            </TableRow>
          ) : (
            stores.map((store) => {
              const sync = syncMap.get(store.id);
              const AspectIcon = sync?.currentAspect ? (ASPECT_ICON[sync.currentAspect] || Rocket) : Rocket;
              const aspectLabel = sync?.currentAspect
                ? sync.currentAspect.charAt(0).toUpperCase() + sync.currentAspect.slice(1)
                : "Preparing";
              const isIncomplete = !store.onboarding_completed_at;
              return (
                <>
                  <TableRow
                    key={store.id}
                    className="cursor-pointer hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    tabIndex={0}
                    onClick={() => isIncomplete ? router.push(`/sites/connect/${store.id}?resume=1`) : router.push(`/sites/${store.id}/home`)}
                    onKeyDown={(e) => handleRowKey(e, store, isIncomplete)}
                    onMouseEnter={() => prefetchStore(store.id)}
                  >
                    {onToggleSelect && (
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds?.has(store.id) ?? false}
                          onCheckedChange={() => onToggleSelect(store.id)}
                        />
                      </TableCell>
                    )}
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Store className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{store.name}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-[200px]">{store.url}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{getClientName(store.client_id)}</TableCell>
                    <TableCell>
                      {isIncomplete ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-warning/10 text-warning border border-warning/30">
                          <AlertTriangle className="h-3 w-3" />
                          Setup incomplete
                        </span>
                      ) : (
                        <StatusBadge variant={getStatusVariant(store.status)}>{store.status}</StatusBadge>
                      )}
                    </TableCell>
                    <TableCell>
                      {isIncomplete ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : store.health_score != null ? (
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
                    <TableCell className="text-muted-foreground text-sm">{isIncomplete ? "—" : formatDate(store.last_sync_at, i18n.language)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 justify-end">
                        {isIncomplete ? (
                          <>
                            <Button
                              variant="default"
                              size="sm"
                              className="h-8 px-2.5 gap-1.5"
                              onClick={(e) => { e.stopPropagation(); router.push(`/sites/connect/${store.id}?resume=1`); }}
                            >
                              <PlayCircle className="h-3.5 w-3.5" />
                              <span className="text-xs">Resume</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={(e) => { e.stopPropagation(); setEditingIncomplete(store); }}
                              title="Edit"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={(e) => { e.stopPropagation(); setDeletingStore(store); }}
                              title="Delete"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={(e) => { e.stopPropagation(); router.push(`/projects/${store.id}`); }}
                                >
                                  <BarChart3 className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>View reports</TooltipContent>
                            </Tooltip>
                            <Button variant="ghost" size="sm" className="h-8 px-2 gap-1.5"
                              onClick={(e) => { e.stopPropagation(); onEdit(store); }}>
                              <Pencil className="h-3.5 w-3.5" />
                              <span className="text-xs">Edit</span>
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8"
                              onClick={(e) => { e.stopPropagation(); window.open(store.url, "_blank"); }}>
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                  {sync && (
                    <TableRow key={`${store.id}-sync`} className="hover:bg-transparent border-t-0">
                      <TableCell
                        colSpan={onToggleSelect ? 7 : 6}
                        className="py-2 pl-[60px] pr-6 cursor-pointer hover:bg-emerald-500/5 transition-colors group"
                        onClick={(e) => { e.stopPropagation(); router.push(`/projects/${store.id}`); }}
                        title="View sync engine details"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="relative flex h-1.5 w-1.5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                            </span>
                            <AspectIcon className="h-3.5 w-3.5 text-emerald-600" />
                            <span className="text-xs font-medium text-foreground group-hover:underline">Syncing {aspectLabel.toLowerCase()}…</span>
                          </div>
                          <div className="flex-1 h-1.5 rounded-full bg-emerald-500/10 overflow-hidden relative max-w-md">
                            <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500 relative overflow-hidden"
                              style={{ width: `${sync.progress}%` }}>
                              <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.35),transparent)] bg-[length:200%_100%] animate-[shimmer_1.6s_linear_infinite]" />
                            </div>
                          </div>
                          <span className="text-xs tabular-nums font-semibold text-emerald-600 shrink-0">{sync.progress}%</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              );
            })
          )}
        </TableBody>
        <style jsx global>{`
          @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        `}</style>
      </Table>

      <IncompleteSiteDialog
        open={!!editingIncomplete}
        onOpenChange={(o) => !o && setEditingIncomplete(null)}
        store={editingIncomplete}
        clients={clients}
        isSuperAdmin={isSuperAdmin}
        onSaved={() => { qc.invalidateQueries({ queryKey: queryKeys.stores }); setEditingIncomplete(null); }}
      />

      <AlertDialog open={!!deletingStore} onOpenChange={(o) => !o && !deleting && setDeletingStore(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete incomplete setup?</AlertDialogTitle>
            <AlertDialogDescription>
              Remove <strong>{deletingStore?.name}</strong> ({deletingStore?.url}). This site was never fully connected — no WooCommerce data will be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  );
}