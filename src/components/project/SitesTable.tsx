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
import { Store, ExternalLink, Heart, Pencil, Package, ShoppingCart, Users, Tag, FolderTree, Ticket, Rocket, PlayCircle, AlertTriangle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-client";
import { getStore, type StoreWithClient } from "@/services/storeService";
import type { Client } from "@/services/clientService";
import { useAllActiveSyncs } from "@/hooks/queries/useAllActiveSyncs";

interface Props {
  stores: StoreWithClient[];
  clients: Client[];
  loading: boolean;
  hasFilters: boolean;
  onEdit: (store: StoreWithClient) => void;
}

const ASPECT_ICON: Record<string, typeof Package> = {
  products: Package, orders: ShoppingCart, customers: Users,
  categories: FolderTree, tags: Tag, coupons: Ticket,
};

const formatDate = (dateString: string | null) => {
  if (!dateString) return "Never";
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
};

export function SitesTable({ stores, clients, loading, hasFilters, onEdit }: Props) {
  const router = useRouter();
  const qc = useQueryClient();
  const { data: activeSyncs = [] } = useAllActiveSyncs();
  const syncMap = new Map(activeSyncs.map((s) => [s.store_id, s]));

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

  return (
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
        ) : stores.length === 0 ? (
          <TableRow>
            <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
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
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => isIncomplete ? router.push(`/sites/connect/${store.id}?resume=1`) : router.push(`/projects/${store.id}`)}
                  onMouseEnter={() => prefetchStore(store.id)}
                >
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
                  <TableCell className="text-muted-foreground text-sm">{isIncomplete ? "—" : formatDate(store.last_sync_at)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {isIncomplete ? (
                        <Button
                          variant="default"
                          size="sm"
                          className="h-8 px-2.5 gap-1.5"
                          onClick={(e) => { e.stopPropagation(); router.push(`/sites/connect/${store.id}?resume=1`); }}
                        >
                          <PlayCircle className="h-3.5 w-3.5" />
                          <span className="text-xs">Resume</span>
                        </Button>
                      ) : (
                        <>
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
                    <TableCell colSpan={6} className="py-2 pl-[60px] pr-6">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="relative flex h-1.5 w-1.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                          </span>
                          <AspectIcon className="h-3.5 w-3.5 text-emerald-600" />
                          <span className="text-xs font-medium text-foreground">Syncing {aspectLabel.toLowerCase()}…</span>
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
  );
}