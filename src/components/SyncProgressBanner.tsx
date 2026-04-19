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

  return (
    <div className="sticky top-0 z-40 bg-card border-b border-border/60 px-4 py-2.5 shadow-sm">
      <div className="flex items-center gap-3 max-w-7xl mx-auto">
        <div className="flex items-center gap-2 shrink-0 min-w-0 max-w-[55%]">
          <Rocket className="h-4 w-4 text-primary shrink-0 animate-pulse" />
          <span className="text-xs font-semibold text-foreground shrink-0">Syncing</span>
          <span className="text-muted-foreground text-xs shrink-0">·</span>
          <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-xs font-medium text-foreground shrink-0">{aspectLabel}</span>
          <span className="text-muted-foreground text-xs shrink-0 hidden sm:inline">·</span>
          <span
            key={`${data.currentAspect}-${tick}`}
            className="text-xs text-muted-foreground truncate hidden sm:inline animate-in fade-in slide-in-from-bottom-1 duration-500"
          >
            {message}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="h-2 rounded-full bg-emerald-500/10 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500 ease-out relative"
              style={{ width: `${data.progress}%` }}
            >
              <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.25),transparent)] bg-[length:200%_100%] animate-[shimmer_1.6s_linear_infinite]" />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs tabular-nums text-muted-foreground hidden md:inline">Elapsed {formatElapsed(data.elapsed_seconds)}</span>
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
      `}</style>
    </div>
  );
}