import { useQuery } from "@tanstack/react-query";
import { getSubscriptionByClient } from "@/services/subscriptionService";
import { useAuth } from "@/contexts/AuthProvider";
import { useAppSettings } from "@/hooks/queries/useAppSettings";
import { hasAccess, effectiveStatus, daysUntilLock } from "@/lib/subscription-state";

export function useSubscription() {
  const { user, profile } = useAuth();
  const { settings } = useAppSettings();
  const clientId = profile?.client_id ?? null;

  const q = useQuery({
    queryKey: ["subscription", clientId],
    queryFn: () => (clientId ? getSubscriptionByClient(clientId) : null),
    enabled: !!clientId && !!user,
    staleTime: 60_000,
  });

  const sub = q.data ?? null;
  const baseAccess = hasAccess(sub);
  const access = settings.billingEnforcementEnabled ? baseAccess : true;
  return {
    subscription: sub,
    isLoading: q.isLoading,
    hasAccess: access,
    effectiveStatus: effectiveStatus(sub),
    daysUntilLock: daysUntilLock(sub),
    refetch: q.refetch,
  };
}
