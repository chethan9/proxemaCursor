import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { Rocket, Sparkles, X } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useActiveSync } from "@/hooks/queries/useActiveSync";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const SPACE_MESSAGES = [
  "🚀 Calibrating thrusters…",
  "🛰️ Beaming products from orbit…",
  "🌠 Charting order trajectories…",
  "🌑 Mapping the customer constellation…",
  "⭐ Syncing stardust from WooCommerce…",
  "🪐 Aligning with Proxima…",
  "✨ Polishing the data nebula…",
  "🌌 Almost through the atmosphere…",
];

function formatEta(s: number): string {
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

  const pct = data.progress_pct;
  const aspect = data.current_aspect && data.current_aspect !== "all" ? ` · ${data.current_aspect}` : "";
  const isOnConnect = router.pathname.includes("/sites/connect/");
  if (isOnConnect) return null;

  return (
    <div className="sticky top-0 z-40 border-b border-primary/20 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 backdrop-blur-sm">
      <div className="max-w-full px-4 py-2.5 flex items-center gap-3">
        <div className="relative shrink-0">
          <Rocket className="h-4 w-4 text-primary animate-pulse" />
          <Sparkles className="h-2.5 w-2.5 text-primary/70 absolute -top-1 -right-1 animate-ping" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3 mb-1">
            <div className="text-xs font-medium text-foreground truncate">
              {data.is_initial ? "Initial sync in progress" : "Syncing"}{aspect}
              <span className="text-muted-foreground ml-2 hidden sm:inline">{SPACE_MESSAGES[msgIdx]}</span>
            </div>
            <div className="text-xs text-muted-foreground shrink-0 tabular-nums">
              {pct}% · {formatEta(data.eta_seconds)}
            </div>
          </div>
          <Progress value={pct} className="h-1.5" />
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
    </div>
  );
}