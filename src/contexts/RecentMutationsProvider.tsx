"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

export type MutationStatus = "saving" | "saved" | "syncing" | "synced" | "failed";

export interface TrackedMutation {
  key: string;
  entityType: string;
  entityId: string;
  storeId: string;
  status: MutationStatus;
  startedAt: number;
  finishedAt?: number;
  error?: string;
}

interface Ctx {
  mutations: Map<string, TrackedMutation>;
  track: (entityType: string, entityId: string, storeId: string) => void;
  markSaved: (entityType: string, entityId: string) => void;
  markFailed: (entityType: string, entityId: string, error?: string) => void;
}

const RecentMutationsContext = createContext<Ctx | null>(null);

const WEBHOOK_WAIT_MS = 15_000;
const CLEANUP_AFTER_MS = 30_000;
const MAX_AGE_MS = 60_000;

export function RecentMutationsProvider({ children }: { children: ReactNode }) {
  const [mutations, setMutations] = useState<Map<string, TrackedMutation>>(new Map());
  const mutationsRef = useRef(mutations);
  mutationsRef.current = mutations;

  const track = useCallback((entityType: string, entityId: string, storeId: string) => {
    const key = `${entityType}:${entityId}`;
    setMutations((prev) => {
      const next = new Map(prev);
      next.set(key, { key, entityType, entityId, storeId, status: "saving", startedAt: Date.now() });
      return next;
    });
  }, []);

  const markSaved = useCallback((entityType: string, entityId: string) => {
    const key = `${entityType}:${entityId}`;
    setMutations((prev) => {
      const curr = prev.get(key);
      if (!curr) return prev;
      const next = new Map(prev);
      next.set(key, { ...curr, status: "saved" });
      return next;
    });
    // Transition saved → syncing after a brief moment so users see the "Saved" checkmark
    setTimeout(() => {
      setMutations((prev) => {
        const curr = prev.get(key);
        if (!curr || curr.status !== "saved") return prev;
        const next = new Map(prev);
        next.set(key, { ...curr, status: "syncing" });
        return next;
      });
    }, 800);
    // Fallback: if no webhook lands within WEBHOOK_WAIT_MS, assume it synced silently
    setTimeout(() => {
      setMutations((prev) => {
        const curr = prev.get(key);
        if (!curr || curr.status === "synced" || curr.status === "failed") return prev;
        const next = new Map(prev);
        next.set(key, { ...curr, status: "synced", finishedAt: Date.now() });
        return next;
      });
    }, WEBHOOK_WAIT_MS);
  }, []);

  const markFailed = useCallback((entityType: string, entityId: string, error?: string) => {
    const key = `${entityType}:${entityId}`;
    setMutations((prev) => {
      const curr = prev.get(key);
      if (!curr) return prev;
      const next = new Map(prev);
      next.set(key, { ...curr, status: "failed", finishedAt: Date.now(), error });
      return next;
    });
  }, []);

  // Realtime: webhook-delivered entity_changes rows flip tracked entries to synced
  useEffect(() => {
    const channel = supabase
      .channel("recent-mutations")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "entity_changes" },
        (payload: { new: Record<string, unknown> }) => {
          const row = payload.new || {};
          if (row.source !== "webhook") return;
          const entityType = row.entity_type as string | undefined;
          const entityId = row.entity_id as string | undefined;
          if (!entityType || !entityId) return;
          const key = `${entityType}:${entityId}`;
          const curr = mutationsRef.current.get(key);
          if (!curr) return;
          setMutations((prev) => {
            const p = prev.get(key);
            if (!p) return prev;
            const next = new Map(prev);
            next.set(key, { ...p, status: "synced", finishedAt: Date.now() });
            return next;
          });
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  // Auto-cleanup finished entries
  useEffect(() => {
    const interval = setInterval(() => {
      setMutations((prev) => {
        const now = Date.now();
        let changed = false;
        const next = new Map(prev);
        for (const [key, m] of next) {
          const finished = m.status === "synced" || m.status === "failed";
          if (finished && m.finishedAt && now - m.finishedAt > CLEANUP_AFTER_MS) {
            next.delete(key);
            changed = true;
            continue;
          }
          if (now - m.startedAt > MAX_AGE_MS) {
            next.delete(key);
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <RecentMutationsContext.Provider value={{ mutations, track, markSaved, markFailed }}>
      {children}
    </RecentMutationsContext.Provider>
  );
}

export function useRecentMutations() {
  const ctx = useContext(RecentMutationsContext);
  if (!ctx) {
    // Safe fallback when provider missing so pages don't crash
    return {
      mutations: new Map<string, TrackedMutation>(),
      track: () => {},
      markSaved: () => {},
      markFailed: () => {},
    };
  }
  return ctx;
}

export function useMutationStatus(entityType: string, entityId: string | null | undefined): TrackedMutation | null {
  const { mutations } = useRecentMutations();
  if (!entityId) return null;
  return mutations.get(`${entityType}:${entityId}`) || null;
}