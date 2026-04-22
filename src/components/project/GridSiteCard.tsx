import { useState } from "react";
import { useRouter } from "next/router";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Heart, Pencil, ExternalLink, PlayCircle, BarChart3, RefreshCw, CheckCircle2, BadgeCheck } from "lucide-react";
import type { StoreWithClient } from "@/services/storeService";
import { SiteAvatar } from "./SiteAvatar";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-client";
import { UptimeBar } from "./UptimeBar";
import type { UptimePoint } from "@/hooks/queries/useSitesUptime";
import { useSiteScreenshot } from "@/hooks/queries/useSiteScreenshot";

interface Props {
  store: StoreWithClient;
  clientName: string;
  selected: boolean;
  onToggleSelect: () => void;
  onEdit: () => void;
  uptimeHistory?: UptimePoint[];
}

function formatRelative(d: string | null): string {
  if (!d) return "Never";
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function SiteScreenshot({ storeId, url, name }: { storeId: string; url: string; name: string }) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  const { data, isLoading } = useSiteScreenshot(storeId);
  const screenshotUrl = data?.url;

  if (!url) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/5 via-primary/10 to-primary/20">
        <SiteAvatar url={url} name={name} size={56} />
      </div>
    );
  }

  if (errored || (!screenshotUrl && !isLoading)) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/5 via-primary/10 to-primary/20">
        <SiteAvatar url={url} name={name} size={56} />
      </div>
    );
  }

  return (
    <>
      {(!loaded || !screenshotUrl) && (
        <div className="absolute inset-0 bg-gradient-to-br from-muted via-muted to-muted/60 animate-pulse flex items-center justify-center">
          <SiteAvatar url={url} name={name} size={40} className="opacity-40" />
        </div>
      )}
      {screenshotUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={screenshotUrl}
          alt={`${name} preview`}
          className={`w-full h-full object-cover object-top transition-opacity duration-500 ${loaded ? "opacity-100" : "opacity-0"}`}
          onLoad={() => setLoaded(true)}
          onError={() => setErrored(true)}
          loading="lazy"
        />
      )}
    </>
  );
}

