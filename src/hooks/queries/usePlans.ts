import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchAllPlans, fetchActivePlans, createPlan, updatePlan, deletePlan } from "@/services/planService";
import type { Plan, PlanInsert, PlanUpdate } from "@/services/planService";
import { supabase } from "@/integrations/supabase/client";

async function syncPlanToPolarApi(planId: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return;
  try {
    await fetch(`/api/admin/plans/${planId}/sync-polar`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
  } catch {
    /* non-blocking */
  }
}

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
        const saved = await updatePlan(id, rest as PlanUpdate);
        await syncPlanToPolarApi(saved.id);
        return saved;
      }
      const saved = await createPlan(input as PlanInsert);
      await syncPlanToPolarApi(saved.id);
      return saved;
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
    delete: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
  };
}