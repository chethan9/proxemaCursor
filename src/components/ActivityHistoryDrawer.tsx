import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { History, Loader2 } from "lucide-react";
import { ActivityFeedRow } from "@/components/ActivityFeedRow";
import { listEntityActivity, type ActivityLogEntry } from "@/services/activityLogService";

interface ActivityHistoryDrawerProps {
  entityType: string;
  entityId: string;
  label?: string;
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
}

export function ActivityHistoryDrawer({
  entityType,
  entityId,
  label = "History",
  variant = "outline",
  size = "sm",
}: ActivityHistoryDrawerProps) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    listEntityActivity(entityType, entityId, 100)
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .catch((e) => {
        console.error("[ActivityHistoryDrawer]", e);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, entityType, entityId]);

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
            <ActivityFeedRow key={entry.id} entry={entry} />
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}