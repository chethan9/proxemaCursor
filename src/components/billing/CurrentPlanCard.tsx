import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useSubscription } from "@/hooks/queries/useSubscription";
import { supabase } from "@/integrations/supabase/client";
import { Crown, ArrowUpCircle, Calendar } from "lucide-react";
import type { Tables } from "@/integrations/supabase/helpers";

type Plan = Tables<"plans">;

export function CurrentPlanCard() {
  const { subscription } = useSubscription();
  const [plan, setPlan] = useState<Plan | null>(null);

  useEffect(() => {
    if (!subscription?.plan_id) { setPlan(null); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from("plans").select("*").eq("id", subscription.plan_id).maybeSingle();
      if (!cancelled) setPlan((data as Plan) || null);
    })();
    return () => { cancelled = true; };
  }, [subscription?.plan_id]);

  const status = (subscription?.status || "none") as string;
  const currency = subscription?.currency || "USD";
  const prices = (plan?.prices || {}) as Record<string, number>;
  const price = prices[currency];

  const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    active: "default", trialing: "secondary", past_due: "destructive", locked: "destructive", canceled: "outline", none: "outline",
  };

  if (!subscription) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Crown className="h-4 w-4" />No active plan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">Choose a plan to unlock the full platform.</p>
          <Button asChild size="sm"><Link href="/pricing">View plans</Link></Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Crown className="h-4 w-4 text-amber-500" />
              {plan?.name || "Plan"}
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">{plan?.description || ""}</p>
          </div>
          <Badge variant={statusVariant[status] || "outline"} className="capitalize">{status.replace("_", " ")}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {price !== undefined ? (
          <div>
            <div className="text-2xl font-semibold">{price.toFixed(2)} <span className="text-sm font-normal text-muted-foreground">{currency} / {plan?.billing_interval || "month"}</span></div>
          </div>
        ) : null}
        {subscription.current_period_end ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            <span>Renews {new Date(subscription.current_period_end).toLocaleDateString()}</span>
          </div>
        ) : null}
        <div className="flex gap-2 pt-2">
          <Button asChild size="sm" variant="outline"><Link href="/pricing"><ArrowUpCircle className="h-3.5 w-3.5 mr-1.5" />Change plan</Link></Button>
          <Button asChild size="sm" variant="outline"><Link href="/settings/payment-methods">Payment methods</Link></Button>
        </div>
        <p className="text-xs text-muted-foreground pt-1">Auto-renews via gateway on charge date.</p>
      </CardContent>
    </Card>
  );
}
