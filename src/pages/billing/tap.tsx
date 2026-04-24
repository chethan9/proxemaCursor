import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { supabase } from "@/integrations/supabase/client";
import { TapCardForm } from "@/components/billing/TapCardForm";
import { Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function TapCheckoutPage() {
  const router = useRouter();
  const subId = typeof router.query.sub === "string" ? router.query.sub : null;
  const [init, setInit] = useState<{ publishableKey: string; subscriptionId: string; customerEmail?: string; customerName?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!subId) return;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setError("Not authenticated"); return; }
      const r = await fetch("/api/billing/tap/init", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ subscriptionId: subId }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error || "Could not initialize checkout"); return; }
      setInit(d);
    })();
  }, [subId]);

  const handleSuccess = (subscriptionId: string) => {
    router.push(`/billing/return?sub=${subscriptionId}`);
  };

  return (
    <div className="min-h-screen bg-muted/30 py-10 px-6">
      <div className="max-w-lg mx-auto">
        <Link href="/pricing" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="h-4 w-4" />Back to pricing
        </Link>
        <div className="bg-background border rounded-xl p-6 shadow-sm">
          <h1 className="text-xl font-semibold mb-1">Complete payment</h1>
          <p className="text-sm text-muted-foreground mb-5">Enter your card details. Your information is secured by Tap Payments.</p>
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
              subscriptionId={init.subscriptionId}
              customerEmail={init.customerEmail}
              customerName={init.customerName}
              onSuccess={handleSuccess}
              onCancel={() => router.push("/pricing")}
            />
          )}
        </div>
        <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground justify-center">
          <span>Secured by</span>
          <span className="font-semibold">Tap Payments</span>
        </div>
      </div>
    </div>
  );
}