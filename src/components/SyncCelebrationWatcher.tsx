import { useEffect, useRef, useState } from "react";
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

  const invalidateStore = (storeId: string) => {
    qc.invalidateQueries({ queryKey: ["orders"] });
    qc.invalidateQueries({ queryKey: ["products"] });
    qc.invalidateQueries({ queryKey: ["taxonomy"] });
    qc.invalidateQueries({ queryKey: ["webhooks"] });
    qc.invalidateQueries({ queryKey: ["sync-runs"] });
    qc.invalidateQueries({ queryKey: ["stores"] });
    qc.invalidateQueries({ queryKey: ["active-sync", storeId] });
    qc.invalidateQueries({ queryKey: ["active-syncs-all"] });
  };

  const enqueue = (store: StoreSnap) => {
    if (enqueuedRef.current.has(store.id)) return;
    enqueuedRef.current.add(store.id);
    setQueue((q) => [...q, store]);
  };

  // Initial load + every auth change: pull any stores with completed-but-not-celebrated syncs
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const run = async () => {
      const { data } = await supabase
        .from("stores")
        .select("id, name, url, logo_url, initial_sync_completed_at, celebration_shown_at")
        .not("initial_sync_completed_at", "is", null)
        .is("celebration_shown_at", null);
      if (cancelled || !data) return;
      // Small delay so the app settles before confetti
      setTimeout(() => {
        if (cancelled) return;
        for (const s of data) {
          enqueue({ id: s.id, name: s.name, url: s.url, logo_url: s.logo_url });
        }
      }, 2000);
    };
    run();
    return () => { cancelled = true; };
  }, [user?.id]);

  // Realtime: watch stores for initial_sync_completed_at transitions
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("store-sync-complete")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "stores" }, (payload) => {
        const newRow = payload.new as { id: string; name: string; url: string; logo_url: string | null; initial_sync_completed_at: string | null; celebration_shown_at: string | null };
        const oldRow = payload.old as { initial_sync_completed_at: string | null };
        if (newRow.initial_sync_completed_at && !oldRow.initial_sync_completed_at && !newRow.celebration_shown_at) {
          enqueue({ id: newRow.id, name: newRow.name, url: newRow.url, logo_url: newRow.logo_url });
          invalidateStore(newRow.id);
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
            // Non-initial completion → toast
            supabase.from("stores").select("name, initial_sync_completed_at").eq("id", newRow.store_id).maybeSingle()
              .then(({ data }) => {
                if (data && data.initial_sync_completed_at) {
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

  // Drive the dialog from the queue
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
    if (current) {
      await supabase.from("stores").update({ celebration_shown_at: new Date().toISOString() }).eq("id", current.id);
      invalidateStore(current.id);
    }
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