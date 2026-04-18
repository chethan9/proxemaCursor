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
import { Store, ExternalLink, Heart, Pencil } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-client";
import { getStore, type StoreWithClient } from "@/services/storeService";
import type { Client } from "@/services/clientService";

interface Props {
  stores: StoreWithClient[];
  clients: Client[];
  loading: boolean;
  hasFilters: boolean;
  onEdit: (store: StoreWithClient) => void;
}

const formatDate = (dateString: string | null) => {
  if (!dateString) return "Never";
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export function SitesTable({ stores, clients, loading, hasFilters, onEdit }: Props) {
  const router = useRouter();
  const qc = useQueryClient();

  const prefetchStore = (storeId: string) => {
    qc.prefetchQuery({
      queryKey: queryKeys.store(storeId),
      queryFn: () => getStore(storeId),
      staleTime: 60_000,
    });
  };

  const getClientName = (clientId: string | null) => {
    if (!clientId) return "Unassigned";
    const client = clients.find((c) => c.id === clientId);
    return client?.name || "Unknown";
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
          stores.map((store) => (
            <TableRow
              key={store.id}
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => router.push(`/projects/${store.id}`)}
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
                <StatusBadge variant={getStatusVariant(store.status)}>{store.status}</StatusBadge>
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
              <TableCell className="text-muted-foreground text-sm">{formatDate(store.last_sync_at)}</TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 gap-1.5"
                    onClick={(e) => { e.stopPropagation(); onEdit(store); }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    <span className="text-xs">Edit</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={(e) => { e.stopPropagation(); window.open(store.url, "_blank"); }}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}