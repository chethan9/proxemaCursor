import { useQuery } from "@tanstack/react-query";
import { listPaymentMethods, type PaymentMethodRow } from "@/services/paymentMethodService";
import { queryKeys } from "@/lib/query-client";

export function usePaymentMethods() {
  return useQuery({
    queryKey: queryKeys.paymentMethods,
    queryFn: listPaymentMethods,
    staleTime: 10 * 60_000,
    select: (list): Record<string, PaymentMethodRow> => {
      const map: Record<string, PaymentMethodRow> = {};
      list.forEach((r) => { map[r.key] = r; });
      return map;
    },
  });
}