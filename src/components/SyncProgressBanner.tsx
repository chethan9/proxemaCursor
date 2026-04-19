import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { useActiveSync } from "@/hooks/queries/useActiveSync";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { X, Rocket, Package, ShoppingCart, Users, Tag, FolderTree, Ticket } from "lucide-react";
import { pickMessage } from "@/lib/sync-messages";

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

export function SyncProgressBanner() {
  const router = useRouter();
  const { toast } = useToast();
  const storeId = (router.query.id as string) || null;
  const { data } = useActiveSync(storeId);
  const [dismissed, setDismissed] = useState(false);
  const [tick, setTick] = useState(0);
  const prevRunningRef = useRef(false);
  const prevAspectRef = useRef<string | null>(null);

  useEffect(() => {
    if (!data) return;
    if (prevRunningRef.current && !data.running) {
      toast({
        title: "Sync complete ✨",
        description: `${data.processed.toLocaleString()} records synced in ${formatElapsed(data.elapsed_seconds)}`,
      });
      setDismissed(false);
    }
    prevRunningRef.current = data.running;
  }, [data, toast]);

  useEffect(() => {
    const current = data?.currentAspect || null;
    if (current !== prevAspectRef.current) {
      setTick(0);
      prevAspectRef.current = current;
    }
  }, [data?.currentAspect]);

  useEffect(() => {
    if (!data?.running) return;
    const id = setInterval(() => setTick((t) => t + 1), 4000);
    return () => clearInterval(id);
  }, [data?.running]);

  if (!storeId || !data || !data.running || dismissed) return null;

  const meta = data.currentAspect ? ASPECT_META[data.currentAspect] : null;
  const Icon = meta?.Icon || Rocket;
  const message = pickMessage(data.currentAspect, tick);
  const aspectLabel = data.currentAspect
    ? data.currentAspect.charAt(0).toUpperCase() + data.currentAspect.slice(1)
    : "Preparing";

  // Time-based rocket position: 5min = 99%, caps there
  const rocketPct = Math.min((data.elapsed_seconds / 300) * 100, 99);

  return (
    <div className="sticky top-0 z-40 bg-card border-b border-border/60 px-4 py-2.5 shadow-sm">
      <div className="flex items-center gap-4 max-w-7xl mx-auto">
        {/* Left: fixed width, no text flow */}
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

        {/* Center: progress bar with rocket */}
        <div className="flex-1 min-w-0 relative">
          <div className="h-2.5 rounded-full bg-emerald-500/10 overflow-visible relative">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500 ease-out relative overflow-hidden"
              style={{ width: `${data.progress}%` }}
            >
              <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.25),transparent)] bg-[length:200%_100%] animate-[shimmer_1.6s_linear_infinite]" />
            </div>
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 transition-[left] duration-1000 ease-linear pointer-events-none"
              style={{ left: `${rocketPct}%` }}
            >
              <Rocket className="h-4 w-4 text-primary drop-shadow-sm animate-[rocketWiggle_2s_ease-in-out_infinite]" strokeWidth={2.5} />
            </div>
          </div>
        </div>

        {/* Right: fixed-width region, fun message truncates */}
        <div className="flex items-center gap-3 shrink-0">
          <span
            key={`${data.currentAspect}-${tick}`}
            className="text-xs text-muted-foreground w-48 truncate hidden md:inline animate-in fade-in slide-in-from-bottom-1 duration-500 text-right"
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
        @keyframes rocketWiggle {
          0%, 100% { transform: translateY(0) rotate(-8deg); }
          50% { transform: translateY(-2px) rotate(-4deg); }
        }
      `}</style>
    </div>
  );
}