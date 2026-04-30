import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { supabase } from "@/integrations/supabase/client";
import { TapCardForm } from "@/components/billing/TapCardForm";
import { Loader2, ArrowLeft } from "lucide-react";

export default function TapAiCreditsPage() {
  const router = useRouter();
  const purchaseId = typeof router.query.purchase === "string" ? router.query.purchase : null;
  const [init, setInit] = useState<{
    publishableKey: string;
    purchaseId: string;
    customerEmail?: string;
    customerName?: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!purchaseId) return;
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError("Not authenticated");
        return;
      }
      const r = await fetch("/api/ai/credits/tap-init", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ purchaseId }),
      });
      const d = await r.json();
      if (cancelled) return;
      if (!r.ok) {
        setError(d.error || "Could not initialize checkout");
        return;
      }
      setInit(d);
    })();
    return () => {
      cancelled = true;
    };
  }, [purchaseId]);

  const handleSuccess = (id: string) => {
    router.push(`/settings/ai-credits?ai_topup=1&purchase=${id}`);
  };

  return (
    <div className="min-h-screen bg-muted/30 py-10 px-6">
      <div className="max-w-lg mx-auto">
        <Link href="/settings/ai-credits" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="h-4 w-4" />Back to AI credits
        </Link>
        <div className="bg-background border rounded-xl p-6 shadow-sm">
          <h1 className="text-xl font-semibold mb-1">Complete payment</h1>
          <p className="text-sm text-muted-foreground mb-5">AI credits purchase via Tap Payments.</p>
          {error && (
            <div className="p-3 mb-4 bg-destructive/10 border border-destructive/30 text-destructive rounded-md text-sm">{error}</div>
          )}
          {!init && !error && (
            <div className="flex items-center gap-2 py-12 justify-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Preparing secure form…</span>
            </div>
          )}
          {init && (
            <TapCardForm
              publishableKey={init.publishableKey}
              aiCreditPurchaseId={init.purchaseId}
              customerEmail={init.customerEmail}
              customerName={init.customerName}
              onSuccess={handleSuccess}
              onCancel={() => router.push("/settings/ai-credits")}
            />
          )}
        </div>
      </div>
    </div>
  );
}
