import { useRouter } from "next/router";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { StatusBadge, getStatusVariant } from "@/components/ui/status-badge";
import { Store, Heart, Pencil, ExternalLink, PlayCircle, AlertTriangle, BarChart3 } from "lucide-react";
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
  const isIncomplete = !store.onboarding_completed_at;
  const healthColor =
    store.health_score == null ? "text-muted-foreground" :
    store.health_score >= 80 ? "text-emerald-600" :
    store.health_score >= 50 ? "text-amber-600" : "text-red-600";
  const topBorder =
    isIncomplete ? "border-t-amber-500" :
    store.health_score != null && store.health_score >= 80 ? "border-t-emerald-500" :
    store.health_score != null && store.health_score >= 50 ? "border-t-amber-500" :
    store.health_score != null ? "border-t-red-500" : "border-t-border";

  return (
    <div className={`relative rounded-lg border border-border bg-card border-t-[3px] ${topBorder} p-4 flex flex-col gap-3 hover:shadow-sm transition-shadow`}>
      <div className="absolute top-2 right-2 z-10" onClick={(e) => e.stopPropagation()}>
        <Checkbox checked={selected} onCheckedChange={onToggleSelect} />
      </div>
      <div
        className="cursor-pointer pr-8"
        onClick={() => isIncomplete ? router.push(`/sites/connect/${store.id}?resume=1`) : router.push(`/sites/${store.id}/home`)}
      >
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Store className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-sm truncate">{store.name}</div>
            <div className="text-[11px] text-muted-foreground truncate font-mono">{store.url}</div>
            <div className="text-[11px] text-muted-foreground mt-1 truncate">{clientName}</div>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {isIncomplete ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-warning/10 text-warning border border-warning/30">
            <AlertTriangle className="h-3 w-3" />
            Setup incomplete
          </span>
        ) : (
          <StatusBadge variant={getStatusVariant(store.status)}>{store.status}</StatusBadge>
        )}
        {store.health_score != null && (
          <span className={`inline-flex items-center gap-1 text-xs font-medium ${healthColor}`}>
            <Heart className="h-3 w-3 fill-current" />
            {store.health_score}
          </span>
        )}
      </div>
      <div className="text-[11px] text-muted-foreground">
        {isIncomplete ? "Never synced" : `Last sync: ${formatDate(store.last_sync_at)}`}
      </div>
      <div className="flex items-center gap-1 mt-auto pt-2 border-t border-border">
        {isIncomplete ? (
          <Button variant="default" size="sm" className="h-8 flex-1 gap-1.5"
            onClick={() => router.push(`/sites/connect/${store.id}?resume=1`)}>
            <PlayCircle className="h-3.5 w-3.5" />
            Resume setup
          </Button>
        ) : (
          <>
            <Button variant="outline" size="sm" className="h-8 flex-1" onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5 mr-1" />
              Edit
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => router.push(`/projects/${store.id}`)} title="Reports">
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