import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatPrice, getPlanPrice } from "@/services/planService";
import type { Tables } from "@/integrations/supabase/helpers";
import { Check, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "next-i18next";
import { formatNumber } from "@/lib/format-number";

type Plan = Tables<"plans">;

interface Props {
  plan: Plan;
  currency: string;
  billingInterval: "month" | "year";
  isCurrent?: boolean;
  isPopular?: boolean;
  action: "subscribe" | "upgrade" | "downgrade" | "current" | "contact";
  onAction: () => void;
  loading?: boolean;
}

function featuresFor(plan: Plan, locale: string): string[] {
  const base = [
    `Up to ${formatNumber(plan.max_sites, locale)} ${plan.max_sites === 1 ? "site" : "sites"}`,
    `${formatNumber(plan.max_products_per_site, locale)} products per site`,
    `${formatNumber(plan.max_users, locale)} team ${plan.max_users === 1 ? "member" : "members"}`,
    `${formatNumber(plan.max_api_calls_per_month, locale)} API calls/mo`,
  ];
  const flags = (plan.features as Record<string, boolean>) || {};
  if (flags.webhooks) base.push("Real-time webhook sync");
  if (flags.bulk_operations) base.push("Bulk edit & jobs");
  if (flags.advanced_analytics) base.push("Advanced analytics");
  if (flags.priority_support) base.push("Priority support");
  if (flags.sla) base.push("99.9% uptime SLA");
  if (flags.custom_integrations) base.push("Custom integrations");
  return base;
}

export function PlanCard({ plan, currency, billingInterval, isCurrent, isPopular, action, onAction, loading }: Props) {
  const { i18n } = useTranslation();
  const priceMinor = getPlanPrice(plan, currency);
  const effective = billingInterval === "year" && priceMinor != null ? Math.round(priceMinor * 12 * 0.83) : priceMinor;
  const features = featuresFor(plan, i18n.language);

  const cta = () => {
    if (action === "current") return "Current plan";
    if (action === "contact") return "Contact sales";
    if (action === "upgrade") return "Upgrade";
    if (action === "downgrade") return "Downgrade";
    if (plan.trial_days > 0) return `Start ${plan.trial_days}-day trial`;
    return "Get started";
  };

  return (
    <Card className={cn("relative flex flex-col p-6 gap-5 transition-all", isPopular && "border-primary shadow-lg ring-1 ring-primary/20 scale-[1.02]", isCurrent && "border-success")}>
      {isPopular && (
        <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground gap-1">
          <Sparkles className="h-3 w-3" /> Most popular
        </Badge>
      )}
      {isCurrent && (
        <Badge className="absolute -top-3 right-4 bg-success text-white">Your plan</Badge>
      )}
      <div>
        <h3 className="text-xl font-semibold">{plan.name}</h3>
        {plan.description && <p className="text-sm text-muted-foreground mt-1 min-h-[2.5rem]">{plan.description}</p>}
      </div>
      <div className="min-h-[4rem]">
        {effective != null ? (
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-bold tracking-tight">{formatPrice(effective, currency)}</span>
            <span className="text-sm text-muted-foreground">/{billingInterval === "year" ? "year" : "month"}</span>
          </div>
        ) : (
          <div className="text-lg font-medium">Contact us for pricing</div>
        )}
        {billingInterval === "year" && effective != null && (
          <p className="text-xs text-success mt-1">Save 17% billed annually</p>
        )}
      </div>
      <Button
        onClick={onAction}
        disabled={loading || isCurrent || (action !== "contact" && priceMinor == null)}
        variant={isPopular ? "default" : action === "current" ? "outline" : action === "downgrade" ? "outline" : "default"}
        className="w-full"
      >
        {loading ? "Processing..." : cta()}
      </Button>
      <ul className="space-y-2.5 text-sm">
        {features.map((f) => (
          <li key={f} className="flex gap-2">
            <Check className="h-4 w-4 text-success shrink-0 mt-0.5" />
            <span>{f}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}