import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/helpers";

export type WebhookWithStore = Tables<"webhooks"> & { store_name?: string; store_url?: string };
export type WebhookEventWithStore = Tables<"webhook_events"> & { store_name?: string };

export function useAllWebhooks() {
  return useQuery({
    queryKey: ["webhooks", "all"] as const,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("webhooks")
        .select("*, stores(name, url)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).map((w) => ({
        ...w,
        store_name: (w.stores as { name: string; url: string } | null)?.name || "Unknown",
        store_url: (w.stores as { name: string; url: string } | null)?.url || "",
      })) as WebhookWithStore[];
    },
    staleTime: 60_000,
  });
}

export function useAllWebhookEvents(limit = 100) {
  return useQuery({
    queryKey: ["webhook-events", "all", limit] as const,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("webhook_events")
        .select("*, stores(name)")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data || []).map((e) => ({
        ...e,
        store_name: (e.stores as { name: string } | null)?.name || "Unknown",
      })) as WebhookEventWithStore[];
    },
    staleTime: 30_000,
  });
}

export function useWebhooksByStore(storeId: string | null | undefined) {
  return useQuery({
    queryKey: ["webhooks", "by-store", storeId] as const,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("webhooks")
        .select("*")
        .eq("store_id", storeId!)
        .order("topic");
      if (error) throw error;
      return data || [];
    },
    enabled: !!storeId,
  });
}