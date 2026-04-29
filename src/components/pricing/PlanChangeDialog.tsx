import { useTranslation } from "next-i18next";
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
  const { t, i18n } = useTranslation("billing");
  if (!newPlan) return null;
  const newPrice = (newPlan.prices as Record<string, number>)[currency];
  const lang = i18n.language?.startsWith("ar") ? "ar-u-nu-latn" : (i18n.language || undefined);
  const periodEndDate = periodEnd ? new Date(periodEnd).toLocaleDateString(lang, { dateStyle: "long" }) : null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {mode === "upgrade"
              ? t("planChange.upgradeTitle", { name: newPlan.name })
              : t("planChange.downgradeTitle", { name: newPlan.name })}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 pt-1">
              {mode === "upgrade" ? (
                <>
                  <p>
                    {newPrice
                      ? t("planChange.upgradeDesc", { price: formatPrice(newPrice, currency) })
                      : t("planChange.upgradeDescNoPrice")}
                  </p>
                  <p className="text-sm">{t("planChange.upgradeNote")}</p>
                </>
              ) : (
                <>
                  <p>
                    {periodEndDate
                      ? t("planChange.downgradeDesc", { name: newPlan.name, date: periodEndDate })
                      : t("planChange.downgradeDescNoDate", { name: newPlan.name })}
                  </p>
                  <p className="text-sm">{t("planChange.downgradeNote")}</p>
                  {currentPlan && (
                    <p className="text-sm text-warning">
                      {t("planChange.quotaWarning", { name: newPlan.name })}
                    </p>
                  )}
                </>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>{t("planChange.cancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={loading}>
            {loading
              ? t("planChange.processing")
              : mode === "upgrade"
              ? t("planChange.confirmUpgrade")
              : t("planChange.scheduleDowngrade")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}