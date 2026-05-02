import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { History, Loader2 } from "lucide-react";
import { ActivityFeedRow } from "@/components/ActivityFeedRow";
import { listEntityActivity, type ActivityLogEntry } from "@/services/activityLogService";
import { fetchProductMergedHistory } from "@/services/productHistoryService";
import type { ProductHistoryEntry } from "@/types/product-history";

interface ActivityHistoryDrawerProps {
  entityType: string;
  entityId: string;
  /** When set with entityType `product`, loads merged platform + WooCommerce + WP revisions. */
  storeId?: string;
  label?: string;
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
}

export function ActivityHistoryDrawer({
  entityType,
  entityId,
  storeId,
  label = "History",
  variant = "outline",
  size = "sm",
}: ActivityHistoryDrawerProps) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<(ActivityLogEntry | ProductHistoryEntry)[]>([]);
  const [loading, setLoading] = useState(false);
  const [wpHint, setWpHint] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setWpHint(null);

    const run =
      entityType === "product" && storeId
        ? fetchProductMergedHistory(storeId, entityId).then((r) => {
            if (!cancelled) {
              setRows(r.entries);
              if (r.wpReason) setWpHint(r.wpReason);
              else if (!r.wpRevisionsAvailable) setWpHint(null);
            }
          })
        : listEntityActivity(entityType, entityId, 100).then((data) => {
            if (!cancelled) setRows(data);
          });

    run
      .catch((e) => {
        console.error("[ActivityHistoryDrawer]", e);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, entityType, entityId, storeId]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant={variant} size={size} className="gap-1.5">
          <History className="h-3.5 w-3.5" />
          {label}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Activity — {entityType}
          </SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-2">
          {wpHint && (
            <p className="text-xs text-muted-foreground rounded-md border border-border bg-muted/40 px-3 py-2">
              WordPress revisions: {wpHint}
            </p>
          )}
          {loading && rows.length === 0 && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
          {!loading && rows.length === 0 && (
            <div className="text-center py-12 text-sm text-muted-foreground">
              No activity recorded for this {entityType}.
            </div>
          )}
          {rows.map((entry) => (
            <ActivityFeedRow key={entry.id} entry={entry as ActivityLogEntry & Partial<ProductHistoryEntry>} />
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}