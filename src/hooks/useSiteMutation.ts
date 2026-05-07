import {
  useMutation,
  useQueryClient,
  type InvalidateQueryFilters,
  type QueryKey,
  type UseMutationOptions,
} from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useRecentMutations } from "@/contexts/RecentMutationsProvider";

type OptimisticPatch<TVars> = {
  queryKey: QueryKey;
  updater: (old: unknown, vars: TVars) => unknown;
};

export type TrackConfig<TVars, TData> = {
  entityType: string;
  storeId: string;
  entityId: (vars: TVars, data?: TData) => string | null | undefined;
};

export type UseSiteMutationOptions<TData, TVars> = {
  mutationFn: (vars: TVars) => Promise<TData>;
  invalidateKeys?: QueryKey[];
  /** Applied to every `invalidateQueries` call. Use `{ refetchType: 'all' }` when inactive queries (e.g. the products list while on another page) must refresh before returning. */
  invalidateQueryFilters?: Omit<InvalidateQueryFilters, "queryKey">;
  optimisticUpdates?: OptimisticPatch<TVars>[];
  onSuccessExtra?: (data: TData, vars: TVars) => void;
  onErrorExtra?: (err: unknown, vars: TVars) => void;
  successToast?: string | ((data: TData, vars: TVars) => string);
  errorToast?: string | ((err: unknown) => string);
  siteName?: string;
  track?: TrackConfig<TVars, TData>;
} & Omit<UseMutationOptions<TData, unknown, TVars, { snapshots: Array<[QueryKey, unknown]> }>, "mutationFn" | "onMutate" | "onError" | "onSuccess" | "onSettled">;

export function useSiteMutation<TData, TVars>(options: UseSiteMutationOptions<TData, TVars>) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const recent = useRecentMutations();
  const {
    mutationFn,
    invalidateKeys = [],
    invalidateQueryFilters,
    optimisticUpdates = [],
    onSuccessExtra,
    onErrorExtra,
    successToast,
    errorToast,
    siteName,
    track,
    ...rest
  } = options;

  return useMutation<TData, unknown, TVars, { snapshots: Array<[QueryKey, unknown]> }>({
    ...rest,
    mutationFn,
    onMutate: async (vars) => {
      if (track) {
        const id = track.entityId(vars);
        if (id) recent.track(track.entityType, String(id), track.storeId);
      }
      const snapshots: Array<[QueryKey, unknown]> = [];
      for (const patch of optimisticUpdates) {
        await qc.cancelQueries({ queryKey: patch.queryKey });
        const queries = qc.getQueryCache().findAll({ queryKey: patch.queryKey });
        for (const query of queries) {
          const key = query.queryKey;
          const prev = qc.getQueryData(key);
          snapshots.push([key, prev]);
          qc.setQueryData(key, (old: unknown) => patch.updater(old, vars));
        }
      }
      return { snapshots };
    },
    onError: (err, vars, ctx) => {
      if (ctx?.snapshots) {
        for (const [key, prev] of ctx.snapshots) {
          qc.setQueryData(key, prev);
        }
      }
      if (track) {
        const id = track.entityId(vars);
        if (id) recent.markFailed(track.entityType, String(id), err instanceof Error ? err.message : undefined);
      }
      const msg = typeof errorToast === "function"
        ? errorToast(err)
        : errorToast ?? (err instanceof Error ? err.message : "Something went wrong");
      toast({ title: "Save failed", description: msg, variant: "destructive" });
      onErrorExtra?.(err, vars);
    },
    onSuccess: async (data, vars) => {
      if (track) {
        const id = track.entityId(vars, data);
        if (id) recent.markSaved(track.entityType, String(id));
      }
      await Promise.all(
        invalidateKeys.map((key) => qc.invalidateQueries({ queryKey: key, ...invalidateQueryFilters })),
      );
      if (successToast) {
        const msg = typeof successToast === "function" ? successToast(data, vars) : successToast;
        toast({
          title: siteName ? `Saved to ${siteName}` : "Saved",
          description: msg,
        });
      }
      onSuccessExtra?.(data, vars);
    },
  });
}