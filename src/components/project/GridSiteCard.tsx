import { useState } from "react";
import { useRouter } from "next/router";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { StatusBadge, getStatusVariant } from "@/components/ui/status-badge";
import { Heart, Pencil, ExternalLink, PlayCircle, AlertTriangle, BarChart3, RefreshCw, CheckCircle2, XCircle, Activity } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-client";
import { useAllActiveSyncs } from "@/hooks/queries/useAllActiveSyncs";
import { useToast } from "@/hooks/use-toast";
import { SiteAvatar } from "./SiteAvatar";
import type { StoreWithClient } from "@/services/storeService";

interface Props {
  store: StoreWithClient;
  clientName: string;
  selected: boolean;
  onToggleSelect: () => void;
  onEdit: () => void;
}

const formatDate = (d: string | null) => {
  if (!d) return "Never";
  return new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
};

export function GridSiteCard({ store, clientName, selected, onToggleSelect, onEdit }: Props) {
  const router = useRouter();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: activeSyncs = [] } = useAllActiveSyncs();
  const activeSync = activeSyncs.find((s) => s.store_id === store.id);
  const [syncing, setSyncing] = useState(false);

  const isIncomplete = !store.onboarding_completed_at;
  const wcConnected = !!store.consumer_key;
  const wpConnected = !!(store.wp_username && store.wp_app_password);

  const healthColor =
    store.health_score == null ? "text-muted-foreground" :
    store.health_score >= 80 ? "text-emerald-600" :
    store.health_score >= 50 ? "text-amber-600" : "text-red-600";

  const topBorder =
    isIncomplete ? "border-t-amber-500" :
    store.status === "error" ? "border-t-red-500" :
    store.health_score != null && store.health_score >= 80 ? "border-t-emerald-500" :
    store.health_score != null && store.health_score >= 50 ? "border-t-amber-500" :
    store.health_score != null ? "border-t-red-500" :
    "border-t-border";

  const navigate = () => {
    if (isIncomplete) router.push(`/sites/connect/${store.id}?resume=1`);
    else router.push(`/sites/${store.id}/home`);
  };

  const handleSync = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setSyncing(true);
    try {
      const res = await fetch(`/api/stores/${store.id}/sync-start`, { method: "POST" });
      if (!res.ok) throw new Error();
      toast({ title: "Sync started", description: store.name });
      qc.invalidateQueries({ queryKey: queryKeys.stores });
    } catch {
      toast({ title: "Failed to start sync", variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  const isSyncing = !!activeSync || syncing;

  return (
    <div className={`relative rounded-lg border border-border bg-card border-t-[3px] ${topBorder} flex flex-col hover:shadow-md transition-shadow overflow-hidden`}>
      <div className="absolute top-2 right-2 z-10" onClick={(e) => e.stopPropagation()}>
        <Checkbox checked={selected} onCheckedChange={onToggleSelect} />
      </div>

      <div className="p-4 pb-3 cursor-pointer" onClick={navigate}>
        <div className="flex items-start gap-3 pr-8">
          <SiteAvatar url={store.url} name={store.name} size={44} />
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-sm truncate">{store.name}</div>
            <div className="text-[11px] text-muted-foreground truncate font-mono">{store.url}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5 truncate">{clientName}</div>
          </div>
        </div>
      </div>

      <div className="px-4 pb-3 flex items-center gap-1.5 flex-wrap">
        {isIncomplete ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-warning/10 text-warning border border-warning/30">
            <AlertTriangle className="h-3 w-3" />
            Setup incomplete
          </span>
        ) : (
          <StatusBadge variant={getStatusVariant(store.status)}>{store.status}</StatusBadge>
        )}
        <span
          className={`inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-md border ${
            wcConnected ? "text-emerald-700 border-emerald-200 bg-emerald-50" : "text-muted-foreground border-border bg-muted"
          }`}
          title={wcConnected ? "WooCommerce API connected" : "WooCommerce API not connected"}
        >
          {wcConnected ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
          WC
        </span>
        <span
          className={`inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-md border ${
            wpConnected ? "text-emerald-700 border-emerald-200 bg-emerald-50" : "text-muted-foreground border-border bg-muted"
          }`}
          title={wpConnected ? "WordPress media access connected" : "WordPress media access not connected"}
        >
          {wpConnected ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
          WP
        </span>
        {store.health_score != null && (
          <span className={`inline-flex items-center gap-1 text-xs font-medium ml-auto ${healthColor}`}>
            <Heart className="h-3 w-3 fill-current" />
            {store.health_score}
          </span>
        )}
      </div>

      <div className="px-4 pb-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Activity className="h-3 w-3" />
        {isIncomplete ? "Never synced" : `Last sync: ${formatDate(store.last_sync_at)}`}
      </div>

      {activeSync && (
        <div className="px-4 pb-2">
          <div className="flex items-center justify-between mb-1 text-[10px] font-medium text-emerald-600">
            <span className="inline-flex items-center gap-1">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
              </span>
              Syncing {activeSync.currentAspect || "…"}
            </span>
            <span className="tabular-nums">{activeSync.progress}%</span>
          </div>
          <div className="h-1 rounded-full bg-emerald-500/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500"
              style={{ width: `${activeSync.progress}%` }}
            />
          </div>
        </div>
      )}

      <div className="mt-auto px-3 py-2 border-t border-border flex items-center gap-1">
        {isIncomplete ? (
          <Button
            variant="default"
            size="sm"
            className="h-8 flex-1 gap-1.5"
            onClick={() => router.push(`/sites/connect/${store.id}?resume=1`)}
          >
            <PlayCircle className="h-3.5 w-3.5" />
            Resume setup
          </Button>
        ) : (
          <>
            <Button
              variant="default"
              size="sm"
              className="h-8 flex-1 gap-1.5"
              disabled={isSyncing}
              onClick={handleSync}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? "animate-spin" : ""}`} />
              {isSyncing ? "Syncing" : "Sync all"}
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit} title="Edit site">
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => router.push(`/projects/${store.id}`)} title="Sync engine">
              <BarChart3 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => window.open(store.url, "_blank")} title="Open storefront">
              <ExternalLink className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}