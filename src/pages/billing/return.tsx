import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function BillingReturn() {
  const router = useRouter();
  const [s, setS] = useState<{ state: string; msg?: string }>({ state: "loading" });

  useEffect(() => {
    const subId = router.query.sub;
    if (typeof subId !== "string") return;
    let tries = 0, cancelled = false;
    const poll = async () => {
      if (cancelled) return;
      const r = await fetch("/api/billing/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscriptionId: subId }),
      });
      const d = await r.json();
      if (d.status === "active" || d.status === "already_active") return setS({ state: "active" });
      if (d.status === "failed") return setS({ state: "failed", msg: d.reason });
      if (++tries >= 10) return setS({ state: "pending" });
      setTimeout(poll, 2000);
    };
    poll();
    return () => { cancelled = true; };
  }, [router.query.sub]);

  const title: Record<string, string> = { loading: "Verifying payment", active: "Payment successful", failed: "Payment failed", pending: "Payment pending" };
  const desc: Record<string, string> = {
    loading: "Please wait while we confirm with the gateway.",
    active: "Your subscription is now active.",
    failed: s.msg || "The payment could not be completed.",
    pending: "Confirmation hasn't arrived yet. This can take a few minutes.",
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-muted/30">
      <div className="max-w-md w-full bg-background border rounded-lg p-8 text-center shadow-sm">
        {s.state === "loading" && <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />}
        <h1 className="text-xl font-semibold mb-2">{title[s.state]}</h1>
        <p className="text-sm text-muted-foreground mb-6">{desc[s.state]}</p>
        {s.state !== "loading" && (
          <Link href={s.state === "failed" ? "/pricing" : "/billing"}>
            <Button variant={s.state === "active" ? "default" : "outline"}>
              {s.state === "failed" ? "Try again" : "Go to Billing"}
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}