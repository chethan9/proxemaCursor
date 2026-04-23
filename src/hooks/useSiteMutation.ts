import { useMutation, useQueryClient, type QueryKey, type UseMutationOptions } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

type OptimisticPatch<TVars> = {
  queryKey: QueryKey;
  updater: (old: unknown, vars: TVars) => unknown;
};

export type UseSiteMutationOptions<TData, TVars> = {
  mutationFn: (vars: TVars) => Promise<TData>;
  invalidateKeys?: QueryKey[];
  optimisticUpdates?: OptimisticPatch<TVars>[];
  onSuccessExtra?: (data: TData, vars: TVars) => void;
  onErrorExtra?: (err: unknown, vars: TVars) => void;
  successToast?: string | ((data: TData, vars: TVars) => string);
  errorToast?: string | ((err: unknown) => string);
  siteName?: string;
} & Omit<UseMutationOptions<TData, unknown, TVars, { snapshots: Array<[QueryKey, unknown]> }>, "mutationFn" | "onMutate" | "onError" | "onSuccess" | "onSettled">;

export function useSiteMutation<TData, TVars>(options: UseSiteMutationOptions<TData, TVars>) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const {
    mutationFn,
    invalidateKeys = [],
    optimisticUpdates = [],
    onSuccessExtra,
    onErrorExtra,
    successToast,
    errorToast,
    siteName,
    ...rest
  } = options;

  return useMutation<TData, unknown, TVars, { snapshots: Array<[QueryKey, unknown]> }>({
    ...rest,
    mutationFn,
    onMutate: async (vars) => {
      const snapshots: Array<[QueryKey, unknown]> = [];
      for (const patch of optimisticUpdates) {
        await qc.cancelQueries({ queryKey: patch.queryKey });
        const prev = qc.getQueryData(patch.queryKey);
        snapshots.push([patch.queryKey, prev]);
        qc.setQueryData(patch.queryKey, (old: unknown) => patch.updater(old, vars));
      }
      return { snapshots };
    },
    onError: (err, vars, ctx) => {
      if (ctx?.snapshots) {
        for (const [key, prev] of ctx.snapshots) {
          qc.setQueryData(key, prev);
        }
      }
      const msg = typeof errorToast === "function"
        ? errorToast(err)
        : errorToast ?? (err instanceof Error ? err.message : "Something went wrong");
      toast({ title: "Save failed", description: msg, variant: "destructive" });
      onErrorExtra?.(err, vars);
    },
    onSuccess: (data, vars) => {
      if (successToast) {
        const msg = typeof successToast === "function" ? successToast(data, vars) : successToast;
        toast({
          title: siteName ? `Saved to ${siteName}` : "Saved",
          description: msg,
        });
      }
      onSuccessExtra?.(data, vars);
    },
    onSettled: () => {
      for (const key of invalidateKeys) {
        qc.invalidateQueries({ queryKey: key });
      }
    },
  });
}
