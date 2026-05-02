import { supabase } from "@/integrations/supabase/client";
import type { ProductHistoryEntry } from "@/types/product-history";

export async function fetchProductMergedHistory(
  storeId: string,
  productId: string
): Promise<{ entries: ProductHistoryEntry[]; wpRevisionsAvailable: boolean; wpReason?: string }> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("Not authenticated");

  const res = await fetch(`/api/stores/${storeId}/products/${productId}/history`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || `History failed (${res.status})`);
  }
  return res.json() as Promise<{
    entries: ProductHistoryEntry[];
    wpRevisionsAvailable: boolean;
    wpReason?: string;
  }>;
}
