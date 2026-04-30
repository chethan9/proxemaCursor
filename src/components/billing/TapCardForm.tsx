"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

declare global {
  interface Window {
    CardSDK?: {
      renderSDK: (config: Record<string, unknown>) => void;
      tokenize: () => Promise<{ id: string }>;
    };
  }
}

const SDK_URL = "https://secure.gosell.io/js/sdk/tap.min.js";

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

export interface TapCardFormProps {
  publishableKey: string;
  /** Subscription checkout (billing) */
  subscriptionId?: string;
  /** AI credits top-up checkout */
  aiCreditPurchaseId?: string;
  customerEmail?: string;
  customerName?: string;
  onSuccess: (subscriptionIdOrPurchaseId: string) => void;
  onCancel?: () => void;
}

export function TapCardForm({
  publishableKey,
  subscriptionId,
  aiCreditPurchaseId,
  customerEmail,
  customerName,
  onSuccess,
  onCancel,
}: TapCardFormProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [sdkReady, setSdkReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadScript(SDK_URL);
        if (cancelled) return;
        if (!window.CardSDK) throw new Error("Tap SDK unavailable");
        window.CardSDK.renderSDK({
          publicKey: publishableKey,
          merchant: { id: "" },
          transaction: { mode: "token" },
          customer: {
            first_name: (customerName || "Customer").split(" ")[0],
            last_name: (customerName || "Customer").split(" ").slice(1).join(" ") || "-",
            email: customerEmail || "",
          },
          interface: {
            locale: "en",
            cardDirection: "ltr",
            edges: "curved",
            theme: "light",
          },
          fieldVisibility: { card: { cardHolder: true } },
        });
        setSdkReady(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load payment form");
      }
    })();
    return () => { cancelled = true; };
  }, [publishableKey, customerEmail, customerName]);

  const handlePay = async () => {
    if (!window.CardSDK) return;
    if (!aiCreditPurchaseId && !subscriptionId) {
      setError("Missing checkout context");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const { id: tokenId } = await window.CardSDK.tokenize();
      if (!tokenId) throw new Error("Card tokenization failed");
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Session expired");
      const isAiCredits = Boolean(aiCreditPurchaseId);
      const res = await fetch(isAiCredits ? "/api/ai/credits/tap-charge" : "/api/billing/tap/charge", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify(
          isAiCredits
            ? { purchaseId: aiCreditPurchaseId, tokenId }
            : { subscriptionId, tokenId }
        ),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Charge failed");
      if (data.transactionUrl) {
        window.location.href = data.transactionUrl;
        return;
      }
      const doneId = isAiCredits ? aiCreditPurchaseId : subscriptionId;
      if (!doneId) throw new Error("Missing checkout context");
      onSuccess(doneId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Payment failed");
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {!sdkReady && !error && (
        <div className="flex items-center gap-2 py-10 justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Loading secure form…</span>
        </div>
      )}
      <div id="tap-card-sdk-id" ref={containerRef} className={sdkReady ? "" : "hidden"} />
      {sdkReady && (
        <div className="flex items-center gap-2 pt-2">
          <Button onClick={handlePay} disabled={loading} className="flex-1">
            {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processing…</> : <><Lock className="h-4 w-4 mr-2" />Pay securely</>}
          </Button>
          {onCancel && (
            <Button variant="outline" onClick={onCancel} disabled={loading}>Cancel</Button>
          )}
        </div>
      )}
      {error && (
        <div className="p-3 bg-destructive/10 border border-destructive/30 text-destructive rounded text-sm">
          {error}
        </div>
      )}
    </div>
  );
}
