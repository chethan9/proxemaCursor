import { Loader2, Lock } from "lucide-react";
import { useStoreSyncStatus } from "@/hooks/queries/useStoreSyncStatus";

export function SyncLockBanner({ storeId }: { storeId: string }) {
  const { data: status } = useStoreSyncStatus(storeId);
  if (!status) return null;
  if (status.initialSyncDone) return null;
  return (
    <div className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm">
      <Loader2 className="h-4 w-4 mt-0.5 shrink-0 animate-spin text-warning" />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground">
          Live preview mode — initial import in progress
        </p>
        <p className="text-muted-foreground mt-0.5">
          Data is fetched directly from your WooCommerce store. Search, status filters and pagination work normally. Advanced filters, sorts, edits, exports and bulk actions <Lock className="inline h-3 w-3 mb-0.5" /> unlock once import completes.
        </p>
      </div>
    </div>
  );
}

export function useSyncLocked(storeId: string): { locked: boolean; ready: boolean } {
  const { data: status } = useStoreSyncStatus(storeId);
  if (!status) return { locked: true, ready: false };
  return { locked: !status.initialSyncDone, ready: true };
}