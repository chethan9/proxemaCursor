import { useRouter } from "next/router";
import { Checkbox } from "@/components/ui/checkbox";
import { Heart, AlertTriangle } from "lucide-react";
import { SiteAvatar } from "./SiteAvatar";
import type { StoreWithClient } from "@/services/storeService";

interface Props {
  store: StoreWithClient;
  clientName: string;
  selected: boolean;
  onToggleSelect: () => void;
  onEdit: () => void;
}

export function CompactSiteRow({ store, clientName, selected, onToggleSelect }: Props) {
  const router = useRouter();
  const isIncomplete = !store.onboarding_completed_at;

  const healthColor =
    store.health_score == null ? "text-muted-foreground" :
    store.health_score >= 80 ? "text-emerald-600" :
    store.health_score >= 50 ? "text-amber-600" : "text-red-600";

  const statusDot =
    isIncomplete ? "bg-amber-500" :
    store.status === "connected" ? "bg-emerald-500" :
    store.status === "syncing" ? "bg-blue-500" :
    store.status === "error" ? "bg-red-500" :
    "bg-muted-foreground";

  const topBorder =
    isIncomplete ? "border-t-amber-500" :
    store.status === "error" ? "border-t-red-500" :
    store.health_score != null && store.health_score >= 80 ? "border-t-emerald-500" :
    store.health_score != null && store.health_score >= 50 ? "border-t-amber-500" :
    store.health_score != null ? "border-t-red-500" :
    "border-t-border";

  return (
    <div
      className={`relative group rounded-lg border border-border bg-card border-t-[2px] ${topBorder} p-3 flex flex-col gap-2 hover:shadow-sm hover:border-primary/30 transition-all cursor-pointer`}
      onClick={() => isIncomplete ? router.push(`/sites/connect/${store.id}?resume=1`) : router.push(`/sites/${store.id}/home`)}
    >
      <div className="absolute top-1.5 right-1.5 z-10 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
        <Checkbox checked={selected} onCheckedChange={onToggleSelect} />
      </div>

      <div className="flex items-start gap-2 pr-6">
        <SiteAvatar url={store.url} name={store.name} size={32} />
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-xs truncate">{store.name}</div>
          <div className="text-[10px] text-muted-foreground truncate font-mono">{store.url}</div>
        </div>
      </div>

      <div className="text-[10px] text-muted-foreground truncate">{clientName}</div>

      <div className="flex items-center justify-between gap-2 mt-auto pt-1 border-t border-border">
        <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
          {isIncomplete ? (
            <>
              <AlertTriangle className="h-2.5 w-2.5 text-amber-500" />
              <span className="text-amber-600 font-medium">Incomplete</span>
            </>
          ) : (
            <>
              <span className={`h-1.5 w-1.5 rounded-full ${statusDot}`} />
              <span className="capitalize">{store.status}</span>
            </>
          )}
        </span>
        {store.health_score != null && (
          <span className={`inline-flex items-center gap-0.5 text-[11px] font-medium ${healthColor}`}>
            <Heart className="h-2.5 w-2.5 fill-current" />
            {store.health_score}
          </span>
        )}
      </div>
    </div>
  );
}