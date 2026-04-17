import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type Client = Tables<"clients">;
export type ClientInsert = TablesInsert<"clients">;
export type ClientUpdate = TablesUpdate<"clients">;

export interface ClientWithStats extends Client {
  store_count: number;
}

export async function getClients(): Promise<ClientWithStats[]> {
  const { data: clients, error } = await supabase
    .from("clients")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching clients:", error);
    throw error;
  }

  // Get store counts for each client
  const { data: storeCounts, error: storeError } = await supabase
    .from("stores")
    .select("client_id");

  if (storeError) {
    console.error("Error fetching store counts:", storeError);
  }

  const countMap = new Map<string, number>();
  storeCounts?.forEach((store) => {
    if (store.client_id) {
      countMap.set(store.client_id, (countMap.get(store.client_id) || 0) + 1);
    }
  });

  return (clients || []).map((client) => ({
    ...client,
    store_count: countMap.get(client.id) || 0,
  }));
}

export async function getClient(id: string): Promise<Client | null> {
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error fetching client:", error);
    return null;
  }

  return data;
}

export async function createClient(client: ClientInsert): Promise<Client> {
  const { data, error } = await supabase
    .from("clients")
    .insert(client)
    .select()
    .single();

  if (error) {
    console.error("Error creating client:", error);
    throw error;
  }

  return data;
}

export async function updateClient(
  id: string,
  updates: ClientUpdate
): Promise<Client> {
  const { data, error } = await supabase
    .from("clients")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating client:", error);
    throw error;
  }

  return data;
}

export async function deleteClient(id: string): Promise<void> {
  const { error } = await supabase.from("clients").delete().eq("id", id);

  if (error) {
    console.error("Error deleting client:", error);
    throw error;
  }
}