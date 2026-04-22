import { Search, Plus, LayoutGrid, List, Grid3x3 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import type { Client } from "@/services/clientService";
import type { StoreWithClient } from "@/services/storeService";

export type ViewMode = "list" | "grid" | "compact";
export type StatusFilter = "all" | "connected" | "syncing" | "error" | "pending";
export type HealthFilter = "all" | "healthy" | "warning" | "critical" | "unknown";
export type SortOption = "name-asc" | "name-desc" | "last-sync-desc" | "last-sync-asc" | "health-desc" | "health-asc" | "created-desc" | "created-asc";

interface Props {
  searchQuery: string;
  onSearchChange: (v: string) => void;
  clientId: string;
  onClientChange: (v: string) => void;
  clients: Client[];
  stores: StoreWithClient[];
  status: StatusFilter;
  onStatusChange: (v: StatusFilter) => void;
  health: HealthFilter;
  onHealthChange: (v: HealthFilter) => void;
  sort: SortOption;
  onSortChange: (v: SortOption) => void;
  viewMode: ViewMode;
  onViewModeChange: (v: ViewMode) => void;
  onAddSite: () => void;
  filteredCount: number;
  totalCount: number;
}

export function ProjectsToolbar(props: Props) {
  const {
    searchQuery, onSearchChange, clientId, onClientChange, clients, stores,
    status, onStatusChange, health, onHealthChange, sort, onSortChange,
    viewMode, onViewModeChange, onAddSite, filteredCount, totalCount,
  } = props;

  const clientCounts = new Map<string, number>();
  for (const s of stores) {
    const key = s.client_id || "unassigned";
    clientCounts.set(key, (clientCounts.get(key) ?? 0) + 1);
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="relative flex-1 min-w-[220px] max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Search sites..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10 h-9"
        />
      </div>

      <Select value={clientId} onValueChange={onClientChange}>
        <SelectTrigger className="h-9 w-[170px]">
          <SelectValue placeholder="Client" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All clients ({totalCount})</SelectItem>
          {clients.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name} ({clientCounts.get(c.id) ?? 0})
            </SelectItem>
          ))}
          <SelectItem value="unassigned">Unassigned ({clientCounts.get("unassigned") ?? 0})</SelectItem>
        </SelectContent>
      </Select>

      <Select value={status} onValueChange={(v) => onStatusChange(v as StatusFilter)}>
        <SelectTrigger className="h-9 w-[150px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All status</SelectItem>
          <SelectItem value="connected">Connected</SelectItem>
          <SelectItem value="syncing">Syncing</SelectItem>
          <SelectItem value="error">Error</SelectItem>
          <SelectItem value="pending">Setup incomplete</SelectItem>
        </SelectContent>
      </Select>

      <Select value={health} onValueChange={(v) => onHealthChange(v as HealthFilter)}>
        <SelectTrigger className="h-9 w-[150px]">
          <SelectValue placeholder="Health" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All health</SelectItem>
          <SelectItem value="healthy">Healthy (≥80)</SelectItem>
          <SelectItem value="warning">Warning (50-79)</SelectItem>
          <SelectItem value="critical">Critical (&lt;50)</SelectItem>
          <SelectItem value="unknown">Unknown</SelectItem>
        </SelectContent>
      </Select>

      <Select value={sort} onValueChange={(v) => onSortChange(v as SortOption)}>
        <SelectTrigger className="h-9 w-[180px]">
          <SelectValue placeholder="Sort" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="name-asc">Name A-Z</SelectItem>
          <SelectItem value="name-desc">Name Z-A</SelectItem>
          <SelectItem value="last-sync-desc">Last sync newest</SelectItem>
          <SelectItem value="last-sync-asc">Last sync oldest</SelectItem>
          <SelectItem value="health-desc">Health high to low</SelectItem>
          <SelectItem value="health-asc">Health low to high</SelectItem>
          <SelectItem value="created-desc">Created newest</SelectItem>
          <SelectItem value="created-asc">Created oldest</SelectItem>
        </SelectContent>
      </Select>

      <div className="inline-flex items-center rounded-md border border-input bg-background p-0.5 h-9">
        <Button type="button" variant={viewMode === "list" ? "secondary" : "ghost"} size="sm" className="h-7 w-8 p-0" onClick={() => onViewModeChange("list")} title="List view">
          <List className="h-4 w-4" />
        </Button>
        <Button type="button" variant={viewMode === "grid" ? "secondary" : "ghost"} size="sm" className="h-7 w-8 p-0" onClick={() => onViewModeChange("grid")} title="Grid view">
          <LayoutGrid className="h-4 w-4" />
        </Button>
        <Button type="button" variant={viewMode === "compact" ? "secondary" : "ghost"} size="sm" className="h-7 w-8 p-0" onClick={() => onViewModeChange("compact")} title="Compact view">
          <Grid3x3 className="h-4 w-4" />
        </Button>
      </div>

      <Badge variant="secondary" className="h-7 text-xs">
        {filteredCount === totalCount ? `${totalCount} site${totalCount !== 1 ? "s" : ""}` : `${filteredCount} of ${totalCount}`}
      </Badge>

      <div className="flex-1" />

      <Button onClick={onAddSite} size="sm" className="h-9">
        <Plus className="h-4 w-4 mr-1.5" />
        Add Site
      </Button>
    </div>
  );
}