import { useQuery } from "@tanstack/react-query";
import { getSubscriptionByClient } from "@/services/subscriptionService";
import { useAuth } from "@/contexts/AuthProvider";
import { hasAccess, effectiveStatus, daysUntilLock } from "@/lib/subscription-state";

export function useSubscription() {
  const { user, profile } = useAuth();
  const clientId = profile?.client_id ?? null;

  const q = useQuery({
    queryKey: ["subscription", clientId],
    queryFn: () => (clientId ? getSubscriptionByClient(clientId) : null),
    enabled: !!clientId && !!user,
    staleTime: 60_000,
  });

  const sub = q.data ?? null;
  return {
    subscription: sub,
    isLoading: q.isLoading,
    hasAccess: hasAccess(sub),
    effectiveStatus: effectiveStatus(sub),
    daysUntilLock: daysUntilLock(sub),
    refetch: q.refetch,
  };
}
