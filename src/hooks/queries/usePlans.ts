import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchAllPlans, fetchActivePlans, createPlan, updatePlan, deletePlan } from "@/services/planService";
import type { Plan, PlanInsert, PlanUpdate } from "@/services/planService";

export function usePlans() {
  return useQuery({
    queryKey: ["plans", "active"],
    queryFn: fetchActivePlans,
    staleTime: 5 * 60 * 1000,
  });
}

export function usePlansAdmin() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["plans", "all"],
    queryFn: fetchAllPlans,
    staleTime: 60 * 1000,
  });

  const saveMutation = useMutation({
    mutationFn: async (input: Partial<Plan>) => {
      if (input.id) {
        const { id, ...rest } = input;
        return updatePlan(id, rest as PlanUpdate);
      }
      return createPlan(input as PlanInsert);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["plans"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deletePlan,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["plans"] });
    },
  });

  return {
    plans: query.data,
    isLoading: query.isLoading,
    save: saveMutation.mutateAsync,
    isSaving: saveMutation.isPending,
    delete: (id: string) => deleteMutation.mutate(id),
    isDeleting: deleteMutation.isPending,
  };
}