import { AppLayout } from "@/components/layout/AppLayout";
import { CurrentPlanCard } from "@/components/billing/CurrentPlanCard";
import { UsageMeterCard } from "@/components/billing/UsageMeterCard";
import { useAuth } from "@/contexts/AuthProvider";
import { useBillingUsage } from "@/hooks/queries/useBillingUsage";

export default function BillingPage() {
  const { profile } = useAuth();
  const { data: usage } = useBillingUsage(profile?.client_id ?? null);
  const quotas = { maxSites: 5, maxProducts: 1000, maxUsers: 3 };

  return (
    <AppLayout title="Billing">
      <div className="p-6 max-w-4xl space-y-6">
        <h1 className="text-2xl font-semibold">Billing</h1>
        <CurrentPlanCard />
        {usage && <UsageMeterCard usage={usage} quotas={quotas} />}
      </div>
    </AppLayout>
  );
}