import { useQuery } from "@tanstack/react-query";
import { getCurrentUsage } from "@/lib/quota";

export function useBillingUsage(clientId: string | null) {
  return useQuery({
    queryKey: ["billing-usage", clientId],
    queryFn: () => (clientId ? getCurrentUsage(clientId) : null),
    enabled: !!clientId,
    staleTime: 30_000,
  });
}