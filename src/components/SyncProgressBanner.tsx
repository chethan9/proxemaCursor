import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { useActiveSync } from "@/hooks/queries/useActiveSync";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { X, Rocket, Package, ShoppingCart, Users, Tag, FolderTree, Ticket } from "lucide-react";

const ASPECT_META: Record<string, { label: string; Icon: typeof Package }> = {
  products: { label: "Products", Icon: Package },
  orders: { label: "Orders", Icon: ShoppingCart },
  customers: { label: "Customers", Icon: Users },
  categories: { label: "Categories", Icon: FolderTree },
  tags: { label: "Tags", Icon: Tag },
  coupons: { label: "Coupons", Icon: Ticket },
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
  const prevRunningRef = useRef(false);

  useEffect(() => {
    if (!data) return;
    if (prevRunningRef.current && !data.running) {
      toast({
        title: "Sync complete",
        description: `${data.processed.toLocaleString()} records synced in ${formatElapsed(data.elapsed_seconds)}`,
      });
      setDismissed(false);
    }
    prevRunningRef.current = data.running;
  }, [data, toast]);

  if (!storeId || !data || !data.running || dismissed) return null;

  const meta = data.currentAspect ? ASPECT_META[data.currentAspect] : null;
  const Icon = meta?.Icon || Rocket;
  const label = meta?.label || "Preparing";

  return (
    <div className="sticky top-0 z-40 bg-card border-b border-border/60 px-4 py-2.5 shadow-sm">
      <div className="flex items-center gap-3 max-w-7xl mx-auto">
        <div className="flex items-center gap-2 shrink-0">
          <Rocket className="h-4 w-4 text-primary animate-pulse" />
          <span className="text-xs font-semibold text-foreground">Initial sync</span>
          <span className="text-muted-foreground text-xs">·</span>
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">{label}</span>
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
          <span className="text-xs tabular-nums text-muted-foreground">Elapsed {formatElapsed(data.elapsed_seconds)}</span>
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