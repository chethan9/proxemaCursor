import { useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/integrations/supabase/client";

type CheckoutResponse = {
  subscriptionId: string;
  gateway: "myfatoorah" | "razorpay" | "tap";
  payload: {
    type: string;
    paymentUrl?: string;
    redirectUrl?: string;
    orderId?: string;
    keyId?: string;
    amount?: number;
    currency?: string;
    prefill?: { email: string; name?: string; contact?: string };
  };
};

export function useCheckout() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const startCheckout = async (subscriptionId: string, couponCode?: string) => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ subscriptionId, couponCode }),
      });
      const data = (await res.json()) as CheckoutResponse & { error?: string };
      if (!res.ok) throw new Error(data.error || "Checkout failed");

      if (data.gateway === "tap" && data.payload.redirectUrl) {
        router.push(data.payload.redirectUrl);
        return null;
      }
      if (data.gateway === "myfatoorah" && data.payload.paymentUrl) {
        window.location.href = data.payload.paymentUrl;
        return null;
      }
      return data;
    } finally {
      setLoading(false);
    }
  };

  return { startCheckout, loading };
}
