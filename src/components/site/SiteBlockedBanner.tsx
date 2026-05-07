import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, Shield, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConnectionDiagnostic } from "@/components/project/ConnectionDiagnostic";

interface Props {
  storeId: string;
}

const BLOCKING_SERVICES = ["cloudflare", "sucuri", "wordfence", "aws-waf", "modsecurity", "unknown"] as const;

function parseBlockingService(errorMessage: string | null | undefined): string | null {
  if (!errorMessage) return null;
  const match = errorMessage.match(/\[blocked by ([a-z-]+):/i);
  if (!match) return null;
  const svc = match[1].toLowerCase();
  return (BLOCKING_SERVICES as readonly string[]).includes(svc) ? svc : null;
}

export function SiteBlockedBanner({ storeId }: Props) {
  const [service, setService] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [diagnoseOpen, setDiagnoseOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      const { data: latestFail } = await supabase
        .from("sync_runs")
        .select("error_message, completed_at")
        .eq("store_id", storeId)
        .eq("status", "failed")
        .order("completed_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cancelled) return;
      const detected = parseBlockingService(latestFail?.error_message);
      if (!detected) {
        setService(null);
        return;
      }

      const { data: laterSuccess } = await supabase
        .from("sync_runs")
        .select("id")
        .eq("store_id", storeId)
        .eq("status", "completed")
        .gt("completed_at", latestFail!.completed_at || new Date(0).toISOString())
        .limit(1);

      if (cancelled) return;
      if (laterSuccess && laterSuccess.length > 0) {
        setService(null);
      } else {
        setService(detected);
      }
    }
    check();
    return () => { cancelled = true; };
  }, [storeId]);

  if (!service || dismissed) return null;

  const label = service === "aws-waf" ? "AWS WAF" : service.charAt(0).toUpperCase() + service.slice(1);

  return (
    <>
      <div className="rounded-lg border border-amber-500/40 bg-amber-50 px-4 py-3 flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-amber-900">
            Sync blocked by {label}
          </p>
          <p className="text-xs text-amber-800 mt-0.5">
            The last sync failed because {label} security is blocking our requests. Run the diagnostic to see a copy-paste fix for your site admin.
          </p>
        </div>
        <Button size="sm" variant="outline" className="bg-background shrink-0" onClick={() => setDiagnoseOpen(true)}>
          <Shield className="h-3.5 w-3.5 mr-1.5" />
          Diagnose & Fix
        </Button>
        <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => setDismissed(true)}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <Dialog open={diagnoseOpen} onOpenChange={setDiagnoseOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Connection Diagnostic</DialogTitle>
            <DialogDescription>Three live probes identify exactly what is blocking sync.</DialogDescription>
          </DialogHeader>
          <ConnectionDiagnostic
            storeId={storeId}
            autoRun
            onResolved={() => {
              setDismissed(true);
              setDiagnoseOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}