export function GridSiteCard({ store, clientName, selected, onToggleSelect, onEdit, uptimeHistory }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [syncing, setSyncing] = useState(false);

  const isIncomplete = !store.onboarding_completed_at;
  const wcConnected = !!store.consumer_key && !isIncomplete;
  const wpConnected = !!(store.wp_username && store.wp_app_password);

  const healthTone =
    store.health_score == null ? "text-muted-foreground" :
    store.health_score >= 80 ? "text-emerald-600" :
    store.health_score >= 50 ? "text-amber-600" : "text-red-600";

  const ringTone =
    isIncomplete ? "ring-1 ring-amber-300/60" :
    store.status === "error" ? "ring-1 ring-red-300/60" :
    "ring-1 ring-transparent";

  const statusDot =
    isIncomplete ? "bg-amber-400" :
    store.status === "error" ? "bg-red-500" :
    store.status === "syncing" ? "bg-blue-500" :
    store.status === "connected" ? "bg-emerald-500" :
    "bg-slate-400";

  const statusLabel = isIncomplete ? "Setup incomplete" : (store.status || "unknown");

  const navigateToSite = () => {
    if (isIncomplete) router.push(`/sites/connect/${store.id}?resume=1`);
    else router.push(`/sites/${store.id}/home`);
  };

  const handleSync = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isIncomplete || syncing) return;
    setSyncing(true);
    try {
      const res = await fetch(`/api/stores/${store.id}/sync-start`, { method: "POST" });
      if (!res.ok) throw new Error();
      toast({ title: "Sync started", description: store.name });
      qc.invalidateQueries({ queryKey: queryKeys.stores });
    } catch {
      toast({ title: "Failed to start sync", description: store.name, variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className={`group rounded-2xl border border-border bg-card overflow-hidden flex flex-col transition-all hover:shadow-md ${ringTone}`}>
      <div className="relative p-1.5 pb-0">
        <div className="relative rounded-xl overflow-hidden aspect-[16/11] bg-muted cursor-pointer" onClick={navigateToSite}>
          <SiteScreenshot storeId={store.id} url={store.url || ""} name={store.name} />
          <div className="absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-black/50 to-transparent pointer-events-none" />
          <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-1 rounded-full bg-black/55 backdrop-blur-sm">
            <span className={`h-1.5 w-1.5 rounded-full ${statusDot}`} />
            <span className="text-[10px] font-medium text-white capitalize">{statusLabel}</span>
          </div>
          <div
            className="absolute top-2 right-2 h-7 w-7 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center hover:bg-black/60 transition-colors opacity-0 group-hover:opacity-100 data-[checked=true]:opacity-100"
            data-checked={selected}
            onClick={(e) => e.stopPropagation()}
          >
            <Checkbox
              checked={selected}
              onCheckedChange={onToggleSelect}
              className="border-white data-[state=checked]:bg-white data-[state=checked]:text-black h-4 w-4"
            />
          </div>
        </div>
      </div>

      <div className="p-2.5 flex flex-col gap-2 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-sm truncate">{store.name}</span>
              {wcConnected && <BadgeCheck className="h-4 w-4 text-blue-500 shrink-0" />}
            </div>
            <div className="text-[11px] text-muted-foreground truncate font-mono">{store.url.replace(/^https?:\/\//, "")}</div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[11px] text-muted-foreground truncate">{clientName}</span>
              {wpConnected && (
                <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-600 font-medium shrink-0">
                  <CheckCircle2 className="h-2.5 w-2.5" />
                  WP
                </span>
              )}
            </div>
          </div>
          {uptimeHistory && uptimeHistory.length > 0 && (
            <UptimeBar history={uptimeHistory} className="w-[78px] shrink-0 pt-0.5" />
          )}
        </div>

        <div className="grid grid-cols-3 border-y border-border py-1.5">
          <div className="text-center px-1">
            <div className={`flex items-center justify-center gap-1 text-sm font-semibold ${healthTone}`}>
              {store.health_score != null ? (
                <>
                  <Heart className="h-3 w-3 fill-current" />
                  {store.health_score}
                </>
              ) : "—"}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">Health</div>
          </div>
          <div className="text-center px-1 border-x border-border">
            <div className="text-sm font-semibold truncate">{isIncomplete ? "—" : formatRelative(store.last_sync_at)}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">Last Sync</div>
          </div>
          <div className="text-center px-1">
            <div className="text-sm font-semibold capitalize truncate">{isIncomplete ? "Setup" : store.status || "—"}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">Status</div>
          </div>
        </div>

        <div className="flex items-center gap-1 mt-auto">
          {isIncomplete ? (
            <Button
              size="sm"
              className="flex-1 rounded-full h-8 gap-1.5 text-xs"
              onClick={(e) => { e.stopPropagation(); router.push(`/sites/connect/${store.id}?resume=1`); }}
            >
              <PlayCircle className="h-3.5 w-3.5" />
              Resume setup
            </Button>
          ) : (
            <>
              <Button
                size="sm"
                variant="ghost"
                className="flex-1 rounded-full h-8 gap-1 bg-primary/10 hover:bg-primary/20 text-primary font-medium text-xs"
                onClick={handleSync}
                disabled={syncing}
              >
                <RefreshCw className={`h-3 w-3 ${syncing ? "animate-spin" : ""}`} />
                {syncing ? "..." : "Sync all"}
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-full shrink-0"
                onClick={(e) => { e.stopPropagation(); onEdit(); }}
                title="Edit site"
              >
                <Pencil className="h-3 w-3" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-full shrink-0"
                onClick={(e) => { e.stopPropagation(); router.push(`/projects/${store.id}`); }}
                title="Sync engine"
              >
                <BarChart3 className="h-3 w-3" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-full shrink-0"
                onClick={(e) => { e.stopPropagation(); window.open(store.url, "_blank"); }}
                title="Open store"
              >
                <ExternalLink className="h-3 w-3" />
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}