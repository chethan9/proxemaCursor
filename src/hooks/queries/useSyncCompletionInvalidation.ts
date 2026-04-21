import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useStoreSyncStatus } from "./useStoreSyncStatus";

/**
 * Watches per-store initial_sync_completed_at and invalidates
 * products/orders/categories/tags queries on false → true transition.
 * Belt-and-braces cache bridge: the useLive flag flips keys, but cached
 * empty live-mode results can still render via keepPreviousData until
 * the DB query resolves. Forcing invalidation ensures fresh fetches.
 */
export function useSyncCompletionInvalidation(storeId: string | undefined) {
  const queryClient = useQueryClient();
  const prevRef = useRef<boolean | null>(null);
  const { data } = useStoreSyncStatus(storeId);

  useEffect(() => {
    if (!storeId || !data) return;
    const done = data.initialSyncDone;
    const prev = prevRef.current;
    prevRef.current = done;
    if (prev === false && done === true) {
      queryClient.invalidateQueries({ queryKey: ["stores", storeId, "products"] });
      queryClient.invalidateQueries({ queryKey: ["stores", storeId, "orders"] });
      queryClient.invalidateQueries({ queryKey: ["taxonomy", "categories", storeId] });
      queryClient.invalidateQueries({ queryKey: ["taxonomy", "tags", storeId] });
      queryClient.invalidateQueries({ queryKey: ["stores", storeId, "taxonomy"] });
    }
  }, [storeId, data, queryClient]);
}