import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import type { PersistedClient } from "@tanstack/react-query-persist-client";

const KEY = "woosync-query-cache";

export function createPersister() {
  if (typeof window === "undefined") return null;
  return createSyncStoragePersister({
    storage: window.localStorage,
    key: KEY,
    throttleTime: 1000,
    serialize: (data: PersistedClient) => JSON.stringify(data),
    deserialize: (raw: string) => JSON.parse(raw) as PersistedClient,
  });
}

/** Clear persisted cache (call on sign-out or user switch). */
export function clearPersistedCache() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch { /* ignore */ }
}

/** Get current bust key stored alongside cache (user id). */
export function getCacheBustKey(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(KEY + ":user");
}

export function setCacheBustKey(userId: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (userId) window.localStorage.setItem(KEY + ":user", userId);
    else window.localStorage.removeItem(KEY + ":user");
  } catch { /* ignore */ }
}