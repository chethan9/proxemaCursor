import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { JsonTableView } from "@/components/JsonTableView";
import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Clock,
  FileText,
  Package,
  ShoppingCart,
  Users,
  Ticket,
  Plus,
  Pencil,
  Trash2,
  TrendingUp,
  RefreshCw,
  Loader2,
} from "lucide-react";

interface EntityChange {
  id: string;
  store_id: string;
  entity_type: string;
  entity_id: string;
  woo_id: number | null;
  entity_name: string | null;
  change_type: string;
  changed_fields: { field: string; old: unknown; new: unknown }[] | null;
  snapshot_before: unknown;
  snapshot_after: unknown;
  source: string;
  created_at: string | null;
}

interface EntityHistoryProps {
  storeId: string;
  entityType?: string;
  entityId?: string;
  wooId?: number;
  limit?: number;
  title?: string;
  showStoreFilter?: boolean;
}

const typeIcons: Record<string, typeof Package> = {
  product: Package,
  order: ShoppingCart,
  customer: Users,
  coupon: Ticket,
};

const changeTypeConfig: Record<string, { label: string; color: string; icon: typeof Plus }> = {
  created: { label: "Created", color: "bg-emerald-100 text-emerald-800", icon: Plus },
  updated: { label: "Updated", color: "bg-blue-100 text-blue-800", icon: Pencil },
  deleted: { label: "Deleted", color: "bg-red-100 text-red-800", icon: Trash2 },
  status_change: { label: "Status Change", color: "bg-purple-100 text-purple-800", icon: TrendingUp },
  stock_change: { label: "Stock Change", color: "bg-amber-100 text-amber-800", icon: Package },
};

function formatFieldValue(val: unknown): string {
  if (val === null || val === undefined) return "—";
  if (typeof val === "boolean") return val ? "Yes" : "No";
  if (typeof val === "number") return val.toLocaleString();
  if (typeof val === "string") return val.length > 60 ? val.substring(0, 60) + "..." : val;
  if (typeof val === "object") return JSON.stringify(val).substring(0, 60) + "...";
  return String(val);
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function EntityHistory({
  storeId,
  entityType,
  entityId,
  wooId,
  limit = 50,
  title = "Change History",
}: EntityHistoryProps) {
  const [changes, setChanges] = useState<EntityChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedChange, setSelectedChange] = useState<EntityChange | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(0);

  const loadChanges = useCallback(async (pageNum: number, append = false) => {
    setLoading(true);
    const timeoutId = setTimeout(() => {
      console.warn("[EntityHistory] query timeout — showing empty state");
      setLoading(false);
    }, 5000);

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query = (supabase as any)
        .from("entity_changes")
        .select("*")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false })
        .range(pageNum * limit, (pageNum + 1) * limit - 1);

      if (entityType) query = query.eq("entity_type", entityType);
      if (entityId) query = query.eq("entity_id", entityId);
      if (wooId) query = query.eq("woo_id", wooId);

      const { data, error } = await query;
      clearTimeout(timeoutId);

      if (error) {
        console.error("Error loading entity changes:", error);
        setLoading(false);
        return;
      }

      const rows = (data || []) as EntityChange[];
      setChanges(prev => append ? [...prev, ...rows] : rows);
      setHasMore(rows.length === limit);
      setLoading(false);
    } catch (e) {
      clearTimeout(timeoutId);
      console.error("Error loading entity changes:", e);
      setLoading(false);
    }
  }, [storeId, entityType, entityId, wooId, limit]);

  useEffect(() => {
    setPage(0);
    loadChanges(0);
  }, [loadChanges]);

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const loadMore = () => {
    const next = page + 1;
    setPage(next);
    loadChanges(next, true);
  };

  if (loading && changes.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (changes.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Clock className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No changes tracked yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Changes from webhooks and syncs will appear here
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">{title}</h3>
        <Badge variant="secondary" className="text-xs">{changes.length} changes</Badge>
      </div>

      <div className="space-y-2">
        {changes.map((change) => {
          const config = changeTypeConfig[change.change_type] || changeTypeConfig.updated;
          const TypeIcon = typeIcons[change.entity_type] || FileText;
          const ChangeIcon = config.icon;
          const isExpanded = expanded.has(change.id);
          const fields = Array.isArray(change.changed_fields) ? change.changed_fields : [];

          return (
            <Card key={change.id} className="overflow-hidden">
              <div
                className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => toggleExpand(change.id)}
              >
                <div className="flex-shrink-0">
                  <TypeIcon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${config.color}`}>
                      <ChangeIcon className="h-3 w-3" />
                      {config.label}
                    </span>
                    <span className="text-sm font-medium truncate">
                      {change.entity_type}{change.entity_name ? `: ${change.entity_name}` : ""}
                    </span>
                    <span className="text-xs text-muted-foreground font-mono">
                      #{change.woo_id || change.entity_id}
                    </span>
                  </div>
                  {fields.length > 0 && !isExpanded && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {fields.slice(0, 3).map(f => f.field.replace(/_/g, " ")).join(", ")}
                      {fields.length > 3 ? ` +${fields.length - 3} more` : ""}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Badge variant="outline" className="text-xs capitalize">{change.source}</Badge>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {change.created_at ? timeAgo(change.created_at) : "—"}
                  </span>
                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
              </div>

              {isExpanded && (
                <div className="border-t bg-muted/20 p-3 space-y-3">
                  {fields.length > 0 && (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs w-[160px]">Field</TableHead>
                          <TableHead className="text-xs">Before</TableHead>
                          <TableHead className="text-xs w-8"></TableHead>
                          <TableHead className="text-xs">After</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {fields.map((f, i) => (
                          <TableRow key={i}>
                            <TableCell className="text-xs font-medium py-1.5">
                              {f.field.replace(/_/g, " ")}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground py-1.5 font-mono">
                              {formatFieldValue(f.old)}
                            </TableCell>
                            <TableCell className="py-1.5">
                              <ArrowRight className="h-3 w-3 text-muted-foreground" />
                            </TableCell>
                            <TableCell className="text-xs py-1.5 font-mono font-medium">
                              {formatFieldValue(f.new)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1.5"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedChange(change);
                      }}
                    >
                      <FileText className="h-3 w-3" />
                      View Full Snapshots
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      {change.created_at ? new Date(change.created_at).toLocaleString() : ""}
                    </span>
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {hasMore && (
        <div className="flex justify-center pt-2">
          <Button variant="outline" size="sm" onClick={loadMore} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Load More
          </Button>
        </div>
      )}

      <Dialog open={!!selectedChange} onOpenChange={() => setSelectedChange(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Full Snapshot — {selectedChange?.entity_type} #{selectedChange?.woo_id || selectedChange?.entity_id}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[65vh]">
            {selectedChange && (
              <div className="space-y-4 p-1">
                {selectedChange.snapshot_before && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2 text-muted-foreground">Before</h4>
                    <JsonTableView data={selectedChange.snapshot_before} />
                  </div>
                )}
                <div>
                  <h4 className="text-sm font-semibold mb-2 text-muted-foreground">After</h4>
                  <JsonTableView data={selectedChange.snapshot_after} />
                </div>
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}