import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type Store = Tables<"stores">;
export type StoreInsert = TablesInsert<"stores">;
export type StoreUpdate = TablesUpdate<"stores">;

export interface StoreWithClient extends Store {
  client_name: string | null;
}

export async function getStores(): Promise<StoreWithClient[]> {
  const { data, error } = await supabase
    .from("stores")
    .select("*, clients(name)")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching stores:", error);
    throw error;
  }

  return (data || []).map((store) => ({
    ...store,
    client_name: (store.clients as { name: string } | null)?.name || null,
    clients: undefined,
  })) as StoreWithClient[];
}

export async function getStoresByClient(clientId: string): Promise<Store[]> {
  const { data, error } = await supabase
    .from("stores")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching stores:", error);
    throw error;
  }

  return data || [];
}

export async function getStore(id: string): Promise<Store | null> {
  const { data, error } = await supabase
    .from("stores")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error fetching store:", error);
    return null;
  }

  return data;
}

export async function createStore(store: StoreInsert): Promise<Store> {
  const { data, error } = await supabase
    .from("stores")
    .insert(store)
    .select()
    .single();

  if (error) {
    console.error("Error creating store:", error);
    throw error;
  }

  return data;
}

export async function updateStore(
  id: string,
  updates: StoreUpdate
): Promise<Store> {
  const { data, error } = await supabase
    .from("stores")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating store:", error);
    throw error;
  }

  return data;
}

export async function deleteStore(id: string): Promise<void> {
  const { error } = await supabase.from("stores").delete().eq("id", id);

  if (error) {
    console.error("Error deleting store:", error);
    throw error;
  }
}

export async function updateStoreStatus(
  id: string,
  status: Store["status"]
): Promise<Store> {
  return updateStore(id, { status });
}