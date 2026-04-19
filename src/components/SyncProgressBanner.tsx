import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { Rocket, Sparkles, X, Package, ShoppingCart, Users, Tag, Layers, Percent } from "lucide-react";
import { useActiveSync } from "@/hooks/queries/useActiveSync";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const SPACE_MESSAGES = [
  "🚀 Calibrating thrusters…",
  "🛰️ Beaming data from orbit…",
  "🌠 Charting data trajectories…",
  "⭐ Syncing stardust from WooCommerce…",
  "🪐 Aligning with Proxima…",
  "✨ Polishing the data nebula…",
];

const ASPECT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  products: Package,
  orders: ShoppingCart,
  customers: Users,
  categories: Layers,
  tags: Tag,
  coupons: Percent,
};

function formatEta(s: number): string {
  if (s < 0) return "Starting sync…";
  if (s <= 0) return "wrapping up";
  if (s < 60) return `~${s}s remaining`;
  const m = Math.ceil(s / 60);
  return `~${m} min remaining`;
}

export function SyncProgressBanner({ storeId }: { storeId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const { data } = useActiveSync(storeId);
  const [msgIdx, setMsgIdx] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const prevRunningRef = useRef(false);
  const hasStartedRef = useRef(false);

  useEffect(() => {
    if (!data?.running) return;
    const t = setInterval(() => setMsgIdx((i) => (i + 1) % SPACE_MESSAGES.length), 4000);
    return () => clearInterval(t);
  }, [data?.running]);

  useEffect(() => {
    if (data?.running) {
      setDismissed(false);
      hasStartedRef.current = true;
    }
  }, [data?.running]);

  useEffect(() => {
    const wasRunning = prevRunningRef.current;
    const isRunning = !!data?.running;
    if (wasRunning && !isRunning && hasStartedRef.current) {
      toast({
        title: "✨ Sync complete",
        description: "Your store is live on Proxima — all data is up to date.",
      });
      hasStartedRef.current = false;
    }
    prevRunningRef.current = isRunning;
  }, [data?.running, toast]);

  if (!data?.running || dismissed) return null;
  const isOnConnect = router.pathname.includes("/sites/connect/");
  if (isOnConnect) return null;

  const pct = data.progress_pct;
  const aspect = data.current_aspect;
  const AspectIcon = aspect ? ASPECT_ICONS[aspect] : null;
  const aspectLabel = aspect ? aspect.charAt(0).toUpperCase() + aspect.slice(1) : "Preparing";

  return (
    <div className="sticky top-0 z-40 border-b border-emerald-500/20 bg-gradient-to-r from-emerald-500/5 via-emerald-500/10 to-emerald-500/5 backdrop-blur-sm">
      <div className="max-w-full px-4 py-2.5 flex items-center gap-3">
        <div className="relative shrink-0">
          <Rocket className="h-4 w-4 text-emerald-600 animate-pulse" />
          <Sparkles className="h-2.5 w-2.5 text-emerald-500/70 absolute -top-1 -right-1 animate-ping" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3 mb-1.5">
            <div className="flex items-center gap-1.5 text-xs font-medium text-foreground truncate">
              {AspectIcon && <AspectIcon className="h-3.5 w-3.5 text-emerald-600 shrink-0" />}
              <span className="truncate">
                {data.is_initial ? "Initial sync" : "Syncing"} · {aspectLabel}
              </span>
              <span className="text-muted-foreground ml-2 hidden md:inline font-normal truncate">{SPACE_MESSAGES[msgIdx]}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[11px] text-muted-foreground tabular-nums hidden sm:inline">
                {formatEta(data.eta_seconds)}
              </span>
              <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-emerald-700 ring-1 ring-emerald-500/20">
                {pct}%
              </span>
            </div>
          </div>
          <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-emerald-950/5">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-500 bg-[length:200%_100%] animate-[shimmer_2s_linear_infinite] transition-[width] duration-500 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
      <style jsx>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}