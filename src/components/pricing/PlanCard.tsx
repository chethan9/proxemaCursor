import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/services/planService";
import type { Tables } from "@/integrations/supabase/types";

export function PlanCard({ plan, currency, onSubscribe, loading }: { plan: Tables<"plans">; currency: string; onSubscribe: () => void; loading: boolean }) {
  const p = (plan.prices as Record<string, number>)[currency];
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <h3 className="text-lg font-semibold">{plan.name}</h3>
        <p className="text-sm text-muted-foreground">{plan.description}</p>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-4">
        {p ? (
          <div className="text-3xl font-semibold">{formatPrice(p, currency)}<span className="text-sm text-muted-foreground"> /{plan.billing_interval}</span></div>
        ) : (
          <p className="text-lg">Contact sales</p>
        )}
        <p className="text-sm flex-1">{plan.max_sites} sites · {plan.max_products_per_site.toLocaleString()} products · {plan.max_users} users</p>
        <Button onClick={onSubscribe} disabled={loading || !p} className="w-full">{!p ? "Contact us" : loading ? "Processing..." : plan.trial_days > 0 ? `Start ${plan.trial_days}-day trial` : "Subscribe"}</Button>
      </CardContent>
    </Card>
  );
}