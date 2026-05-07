import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/helpers";

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
  // Read token directly from localStorage — bypasses the browser Supabase client
  // which can hang on getSession() after certain errors.
  let token: string | null = null;
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) throw new Error("Supabase URL not configured");
    const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
    const key = `sb-${projectRef}-auth-token`;
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      token = parsed?.access_token ?? null;
    }
  } catch (e) {
    console.error("[createStore] failed to read session from storage:", e);
  }

  if (!token) throw new Error("Not authenticated");

  const res = await fetch("/api/stores/create", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(store),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error || "Failed to create store");
  }

  const { store: created } = await res.json();
  return created;
}

export async function updateStore(
  id: string,
  updates: StoreUpdate
): Promise<Store> {
  let token: string | null = null;
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) throw new Error("Supabase URL not configured");
    const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
    const key = `sb-${projectRef}-auth-token`;
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      token = parsed?.access_token ?? null;
    }
  } catch (e) {
    console.error("[updateStore] failed to read session:", e);
  }

  if (!token) throw new Error("Not authenticated");

  const res = await fetch(`/api/stores/${id}/update`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(updates),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error || "Failed to update store");
  }

  const { store: updated } = await res.json();
  return updated;
}

export type DeleteStoreProgress = {
  step: number;
  total: number;
  stepKey: string;
};

export type DeleteStoreResult = {
  success?: boolean;
  webhooks_removed: number;
  webhooks_failed: number;
  api_key_removed: boolean;
  api_key_error?: string | null;
  record_counts?: Record<string, number>;
  details?: unknown;
};

function clearStoreDeleteLocalStorage(id: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(`sync-display-progress:${id}`);
    localStorage.removeItem(`celebrated:${id}`);
  } catch {
    /* ignore */
  }
}

export async function deleteStore(id: string, onProgress?: (p: DeleteStoreProgress) => void): Promise<DeleteStoreResult> {
  let token: string | null = null;
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) throw new Error("Supabase URL not configured");
    const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
    const key = `sb-${projectRef}-auth-token`;
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      token = parsed?.access_token ?? null;
    }
  } catch (e) {
    console.error("[deleteStore] failed to read session:", e);
  }

  if (!token) throw new Error("Not authenticated");

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };
  if (onProgress) {
    headers.Accept = "application/x-ndjson, application/json";
  }

  const res = await fetch(`/api/stores/${id}/delete`, {
    method: "DELETE",
    headers,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || err.message || "Failed to delete store");
  }

  const ct = res.headers.get("content-type") || "";

  if (onProgress && res.body && ct.includes("application/x-ndjson")) {
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let finalPayload: DeleteStoreResult | null = null;

    const consumeLine = (trimmed: string) => {
      if (!trimmed) return;
      let msg: {
        type?: string;
        step?: number;
        total?: number;
        stepKey?: string;
        message?: string;
      };
      try {
        msg = JSON.parse(trimmed) as typeof msg;
      } catch {
        return;
      }
      if (msg.type === "progress" && msg.step != null && msg.total != null && msg.stepKey) {
        onProgress({ step: msg.step, total: msg.total, stepKey: msg.stepKey });
      }
      if (msg.type === "error") {
        throw new Error(msg.message || "Failed to delete store");
      }
      if (msg.type === "complete") {
        const { type: _type, ...rest } = msg as { type: string } & DeleteStoreResult;
        finalPayload = rest as DeleteStoreResult;
      }
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        consumeLine(line.trim());
      }
    }

    if (buffer.trim()) {
      consumeLine(buffer.trim());
    }

    if (!finalPayload) throw new Error("Incomplete delete response");
    clearStoreDeleteLocalStorage(id);
    return finalPayload;
  }

  const data = (await res.json()) as DeleteStoreResult;
  clearStoreDeleteLocalStorage(id);
  return data;
}

export async function updateStoreStatus(
  id: string,
  status: Store["status"]
): Promise<Store> {
  return updateStore(id, { status });
}

export async function disconnectWpCredentials(id: string): Promise<Store> {
  return updateStore(id, { wp_username: null, wp_app_password: null });
}