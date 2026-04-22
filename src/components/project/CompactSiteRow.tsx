import { useRouter } from "next/router";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { StatusBadge, getStatusVariant } from "@/components/ui/status-badge";
import { Store, Heart, Pencil, ExternalLink, PlayCircle, AlertTriangle } from "lucide-react";
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

export function CompactSiteRow({ store, clientName, selected, onToggleSelect, onEdit }: Props) {
  const router = useRouter();
  const isIncomplete = !store.onboarding_completed_at;
  const healthColor =
    store.health_score == null ? "text-muted-foreground" :
    store.health_score >= 80 ? "text-emerald-600" :
    store.health_score >= 50 ? "text-amber-600" : "text-red-600";

  return (
    <div
      className="group flex items-center gap-3 px-3 py-2 border-b border-border last:border-b-0 hover:bg-muted/40 cursor-pointer"
      onClick={() => isIncomplete ? router.push(`/sites/connect/${store.id}?resume=1`) : router.push(`/sites/${store.id}/home`)}
    >
      <div onClick={(e) => e.stopPropagation()} className="shrink-0">
        <Checkbox checked={selected} onCheckedChange={onToggleSelect} />
      </div>
      <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
        <Store className="h-3.5 w-3.5 text-primary" />
      </div>
      <div className="min-w-0 flex-1 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="font-medium text-sm truncate">{store.name}</div>
          <div className="text-[11px] text-muted-foreground truncate font-mono">{store.url}</div>
        </div>
        <div className="text-xs text-muted-foreground w-[140px] truncate hidden md:block">{clientName}</div>
        <div className="w-[140px] hidden sm:block">
          {isIncomplete ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-warning/10 text-warning border border-warning/30">
              <AlertTriangle className="h-3 w-3" />
              Setup incomplete
            </span>
          ) : (
            <StatusBadge variant={getStatusVariant(store.status)}>{store.status}</StatusBadge>
          )}
        </div>
        <div className={`flex items-center gap-1 text-xs font-medium w-[60px] ${healthColor}`}>
          {store.health_score != null ? (
            <>
              <Heart className="h-3 w-3 fill-current" />
              {store.health_score}
            </>
          ) : "—"}
        </div>
        <div className="text-xs text-muted-foreground w-[150px] hidden lg:block">{isIncomplete ? "—" : formatDate(store.last_sync_at)}</div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {isIncomplete ? (
          <Button variant="default" size="sm" className="h-7 px-2 gap-1"
            onClick={(e) => { e.stopPropagation(); router.push(`/sites/connect/${store.id}?resume=1`); }}>
            <PlayCircle className="h-3 w-3" />
            <span className="text-[11px]">Resume</span>
          </Button>
        ) : (
          <>
            <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => { e.stopPropagation(); onEdit(); }} title="Edit">
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => { e.stopPropagation(); window.open(store.url, "_blank"); }} title="Open storefront">
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}