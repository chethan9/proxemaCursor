import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { openRazorpayCheckout } from "@/lib/razorpay-client";
import { useToast } from "./use-toast";

export function useCheckout() {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  async function startCheckout(planId: string) {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");
      const resp = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ planId }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Checkout failed");

      if (data.gateway === "myfatoorah") {
        window.location.href = data.payload.paymentUrl;
        return null;
      }

      return await new Promise((resolve) => {
        openRazorpayCheckout({
          orderId: data.payload.orderId,
          keyId: data.payload.keyId,
          amount: data.payload.amount,
          currency: data.payload.currency,
          name: "Subscription",
          description: "Plan subscription",
          prefill: data.payload.prefill,
          onSuccess: async () => {
            const vr = await fetch("/api/billing/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ subscriptionId: data.subscriptionId }),
            });
            resolve(await vr.json());
          },
          onDismiss: () => resolve(null),
        });
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Checkout error";
      toast({ title: "Checkout failed", description: msg, variant: "destructive" });
      return null;
    } finally {
      setLoading(false);
    }
  }

  return { startCheckout, loading };
}