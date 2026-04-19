import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { useQueryClient } from "@tanstack/react-query";
import { useActiveSync } from "@/hooks/queries/useActiveSync";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { X, Rocket, Package, ShoppingCart, Users, Tag, FolderTree, Ticket } from "lucide-react";
import { pickAnyMessage } from "@/lib/sync-messages";
import { SyncCelebrationDialog } from "@/components/SyncCelebrationDialog";
import { supabase } from "@/integrations/supabase/client";

const ASPECT_META: Record<string, { Icon: typeof Package }> = {
  products: { Icon: Package },
  orders: { Icon: ShoppingCart },
  customers: { Icon: Users },
  categories: { Icon: FolderTree },
  tags: { Icon: Tag },
  coupons: { Icon: Ticket },
};

function formatElapsed(s: number): string {
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}m ${rem}s`;
}

let cachedConfetti: object | null = null;

export function SyncProgressBanner() {
  const router = useRouter();
  const { toast } = useToast();
  const qc = useQueryClient();
  const storeId = (router.query.id as string) || null;
  const { data } = useActiveSync(storeId);
  const [dismissed, setDismissed] = useState(false);
  const [tick, setTick] = useState(0);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [cardOpen, setCardOpen] = useState(false);
  const [store, setStore] = useState<{ id: string; name: string; url: string } | null>(null);
  const [confettiData, setConfettiData] = useState<object | null>(cachedConfetti);
  const storageKey = storeId ? `sync-display-progress:${storeId}` : null;
  const [displayProgress, setDisplayProgress] = useState<number>(() => {
    if (typeof window === "undefined" || !storageKey) return 0;
    const v = window.localStorage.getItem(storageKey);
    return v ? parseFloat(v) : 0;
  });
  const lastWriteRef = useRef(0);
  const prevRunningRef = useRef(false);

  // Prefetch confetti JSON once
  useEffect(() => {
    if (cachedConfetti) return;
    fetch("/confetti.json")
      .then((r) => r.json())
      .then((d) => { cachedConfetti = d; setConfettiData(d); })
      .catch(() => {});
  }, []);

  // Fetch store row for celebration
  useEffect(() => {
    if (!storeId) { setStore(null); return; }
    supabase
      .from("stores")
      .select("id, name, url")
      .eq("id", storeId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setStore({ id: data.id, name: data.name, url: data.url });
      });
  }, [storeId]);

  // Invalidate store-scoped queries
  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["orders"] });
    qc.invalidateQueries({ queryKey: ["products"] });
    qc.invalidateQueries({ queryKey: ["taxonomy"] });
    qc.invalidateQueries({ queryKey: ["webhooks"] });
    qc.invalidateQueries({ queryKey: ["sync-runs"] });
  };

  // Detect sync completion
  useEffect(() => {
    if (!data) return;
    if (prevRunningRef.current && !data.running) {
      if (data.is_initial && storeId) {
        const key = `celebrated:${storeId}`;
        if (!localStorage.getItem(key)) {
          localStorage.setItem(key, "1");
          setOverlayOpen(true);
          setTimeout(() => setCardOpen(true), 900);
        }
      } else {
        toast({
          title: "Sync complete ✨",
          description: `${data.processed.toLocaleString()} records synced in ${formatElapsed(data.elapsed_seconds)}`,
        });
      }
      invalidateAll();
      if (storageKey) localStorage.removeItem(storageKey);
      setDismissed(false);
    }
    prevRunningRef.current = data.running;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, storeId]);

  // Smooth displayProgress with RAF + floor step + persist
  useEffect(() => {
    const target = data?.progress ?? 0;
    let raf = 0;
    const step = () => {
      setDisplayProgress((cur) => {
        const diff = target - cur;
        if (Math.abs(diff) < 0.1) {
          if (storageKey) {
            localStorage.setItem(storageKey, String(target));
          }
          return target;
        }
        const eased = diff * 0.05;
        const minStep = Math.sign(diff) * 0.3;
        const delta = Math.abs(eased) < Math.abs(minStep) ? minStep : eased;
        const next = cur + delta;
        // Throttle write
        const now = Date.now();
        if (storageKey && now - lastWriteRef.current > 500) {
          lastWriteRef.current = now;
          localStorage.setItem(storageKey, String(next));
        }
        raf = requestAnimationFrame(step);
        return next;
      });
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [data?.progress, storageKey]);

  useEffect(() => {
    if (!data?.running) return;
    const id = setInterval(() => setTick((t) => t + 1), 8000);
    return () => clearInterval(id);
  }, [data?.running]);

  const handleCelebrationClose = () => {
    setCardOpen(false);
    setOverlayOpen(false);
    invalidateAll();
  };

  if (!storeId || !data || !data.running || dismissed) {
    return (
      <SyncCelebrationDialog
        overlayOpen={overlayOpen}
        cardOpen={cardOpen}
        onClose={handleCelebrationClose}
        store={store}
        animationData={confettiData}
      />
    );
  }

  const meta = data.currentAspect ? ASPECT_META[data.currentAspect] : null;
  const Icon = meta?.Icon || Rocket;
  const message = pickAnyMessage(tick);
  const aspectLabel = data.currentAspect
    ? data.currentAspect.charAt(0).toUpperCase() + data.currentAspect.slice(1)
    : "Preparing";

  return (
    <>
      <div className="sticky top-0 z-40 bg-card border-b border-border/60 px-4 py-2.5 shadow-sm">
        <div className="flex items-center gap-4 max-w-7xl mx-auto">
          <div className="flex items-center gap-2 shrink-0">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-semibold text-foreground">Syncing</span>
            <span className="text-muted-foreground text-xs">·</span>
            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-foreground">{aspectLabel}</span>
          </div>

          <div className="w-full max-w-sm relative">
            <div className="h-2.5 rounded-full bg-emerald-500/10 overflow-visible relative">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 relative overflow-hidden"
                style={{ width: `${displayProgress}%` }}
              >
                <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.25),transparent)] bg-[length:200%_100%] animate-[shimmer_1.6s_linear_infinite]" />
              </div>
              <div
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 pointer-events-none"
                style={{ left: `${displayProgress}%` }}
              >
                <div className="relative animate-[rocket-bob_1.8s_ease-in-out_infinite]">
                  <span className="absolute top-1/2 right-full -translate-y-1/2 mr-0.5 w-1 h-1 rounded-full bg-emerald-500 animate-[trail-pulse_0.9s_ease-in-out_infinite]" />
                  <span className="absolute top-1/2 right-full -translate-y-1/2 mr-2 w-0.5 h-0.5 rounded-full bg-emerald-500 animate-[trail-pulse_0.9s_ease-in-out_infinite] [animation-delay:0.15s]" />
                  <span className="absolute top-1/2 right-full -translate-y-1/2 mr-3 w-0.5 h-0.5 rounded-full bg-emerald-500 animate-[trail-pulse_0.9s_ease-in-out_infinite] [animation-delay:0.3s]" />
                  <Rocket className="h-4 w-4 text-primary drop-shadow-sm rotate-45" strokeWidth={2.5} />
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0 ml-auto">
            <span
              key={tick}
              className="text-xs text-muted-foreground w-64 truncate hidden md:inline animate-in fade-in slide-in-from-bottom-1 duration-500 text-right"
            >
              {message}
            </span>
            <span className="text-xs tabular-nums text-muted-foreground hidden lg:inline">Elapsed {formatElapsed(data.elapsed_seconds)}</span>
            <span className="text-xs font-semibold tabular-nums text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full">
              {data.progress}%
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
              onClick={() => setDismissed(true)}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <style jsx global>{`
          @keyframes shimmer {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
          }
          @keyframes rocket-bob {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-1.5px); }
          }
          @keyframes trail-pulse {
            0%, 100% { opacity: 0.3; }
            50% { opacity: 1; }
          }
        `}</style>
      </div>
      <SyncCelebrationDialog
        overlayOpen={overlayOpen}
        cardOpen={cardOpen}
        onClose={handleCelebrationClose}
        store={store}
        animationData={confettiData}
      />
    </>
  );
}