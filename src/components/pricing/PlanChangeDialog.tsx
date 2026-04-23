import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { formatPrice } from "@/services/planService";
import type { Tables } from "@/integrations/supabase/helpers";

type Plan = Tables<"plans">;

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mode: "upgrade" | "downgrade";
  currentPlan: Plan | null;
  newPlan: Plan | null;
  currency: string;
  periodEnd?: string | null;
  onConfirm: () => void;
  loading?: boolean;
}

export function PlanChangeDialog({ open, onOpenChange, mode, currentPlan, newPlan, currency, periodEnd, onConfirm, loading }: Props) {
  if (!newPlan) return null;
  const newPrice = (newPlan.prices as Record<string, number>)[currency];
  const periodEndDate = periodEnd ? new Date(periodEnd).toLocaleDateString(undefined, { dateStyle: "long" }) : null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {mode === "upgrade" ? `Upgrade to ${newPlan.name}?` : `Downgrade to ${newPlan.name}?`}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 pt-1">
              {mode === "upgrade" ? (
                <>
                  <p>
                    You&apos;ll be charged {newPrice ? formatPrice(newPrice, currency) : "the new amount"} per month.
                    We&apos;ll prorate the difference based on days remaining in your current billing period.
                  </p>
                  <p className="text-sm">New features and quota limits apply immediately after payment.</p>
                </>
              ) : (
                <>
                  <p>
                    Your plan will change to <strong>{newPlan.name}</strong>
                    {periodEndDate ? ` on ${periodEndDate}` : " at the end of your current billing period"}.
                  </p>
                  <p className="text-sm">You&apos;ll keep all your current features until then. No refunds for the current period.</p>
                  {currentPlan && (
                    <p className="text-sm text-warning">
                      Note: if you&apos;re over {newPlan.name}&apos;s quotas (sites, products, users), you&apos;ll need to reduce usage before the change takes effect.
                    </p>
                  )}
                </>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={loading}>
            {loading ? "Processing..." : mode === "upgrade" ? "Confirm upgrade" : "Schedule downgrade"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}