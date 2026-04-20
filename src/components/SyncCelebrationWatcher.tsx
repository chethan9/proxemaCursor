import { useEffect, useRef, useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthProvider";
import { SyncCelebrationDialog } from "@/components/SyncCelebrationDialog";
import { useToast } from "@/hooks/use-toast";

type StoreSnap = { id: string; name: string; url: string; logo_url: string | null };

let cachedConfetti: object | null = null;

export function SyncCelebrationWatcher() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [queue, setQueue] = useState<StoreSnap[]>([]);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [cardOpen, setCardOpen] = useState(false);
  const [confettiData, setConfettiData] = useState<object | null>(cachedConfetti);
  const enqueuedRef = useRef<Set<string>>(new Set());
  const prevRunningRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (cachedConfetti) return;
    fetch("/confetti.json").then((r) => r.json()).then((d) => { cachedConfetti = d; setConfettiData(d); }).catch(() => {});
  }, []);

  const invalidateStore = useCallback((storeId: string) => {
    qc.invalidateQueries({ queryKey: ["orders"] });
    qc.invalidateQueries({ queryKey: ["products"] });
    qc.invalidateQueries({ queryKey: ["taxonomy"] });
    qc.invalidateQueries({ queryKey: ["webhooks"] });
    qc.invalidateQueries({ queryKey: ["sync-runs"] });
    qc.invalidateQueries({ queryKey: ["stores"] });
    qc.invalidateQueries({ queryKey: ["active-sync", storeId] });
    qc.invalidateQueries({ queryKey: ["active-syncs-all"] });
  }, [qc]);

  // Optimistic stamp at enqueue time — guarantees exactly-once across refreshes/devices
  const enqueue = useCallback(async (store: StoreSnap) => {
    if (enqueuedRef.current.has(store.id)) return;
    enqueuedRef.current.add(store.id);
    // Stamp immediately so no other tab/session re-shows this
    const stampedAt = new Date().toISOString();
    const { error } = await supabase
      .from("stores")
      .update({ celebration_shown_at: stampedAt })
      .eq("id", store.id)
      .is("celebration_shown_at", null);
    // If stamp failed (row already stamped by another tab), skip silently
    if (error) {
      enqueuedRef.current.delete(store.id);
      return;
    }
    setQueue((q) => [...q, store]);
    invalidateStore(store.id);
  }, [invalidateStore]);

  const checkPending = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("stores")
      .select("id, name, url, logo_url, initial_sync_completed_at, celebration_shown_at")
      .not("initial_sync_completed_at", "is", null)
      .is("celebration_shown_at", null);
    if (!data || data.length === 0) return;
    setTimeout(() => {
      for (const s of data) {
        enqueue({ id: s.id, name: s.name, url: s.url, logo_url: s.logo_url });
      }
    }, 1500);
  }, [user, enqueue]);

  // Initial load + every auth change
  useEffect(() => {
    if (!user) return;
    checkPending();
  }, [user?.id, checkPending]);

  // Re-check when tab becomes visible (covers: sync finished while tab was hidden)
  useEffect(() => {
    if (!user) return;
    const onVis = () => {
      if (document.visibilityState === "visible") {
        checkPending();
        // Also invalidate to pull fresh data
        qc.invalidateQueries({ queryKey: ["orders"] });
        qc.invalidateQueries({ queryKey: ["products"] });
        qc.invalidateQueries({ queryKey: ["taxonomy"] });
        qc.invalidateQueries({ queryKey: ["stores"] });
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [user?.id, checkPending, qc]);

  // Fallback polling every 30s (realtime insurance)
  useEffect(() => {
    if (!user) return;
    const id = setInterval(() => { checkPending(); }, 30000);
    return () => clearInterval(id);
  }, [user?.id, checkPending]);

  // Realtime: watch stores for initial_sync_completed_at transitions
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("store-sync-complete")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "stores" }, (payload) => {
        const newRow = payload.new as { id: string; name: string; url: string; logo_url: string | null; initial_sync_completed_at: string | null; celebration_shown_at: string | null };
        const oldRow = payload.old as { initial_sync_completed_at: string | null };
        // Already-stamped rows filtered out (cross-tab race safety)
        if (newRow.celebration_shown_at) {
          invalidateStore(newRow.id);
          return;
        }
        if (newRow.initial_sync_completed_at && !oldRow.initial_sync_completed_at) {
          enqueue({ id: newRow.id, name: newRow.name, url: newRow.url, logo_url: newRow.logo_url });
        }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "sync_runs" }, (payload) => {
        const newRow = payload.new as { store_id: string; status: string; aspect: string };
        const oldRow = payload.old as { status: string };
        if (newRow.status === "completed" && oldRow.status === "running") {
          invalidateStore(newRow.store_id);
          const wasRunning = prevRunningRef.current.has(newRow.store_id);
          if (wasRunning && newRow.aspect === "all") {
            prevRunningRef.current.delete(newRow.store_id);
            supabase.from("stores").select("name, initial_sync_completed_at, celebration_shown_at").eq("id", newRow.store_id).maybeSingle()
              .then(({ data }) => {
                // Only toast for subsequent syncs (celebration already handled for initial)
                if (data && data.celebration_shown_at) {
                  toast({ title: `${data.name} sync complete ✨`, description: "Latest data is now available" });
                }
              });
          }
        }
        if (newRow.status === "running") prevRunningRef.current.add(newRow.store_id);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (queue.length === 0) return;
    if (overlayOpen || cardOpen) return;
    setOverlayOpen(true);
    const t = setTimeout(() => setCardOpen(true), 900);
    return () => clearTimeout(t);
  }, [queue, overlayOpen, cardOpen]);

  const handleClose = async () => {
    const current = queue[0];
    setCardOpen(false);
    setOverlayOpen(false);
    if (current) invalidateStore(current.id);
    setTimeout(() => setQueue((q) => q.slice(1)), 400);
  };

  const current = queue[0] || null;
  const store = current ? { id: current.id, name: current.name, url: current.url, logo_url: current.logo_url } : null;

  return (
    <SyncCelebrationDialog
      overlayOpen={overlayOpen}
      cardOpen={cardOpen}
      onClose={handleClose}
      store={store}
      animationData={confettiData}
    />
  );
}