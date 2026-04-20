import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const DISMISS_KEY_PREFIX = "initial-sync-banner-dismissed:";

export function InitialSyncBanner() {
  const router = useRouter();
  const siteId = typeof router.query.id === "string" ? router.query.id : null;
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!siteId) { setVisible(false); return; }

    const dismissKey = DISMISS_KEY_PREFIX + siteId;
    if (typeof window !== "undefined" && sessionStorage.getItem(dismissKey) === "1") {
      setDismissed(true);
    }

    let cancelled = false;
    const check = async () => {
      const { data } = await supabase
        .from("stores")
        .select("onboarding_completed_at, initial_sync_completed_at")
        .eq("id", siteId)
        .maybeSingle();
      if (cancelled) return;
      const shouldShow = !!data?.onboarding_completed_at && !data?.initial_sync_completed_at;
      setVisible(shouldShow);
    };
    check();
    const interval = setInterval(check, 5000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [siteId]);

  if (!visible || dismissed || !siteId) return null;

  const handleDismiss = () => {
    sessionStorage.setItem(DISMISS_KEY_PREFIX + siteId, "1");
    setDismissed(true);
  };

  return (
    <div className="bg-primary/5 border-b border-primary/20 px-4 py-2 flex items-center gap-3 text-xs">
      <Loader2 className="h-3.5 w-3.5 animate-spin text-primary shrink-0" />
      <span className="flex-1 text-foreground/80">
        Initial sync in progress — performance will be fully optimized once complete.
      </span>
      <button
        onClick={handleDismiss}
        className="text-muted-foreground hover:text-foreground p-1 rounded"
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}